-- Local Phase 2C. Additive dispatch metadata; Phase 1/2B files stay immutable.
alter table flowforge_private.ff_execution_outbox
  add column available_at timestamptz not null default clock_timestamp(),
  add column dispatch_owner uuid,
  add column dispatch_until timestamptz,
  add column dispatch_generation bigint not null default 0,
  add column dispatch_attempts integer not null default 0 check(dispatch_attempts between 0 and 12),
  add column published_at timestamptz,
  add column exhausted_at timestamptz,
  add column failure_code text;
create index ff_outbox_dispatch_due on flowforge_private.ff_execution_outbox(available_at,id)
  where published_at is null and exhausted_at is null and acknowledged_at is null;
create table flowforge_private.ff_delivery_attempts (
  outbox_id bigint not null references flowforge_private.ff_execution_outbox(id) on delete cascade,
  attempt integer not null check(attempt between 1 and 12),
  generation bigint not null, owner uuid not null,
  started_at timestamptz not null default clock_timestamp(), finished_at timestamptz,
  outcome text not null default 'publishing' check(outcome in ('publishing','published','retryable','ambiguous','terminal')),
  transport_id text check(length(transport_id)<=200),
  primary key(outbox_id,attempt)
);
alter table flowforge_private.ff_delivery_attempts enable row level security;
revoke all on flowforge_private.ff_delivery_attempts from public,anon,authenticated,service_role;

-- Every new capability defaults OFF. The existing 2B disable operation also
-- closes these helpers even if a 2C grant was previously enabled.
create function flowforge_private.delivery_enabled() returns void
language plpgsql set search_path='' as $$
begin
  if not has_function_privilege('service_role','public.ff_exec_claim(uuid)','EXECUTE')
    or not has_function_privilege('service_role','public.ff_exec_advance(uuid,uuid,bigint,boolean,integer)','EXECUTE') then
    raise insufficient_privilege;
  end if;
end $$;

create function public.ff_delivery_claim(dispatcher uuid, batch integer default 10) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o flowforge_private.ff_execution_outbox; result jsonb:='[]';
begin
  perform flowforge_private.delivery_enabled();
  if dispatcher is null or batch is null or batch not between 1 and 25 then raise check_violation; end if;
  -- Lock only outbox rows here. Worker/recovery lock runs before outbox; never
  -- acquire a run lock while holding a dispatch lock (avoids lock inversion).
  for o in select x.* from flowforge_private.ff_execution_outbox x join public.ff_runs r on r.id=x.run_id
    where x.event in ('ready','cancel') and x.acknowledged_at is null and x.published_at is null
      and x.exhausted_at is null and x.dispatch_attempts<12 and x.available_at<=clock_timestamp()
      and (x.dispatch_until is null or x.dispatch_until<=clock_timestamp())
      and r.state in ('queued','running','cancellation_requested')
    order by x.available_at,x.id for update of x skip locked limit batch loop
    update flowforge_private.ff_delivery_attempts set outcome='ambiguous',finished_at=clock_timestamp()
      where outbox_id=o.id and outcome='publishing';
    update flowforge_private.ff_execution_outbox set dispatch_owner=dispatcher,
      dispatch_until=clock_timestamp()+interval '30 seconds',dispatch_generation=dispatch_generation+1,
      dispatch_attempts=dispatch_attempts+1 where id=o.id returning * into o;
    insert into flowforge_private.ff_delivery_attempts(outbox_id,attempt,generation,owner)
      values(o.id,o.dispatch_attempts,o.dispatch_generation,dispatcher);
    result:=result||jsonb_build_array(jsonb_build_object('eventId',o.id::text,'runId',o.run_id,
      'generation',o.dispatch_generation,'attempt',o.dispatch_attempts));
  end loop;
  return result;
end $$;

create function public.ff_delivery_settle(eid bigint, dispatcher uuid, fence bigint, outcome text, transport_id text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare o flowforge_private.ff_execution_outbox;
begin
  perform flowforge_private.delivery_enabled();
  if outcome is null or outcome not in ('published','retryable','ambiguous','terminal')
    or (outcome='published' and (transport_id is null or length(transport_id) not between 1 and 200)) then raise check_violation; end if;
  select * into o from flowforge_private.ff_execution_outbox where id=eid for update;
  if o.id is null or dispatcher is null or o.dispatch_owner is distinct from dispatcher or o.dispatch_generation is distinct from fence
    or o.dispatch_until is null or o.dispatch_until<=clock_timestamp() then return false; end if;
  update flowforge_private.ff_delivery_attempts a set outcome=ff_delivery_settle.outcome,
    transport_id=case when ff_delivery_settle.outcome='published' then ff_delivery_settle.transport_id else null end,
    finished_at=clock_timestamp() where a.outbox_id=eid and a.attempt=o.dispatch_attempts and a.outcome='publishing';
  update flowforge_private.ff_execution_outbox set
    published_at=case when outcome='published' then clock_timestamp() else null end,
    exhausted_at=case when outcome='terminal' or (outcome<>'published' and dispatch_attempts>=12) then clock_timestamp() else null end,
    failure_code=case when outcome='published' then null else outcome end,
    -- Bounded exponential backoff, 50-100% jitter. Never return raw transport errors.
    available_at=clock_timestamp()+make_interval(secs=>least(60.0,power(2.0,o.dispatch_attempts))*(0.5+random()*0.5)),
    dispatch_owner=null,dispatch_until=null where id=eid;
  return true;
end $$;

-- Targeted equivalent of the 2B lease acquisition; deterministic evaluation and
-- checkpoint writes still use the unchanged ff_exec_advance protocol.
create function public.ff_delivery_run_claim(rid uuid, eid bigint, worker uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ff_runs;
begin
  perform flowforge_private.delivery_enabled();
  if worker is null then raise check_violation; end if;
  if not exists(select 1 from flowforge_private.ff_execution_outbox where id=eid and run_id=rid and event in ('ready','cancel')) then
    return jsonb_build_object('status','ignored');
  end if;
  select * into r from public.ff_runs where id=rid for update;
  if r.id is null then return jsonb_build_object('status','ignored'); end if;
  perform flowforge_private.execution_expire(rid);
  select * into r from public.ff_runs where id=rid;
  if r.state not in ('queued','running') then return jsonb_build_object('status','terminal'); end if;
  if r.lease_until>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  update public.ff_run_steps set state='abandoned',error_code='lease_expired',finished_at=clock_timestamp() where run_id=rid and state='running';
  update public.ff_runs set state='running',worker_id=worker,generation=generation+1,
    lease_until=least(clock_timestamp()+interval '30 seconds',coalesce(deadline_at,clock_timestamp()+interval '5 minutes')),
    started_at=coalesce(started_at,clock_timestamp()),deadline_at=coalesce(deadline_at,clock_timestamp()+interval '5 minutes')
    where id=rid returning * into r;
  update flowforge_private.ff_execution_outbox set acknowledged_at=clock_timestamp() where run_id=rid and event='ready';
  return jsonb_build_object('status','claimed','runId',rid,'generation',r.generation,'state',r.state,'checkpoint',r.cursor);
end $$;

create function public.ff_delivery_recover(batch integer default 25) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ff_runs; o flowforge_private.ff_execution_outbox; changed integer:=0; stopped integer:=0;
begin
  perform flowforge_private.delivery_enabled();
  if batch is null or batch not between 1 and 100 then raise check_violation; end if;
  for r in select x.* from public.ff_runs x join flowforge_private.ff_execution_outbox b on b.run_id=x.id and b.event='ready'
    where x.state in ('queued','running','cancellation_requested') and (
      x.state='cancellation_requested' or x.deadline_at<=clock_timestamp() or x.created_at+interval '30 minutes'<=clock_timestamp()
      or ((x.lease_until is null or x.lease_until<=clock_timestamp()) and (b.dispatch_until is null or b.dispatch_until<=clock_timestamp())
        and (b.exhausted_at is not null or b.dispatch_attempts>=12 or b.published_at<clock_timestamp()-interval '60 seconds'
          or (b.published_at is null and b.acknowledged_at is not null))))
    order by x.created_at,x.id for update of x skip locked limit batch loop
    -- Run lock precedes outbox lock, as in the core. Skip a live dispatcher.
    select * into o from flowforge_private.ff_execution_outbox where run_id=r.id and event='ready' for update skip locked;
    if o.id is null then continue; end if;
    perform flowforge_private.execution_expire(r.id);
    if (select state from public.ff_runs where id=r.id) not in ('queued','running') then stopped:=stopped+1; continue; end if;
    if r.lease_until>clock_timestamp() then continue; end if;
    if o.exhausted_at is not null or o.dispatch_attempts>=12 then
      perform flowforge_private.execution_finish(r.id,'failed','delivery_exhausted'); stopped:=stopped+1;
    else
      update flowforge_private.ff_execution_outbox set acknowledged_at=null,published_at=null,
        dispatch_owner=null,dispatch_until=null,available_at=clock_timestamp(),failure_code='recovery' where id=o.id;
      changed:=changed+1;
    end if;
  end loop;
  return jsonb_build_object('requeued',changed,'finalized',stopped);
end $$;

create function public.ff_delivery_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('pending',(select count(*) from flowforge_private.ff_execution_outbox where event='ready' and published_at is null and acknowledged_at is null),
    'exhausted',(select count(*) from flowforge_private.ff_execution_outbox where exhausted_at is not null),
    'expiredLeases',(select count(*) from public.ff_runs where state='running' and lease_until<=clock_timestamp()),
    'queued',(select count(*) from public.ff_runs where state='queued'))
$$;
revoke all on function flowforge_private.delivery_enabled(),public.ff_delivery_claim(uuid,integer),
  public.ff_delivery_settle(bigint,uuid,bigint,text,text),public.ff_delivery_run_claim(uuid,bigint,uuid),
  public.ff_delivery_recover(integer),public.ff_delivery_status() from public,anon,authenticated,service_role;
-- No default grants, schedules, triggers, or delivery activation.
