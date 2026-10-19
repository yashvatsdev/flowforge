-- Phase 2B: additive execution core. No Phase 1 data or grants are changed.
create table public.ff_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.ff_workspaces(id) on delete cascade,
  workflow_id text not null,
  workspace_revision bigint not null check (workspace_revision >= 0),
  snapshot jsonb not null check (octet_length(snapshot::text) <= 262144),
  plan jsonb not null check (jsonb_typeof(plan) = 'array' and jsonb_array_length(plan) between 1 and 100),
  manual_input jsonb not null check (jsonb_typeof(manual_input) = 'object' and octet_length(manual_input::text) <= 65536),
  idempotency_key text not null check (length(idempotency_key) between 1 and 128),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'queued' check (state in ('queued','running','succeeded','failed','cancellation_requested','cancelled','timed_out')),
  created_at timestamptz not null default clock_timestamp(),
  started_at timestamptz, finished_at timestamptz, deadline_at timestamptz,
  cancel_requested_at timestamptz,
  worker_id uuid, lease_until timestamptz,
  generation bigint not null default 0 check (generation >= 0),
  cursor integer not null default 0 check (cursor between 0 and 100),
  output_bytes integer not null default 0 check (output_bytes between 0 and 1048576),
  error_code text,
  unique (workspace_id,idempotency_key), unique (workspace_id,id)
);
create index ff_runs_history on public.ff_runs(workspace_id,created_at desc,id desc);
create index ff_runs_claim on public.ff_runs(created_at,id) where state in ('queued','running','cancellation_requested');

create table public.ff_run_steps (
  run_id uuid not null, workspace_id uuid not null, node_id text not null,
  ordinal integer not null check (ordinal between 0 and 99),
  attempt integer not null check (attempt between 1 and 3),
  generation bigint not null,
  state text not null check (state in ('running','succeeded','skipped','failed','abandoned','cancelled','timed_out')),
  output jsonb check (jsonb_typeof(output) = 'object' and octet_length(output::text) <= 65536),
  branch boolean, error_code text,
  started_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
  primary key (run_id,node_id,attempt),
  foreign key (workspace_id,run_id) references public.ff_runs(workspace_id,id) on delete cascade
);
create unique index ff_run_steps_checkpoint on public.ff_run_steps(run_id,node_id) where state in ('succeeded','skipped');
create index ff_run_steps_workspace on public.ff_run_steps(workspace_id,run_id,ordinal,attempt);
create table flowforge_private.ff_execution_outbox (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.ff_runs(id) on delete cascade,
  event text not null check (event in ('ready','cancel','terminal')),
  created_at timestamptz not null default clock_timestamp(),
  acknowledged_at timestamptz,
  unique (run_id,event)
);
create index ff_execution_outbox_pending on flowforge_private.ff_execution_outbox(id) where acknowledged_at is null;
alter table public.ff_runs enable row level security;
alter table public.ff_run_steps enable row level security;
alter table flowforge_private.ff_execution_outbox enable row level security;
create policy ff_runs_read on public.ff_runs for select to authenticated using (
  public.ff_google() and exists(select 1 from public.ff_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid()))
);
create policy ff_run_steps_read on public.ff_run_steps for select to authenticated using (
  public.ff_google() and exists(select 1 from public.ff_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid()))
);
revoke all on public.ff_runs,public.ff_run_steps,flowforge_private.ff_execution_outbox from public,anon,authenticated,service_role;
revoke all on sequence flowforge_private.ff_execution_outbox_id_seq from public,anon,authenticated,service_role;
grant select on public.ff_runs,public.ff_run_steps to authenticated;

create function flowforge_private.execution_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
  if row(new.id,new.workspace_id,new.workflow_id,new.workspace_revision,new.snapshot,new.plan,new.manual_input,new.idempotency_key,new.request_hash,new.created_at)
    is distinct from row(old.id,old.workspace_id,old.workflow_id,old.workspace_revision,old.snapshot,old.plan,old.manual_input,old.idempotency_key,old.request_hash,old.created_at) then
    raise exception 'Execution provenance is immutable' using errcode='23514';
  end if;
  return new;
end $$;
create trigger ff_runs_immutable before update on public.ff_runs for each row execute function flowforge_private.execution_immutable();

-- Saved graph admission is repeated in PostgreSQL; direct RPC cannot bypass it.
create function flowforge_private.execution_compile(d jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare n jsonb; e jsonb; config jsonb; k text; roots text[]; done text[] := '{}'; result jsonb := '[]';
begin
  if not coalesce(public.ff_valid_workflow(d),false) or octet_length(d::text)>262144
     or jsonb_array_length(d->'nodes')>100 or jsonb_array_length(d->'edges')>500 then raise check_violation; end if;
  for n in select value from jsonb_array_elements(d->'nodes') loop
    k:=n->'data'->>'kind'; config:=n->'data'->'config';
    if k not in ('trigger','transform','condition') then raise check_violation; end if;
    if k='transform' and (config->>'field' in ('__proto__','constructor','prototype') or length(config->>'field')>200) then raise check_violation; end if;
    if k='condition' then
      if btrim(config->>'threshold')='' or (config->>'threshold')::double precision in ('Infinity'::double precision,'-Infinity'::double precision,'NaN'::double precision) then raise check_violation; end if;
    end if;
    if (select count(*) from jsonb_array_elements(d->'edges') x where x->>'target'=n->>'id')>1 then raise check_violation; end if;
  end loop;
  select array_agg(nd->>'id' order by nd->>'id') into roots from jsonb_array_elements(d->'nodes') nd
    where not exists(select 1 from jsonb_array_elements(d->'edges') x where x->>'target'=nd->>'id');
  if cardinality(roots)<>1 or not exists(select 1 from jsonb_array_elements(d->'nodes') x where x->>'id'=roots[1] and x->'data'->>'kind'='trigger') then raise check_violation; end if;
  while cardinality(roots)>0 loop
    select value into n from jsonb_array_elements(d->'nodes') where value->>'id'=roots[1];
    select value into e from jsonb_array_elements(d->'edges') where value->>'target'=roots[1];
    result:=result||jsonb_build_array(jsonb_build_object('id',n->>'id','kind',n->'data'->>'kind','config',n->'data'->'config','parent',e->>'source','port',coalesce(e->>'sourceHandle','')));
    done:=array_append(done,roots[1]); roots:=roots[2:];
    select roots||coalesce(array_agg(x->>'target' order by x->>'target'),'{}') into roots from jsonb_array_elements(d->'edges') x where x->>'source'=n->>'id';
  end loop;
  if cardinality(done)<>jsonb_array_length(d->'nodes') then raise check_violation; end if;
  return result;
exception when others then raise exception 'Unsupported or malformed execution graph' using errcode='PT422';
end $$;

create function flowforge_private.execution_finish(rid uuid, target text, reason text default null) returns void
language plpgsql set search_path='' as $$
begin
  update public.ff_runs set state=target,error_code=reason,finished_at=clock_timestamp(),worker_id=null,lease_until=null where id=rid;
  update public.ff_run_steps set state=case when target='cancelled' then 'cancelled' when target='timed_out' then 'timed_out' else 'failed' end,
    error_code=reason,finished_at=clock_timestamp() where run_id=rid and state='running';
  insert into flowforge_private.ff_execution_outbox(run_id,event) values(rid,'terminal') on conflict do nothing;
  update flowforge_private.ff_execution_outbox set acknowledged_at=clock_timestamp() where run_id=rid;
end $$;

-- Caller must already hold the run row lock. Expiration is enforced at admission,
-- claim, checkpoint, and cancellation, without relying on a browser timer.
create function flowforge_private.execution_expire(rid uuid) returns void
language plpgsql set search_path='' as $$
declare r public.ff_runs;
begin
  select * into r from public.ff_runs where id=rid;
  if r.state not in ('queued','running','cancellation_requested') then return; end if;
  if (r.started_at is null and r.created_at+interval '30 minutes'<=clock_timestamp()) or (r.deadline_at<=clock_timestamp()) then
    perform flowforge_private.execution_finish(rid,'timed_out','deadline');
  elsif r.state='cancellation_requested' then
    perform flowforge_private.execution_finish(rid,'cancelled','cancelled');
  end if;
end $$;

create function public.ff_exec_start(workflow text, expected bigint, input jsonb, key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.ff_workspaces; r public.ff_runs; d jsonb; compiled jsonb; h text; rid uuid;
begin
  if not public.ff_google() then raise insufficient_privilege; end if;
  if expected is null or expected<0 or key is null or key !~ '^[A-Za-z0-9._:-]{1,128}$'
     or jsonb_typeof(input) is distinct from 'object' or octet_length(input::text)>65536 then raise exception 'Invalid start request' using errcode='PT422'; end if;
  select * into w from public.ff_workspaces where owner_id=auth.uid() for update;
  if w.id is null then raise insufficient_privilege; end if;
  h:=encode(sha256(convert_to(jsonb_build_object('workflow',workflow,'revision',expected,'input',input)::text,'UTF8')),'hex');
  select * into r from public.ff_runs where workspace_id=w.id and idempotency_key=key;
  if r.id is not null then
    if r.request_hash<>h then raise exception 'Idempotency key reused with different request' using errcode='PT409'; end if;
    return jsonb_build_object('runId',r.id,'state',r.state,'replayed',true);
  end if;
  if w.revision<>expected then raise exception 'Revision conflict' using errcode='PT409'; end if;
  select document into d from public.ff_workflows where workspace_id=w.id and id=workflow;
  if d is null then raise exception 'Workflow not found' using errcode='PT404'; end if;
  compiled:=flowforge_private.execution_compile(d);
  for rid in select id from public.ff_runs where workspace_id=w.id and state in ('queued','running','cancellation_requested') for update loop
    perform flowforge_private.execution_expire(rid);
  end loop;
  if (select count(*) from public.ff_runs where workspace_id=w.id and state in ('queued','running','cancellation_requested'))>=2
    or (select count(*) from public.ff_runs where workspace_id=w.id and created_at>clock_timestamp()-interval '1 minute')>=10 then
    -- Return, rather than raise, so expired-run cleanup above can commit.
    return jsonb_build_object('limited',true);
  end if;
  insert into public.ff_runs(workspace_id,workflow_id,workspace_revision,snapshot,plan,manual_input,idempotency_key,request_hash)
    values(w.id,workflow,expected,d,compiled,input,key,h) returning id into rid;
  insert into flowforge_private.ff_execution_outbox(run_id,event) values(rid,'ready');
  return jsonb_build_object('runId',rid,'state','queued','replayed',false);
end $$;

create function public.ff_exec_cancel(rid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ff_runs;
begin
  if not public.ff_google() then raise insufficient_privilege; end if;
  select x.* into r from public.ff_runs x join public.ff_workspaces w on w.id=x.workspace_id where x.id=rid and w.owner_id=auth.uid() for update of x;
  if r.id is null then raise exception 'Run not found' using errcode='PT404'; end if;
  perform flowforge_private.execution_expire(rid);
  select * into r from public.ff_runs where id=rid;
  if r.state in ('queued','running') then
    update public.ff_runs set cancel_requested_at=clock_timestamp(),state='cancellation_requested' where id=rid;
    insert into flowforge_private.ff_execution_outbox(run_id,event) values(rid,'cancel') on conflict do nothing;
    if r.state='queued' then perform flowforge_private.execution_finish(rid,'cancelled','cancelled'); end if;
  end if;
  return (select jsonb_build_object('runId',id,'state',state) from public.ff_runs where id=rid);
end $$;

create function public.ff_exec_read(kind text, rid uuid default null, before_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not public.ff_google() then raise insufficient_privilege; end if;
  if kind='history' then
    if before_id is not null and not exists(select 1 from public.ff_runs where id=before_id) then raise exception 'Cursor not found' using errcode='PT404'; end if;
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc,t.id desc),'[]') into result from (
      select id,workflow_id,workspace_revision,state,created_at,started_at,finished_at,error_code from public.ff_runs
      where before_id is null or (created_at,id)<(select created_at,id from public.ff_runs where id=before_id)
      order by created_at desc,id desc limit 25
    ) t;
    return jsonb_build_object('runs',result,'nextCursor',case when jsonb_array_length(result)=25 then result->24->>'id' else null end);
  end if;
  if not exists(select 1 from public.ff_runs where id=rid) then raise exception 'Run not found' using errcode='PT404'; end if;
  if kind='details' then
    return (select to_jsonb(r)-'worker_id'-'lease_until'-'idempotency_key'-'request_hash'-'plan' from public.ff_runs r where id=rid);
  elsif kind='steps' then
    return (select coalesce(jsonb_agg(to_jsonb(s) order by ordinal,attempt),'[]') from public.ff_run_steps s where run_id=rid);
  end if;
  raise exception 'Invalid read operation' using errcode='PT422';
end $$;

create function public.ff_exec_claim(worker uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ff_runs;
begin
  if worker is null then raise check_violation; end if;
  -- SKIP LOCKED allows independent runners; durable rows, not outbox delivery, own work.
  for r in select * from public.ff_runs where state in ('queued','running','cancellation_requested')
    and (state<>'running' or lease_until<=clock_timestamp() or deadline_at<=clock_timestamp())
    order by created_at,id for update skip locked limit 100 loop
    perform flowforge_private.execution_expire(r.id);
    if (select state from public.ff_runs where id=r.id) not in ('queued','running') then continue; end if;
    update public.ff_run_steps set state='abandoned',error_code='lease_expired',finished_at=clock_timestamp() where run_id=r.id and state='running';
    update public.ff_runs set state='running',worker_id=worker,generation=generation+1,lease_until=clock_timestamp()+interval '30 seconds',
      started_at=coalesce(started_at,clock_timestamp()),deadline_at=coalesce(deadline_at,clock_timestamp()+interval '5 minutes') where id=r.id
      returning * into r;
    update flowforge_private.ff_execution_outbox set acknowledged_at=clock_timestamp() where run_id=r.id and event='ready';
    return jsonb_build_object('runId',r.id,'generation',r.generation,'state',r.state,'checkpoint',r.cursor);
  end loop;
  return null;
end $$;

-- A two-transaction node protocol makes interrupted attempts visible. The worker
-- submits no graph or results: deterministic checkpoint evaluation happens here.
create function public.ff_exec_advance(rid uuid, worker uuid, fence bigint, complete boolean, checkpoint integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ff_runs; s public.ff_run_steps; parent public.ff_run_steps;
  n jsonb; payload jsonb; selected boolean:=true; chosen_branch boolean; next_attempt integer; bytes integer; code text;
begin
  select * into r from public.ff_runs where id=rid for update;
  if r.id is null or worker is null or r.worker_id is distinct from worker or r.generation is distinct from fence
    or r.lease_until is null or r.lease_until<=clock_timestamp() then raise exception 'Worker lease lost' using errcode='PT409'; end if;
  perform flowforge_private.execution_expire(rid);
  select * into r from public.ff_runs where id=rid;
  if r.state<>'running' then return jsonb_build_object('state',r.state); end if;
  if complete is null or checkpoint is null then raise check_violation; end if;
  if checkpoint<>r.cursor then return jsonb_build_object('state',r.state,'checkpoint',r.cursor); end if;
  update public.ff_runs set lease_until=least(clock_timestamp()+interval '30 seconds',deadline_at) where id=rid returning lease_until into r.lease_until;
  n:=r.plan->r.cursor;
  select * into s from public.ff_run_steps where run_id=rid and node_id=n->>'id' and state='running';
  if not complete then
    if s.run_id is null then
      select coalesce(max(attempt),0)+1 into next_attempt from public.ff_run_steps where run_id=rid and node_id=n->>'id';
      if next_attempt>3 then
        perform flowforge_private.execution_finish(rid,'failed','attempts_exhausted'); return jsonb_build_object('state','failed');
      end if;
      insert into public.ff_run_steps(run_id,workspace_id,node_id,ordinal,attempt,generation,state)
        values(rid,r.workspace_id,n->>'id',r.cursor,next_attempt,fence,'running');
    end if;
    return jsonb_build_object('state','running','nodeId',n->>'id','checkpoint',r.cursor);
  end if;
  if s.run_id is null then
    -- A repeated completion after a committed checkpoint is an inert response.
    return jsonb_build_object('state',r.state,'checkpoint',r.cursor);
  end if;
  if s.generation<>fence then raise exception 'Worker lease lost' using errcode='PT409'; end if;
  if n->>'kind'='trigger' then payload:=r.manual_input;
  else
    select * into parent from public.ff_run_steps where run_id=rid and node_id=n->>'parent' and state in ('succeeded','skipped');
    if parent.run_id is null then raise exception 'Missing parent checkpoint'; end if;
    selected:=parent.state='succeeded' and ((n->>'port')='' or (n->>'port')=case when parent.branch then 'true' else 'false' end);
    payload:=case when selected then parent.output else '{}'::jsonb end;
  end if;
  begin
    if selected and n->>'kind'='transform' then
      payload:=payload||jsonb_build_object(n->'config'->>'field',n->'config'->>'value');
    elsif selected and n->>'kind'='condition' then
      if jsonb_typeof(payload->'amount') is distinct from 'number' then code:='invalid_numeric_input'; end if;
      if code is null then chosen_branch:=(payload->>'amount')::numeric >= (n->'config'->>'threshold')::numeric; end if;
    end if;
    bytes:=octet_length(payload::text);
    if bytes>65536 or r.output_bytes+bytes>1048576 then code:='output_limit'; end if;
  exception when others then code:='invalid_numeric_input'; end;
  -- Recheck after evaluation as well: crossing the deadline while computing
  -- cannot publish a successful result, even with the run lock still held.
  if clock_timestamp()>=r.deadline_at then
    perform flowforge_private.execution_finish(rid,'timed_out','deadline'); return jsonb_build_object('state','timed_out');
  end if;
  if clock_timestamp()>=r.lease_until then raise exception 'Worker lease lost' using errcode='PT409'; end if;
  if code is not null then
    update public.ff_run_steps set error_code=code where run_id=rid and node_id=s.node_id and attempt=s.attempt;
    perform flowforge_private.execution_finish(rid,'failed',code);
    return jsonb_build_object('state','failed');
  end if;
  update public.ff_run_steps set state=case when selected then 'succeeded' else 'skipped' end,
    output=payload,branch=chosen_branch,finished_at=clock_timestamp() where run_id=rid and node_id=s.node_id and attempt=s.attempt;
  update public.ff_runs set cursor=cursor+1,output_bytes=output_bytes+bytes where id=rid;
  if r.cursor+1=jsonb_array_length(r.plan) then perform flowforge_private.execution_finish(rid,'succeeded'); end if;
  return (select jsonb_build_object('state',state,'checkpoint',cursor) from public.ff_runs where id=rid);
end $$;

-- Explicit grants override Supabase's project-dependent default privileges.
revoke all on function flowforge_private.execution_immutable(),flowforge_private.execution_compile(jsonb),
  flowforge_private.execution_finish(uuid,text,text),flowforge_private.execution_expire(uuid),
  public.ff_exec_start(text,bigint,jsonb,text),public.ff_exec_cancel(uuid),public.ff_exec_read(text,uuid,uuid),
  public.ff_exec_claim(uuid),public.ff_exec_advance(uuid,uuid,bigint,boolean,integer)
  from public,anon,authenticated,service_role;
-- Safety correction before first application: admission and workers start DISABLED.
-- Read/cancel remain available. Enabling requires separate operator approval and
-- the narrowly scoped supabase/operations/phase2b_enable_execution.sql procedure.
grant execute on function public.ff_exec_cancel(uuid),public.ff_exec_read(text,uuid,uuid) to authenticated;
