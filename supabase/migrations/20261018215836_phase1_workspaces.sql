-- Additive Phase 1 migration. Existing application tables/data are untouched.
create schema if not exists flowforge_private;
revoke all on schema flowforge_private from public, anon;
grant usage on schema flowforge_private to authenticated;

create function public.ff_google() returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->'app_metadata'->>'provider', '') = 'google' and exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m where m->>'method'='oauth')
$$;
revoke all on function public.ff_google() from public;
grant execute on function public.ff_google() to authenticated;

create function public.ff_valid_workflow(d jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare n jsonb; e jsonb; required text[]; node_kind text; remaining text[]; roots text[];
begin
  if jsonb_typeof(d) <> 'object' or jsonb_typeof(d->'nodes') <> 'array' or jsonb_typeof(d->'edges') <> 'array' then return false; end if;
  if exists(select 1 from unnest(array['id','name','description','updatedAt']) k where jsonb_typeof(d->k) is distinct from 'string') then return false; end if;
  if length(d->>'id') not between 1 and 200 or length(btrim(d->>'name')) not between 1 and 10000 or jsonb_typeof(d->'active') is distinct from 'boolean' or jsonb_typeof(d->'description') <> 'string' then return false; end if;
  if jsonb_array_length(d->'nodes') not between 1 and 1000 or jsonb_array_length(d->'edges') > 5000 then return false; end if;
  perform (d->>'updatedAt')::timestamptz;
  if (select count(*) <> count(distinct x->>'id') from jsonb_array_elements(d->'nodes') x) or (select count(*) <> count(distinct x->>'id') from jsonb_array_elements(d->'edges') x) then return false; end if;
  if (select count(*) from jsonb_array_elements(d->'nodes') x where x->'data'->>'kind' = 'trigger') <> 1 then return false; end if;
  for n in select value from jsonb_array_elements(d->'nodes') loop
    if jsonb_typeof(n->'id') is distinct from 'string' or jsonb_typeof(n->'data'->'label') is distinct from 'string' or n->>'type' is distinct from 'forge' or jsonb_typeof(n->'position'->'x') is distinct from 'number' or jsonb_typeof(n->'position'->'y') is distinct from 'number' then return false; end if;
    if length(btrim(n->>'id')) not between 1 and 200 or n->>'type' <> 'forge' or jsonb_typeof(n->'position'->'x') <> 'number' or jsonb_typeof(n->'position'->'y') <> 'number' or length(btrim(n->'data'->>'label')) not between 1 and 10000 or jsonb_typeof(n->'data'->'config') <> 'object' then return false; end if;
    node_kind := n->'data'->>'kind';
    required := case node_kind when 'trigger' then array['amount','email'] when 'transform' then array['field','value'] when 'condition' then array['threshold'] when 'http' then array['url','method','fail'] when 'notification' then array['channel','message'] else null end;
    if required is null then return false; end if;
    if exists(select 1 from unnest(required) r where jsonb_typeof(n->'data'->'config'->r) is distinct from 'string') or exists(select 1 from jsonb_each(n->'data'->'config') c where jsonb_typeof(c.value) <> 'string' or length(c.value #>> '{}') > 10000) then return false; end if;
    if node_kind='trigger' then perform (n->'data'->'config'->>'amount')::numeric; end if;
    if node_kind='condition' then perform (n->'data'->'config'->>'threshold')::numeric; end if;
    if node_kind='transform' and btrim(n->'data'->'config'->>'field')='' then return false; end if;
    if node_kind='http' and (n->'data'->'config'->>'url' !~ '^https?://[^/ ]+' or n->'data'->'config'->>'method' not in ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS') or n->'data'->'config'->>'fail' not in ('true','false')) then return false; end if;
  end loop;
  if (select count(*) <> count(distinct jsonb_build_array(x->>'source',x->>'target',coalesce(x->>'sourceHandle',''))) from jsonb_array_elements(d->'edges') x) then return false; end if;
  for e in select value from jsonb_array_elements(d->'edges') loop
    if exists(select 1 from unnest(array['id','source','target']) k where jsonb_typeof(e->k) is distinct from 'string') then return false; end if;
    if length(btrim(e->>'id')) not between 1 and 200 then return false; end if;
    select x into n from jsonb_array_elements(d->'nodes') x where x->>'id'=e->>'source';
    if n is null or not exists(select 1 from jsonb_array_elements(d->'nodes') x where x->>'id'=e->>'target' and x->'data'->>'kind'<>'trigger') then return false; end if;
    if n->'data'->>'kind'='condition' then
      if coalesce(e->>'sourceHandle','') not in ('true','false') then return false; end if;
    elsif coalesce(e->>'sourceHandle','')<>'' then return false;
    end if;
    if coalesce(e->>'targetHandle','')<>'' then return false; end if;
  end loop;
  select array_agg(x->>'id') into remaining from jsonb_array_elements(d->'nodes') x;
  while cardinality(remaining)>0 loop
    select array_agg(i) into roots from unnest(remaining) i where not exists(select 1 from jsonb_array_elements(d->'edges') edge_doc where edge_doc->>'target'=i and edge_doc->>'source'=any(remaining));
    if roots is null then return false; end if;
    select coalesce(array_agg(i),'{}'::text[]) into remaining from unnest(remaining) i where not(i=any(roots));
  end loop;
  return true;
exception when others then return false;
end $$;

create table public.ff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', email text not null default '', avatar_url text,
  created_at timestamptz not null default now()
);
create table public.ff_workspaces (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.ff_profiles(id) on delete cascade,
  name text not null default 'Personal workspace' check(length(name) between 1 and 10000),
  revision bigint not null default 0 check(revision>=0), onboarding text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table public.ff_workflows (
  workspace_id uuid not null references public.ff_workspaces(id) on delete cascade,
  id text not null check(length(id) between 1 and 200), document jsonb not null,
  primary key(workspace_id,id), check(document->>'id'=id), check(public.ff_valid_workflow(document))
);
create table public.ff_preferences (
  workspace_id uuid primary key references public.ff_workspaces(id) on delete cascade,
  document jsonb not null check(jsonb_typeof(document)='object')
);
create table public.ff_simulations (
  workspace_id uuid not null references public.ff_workspaces(id) on delete cascade,
  id text not null check(length(id) between 1 and 200), document jsonb not null,
  primary key(workspace_id,id), check(document->>'id'=id), check(jsonb_typeof(document->'steps')='array'),
  check(jsonb_array_length(document->'steps') between 1 and 1000), check(document->>'status' in ('success','failed'))
);
create table public.ff_imports (
  workspace_id uuid not null references public.ff_workspaces(id) on delete cascade,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default now(),
  primary key(workspace_id,fingerprint)
);
-- All workspace foreign-key prefixes are indexed by the primary keys above.
create index ff_simulation_time on public.ff_simulations(workspace_id, (document->>'time'));

alter table public.ff_profiles enable row level security;
alter table public.ff_workspaces enable row level security;
alter table public.ff_workflows enable row level security;
alter table public.ff_preferences enable row level security;
alter table public.ff_simulations enable row level security;
alter table public.ff_imports enable row level security;
create policy ff_profile_read on public.ff_profiles for select to authenticated using(public.ff_google() and id=(select auth.uid()));
create policy ff_workspace_read on public.ff_workspaces for select to authenticated using(public.ff_google() and owner_id=(select auth.uid()));
create policy ff_workflow_read on public.ff_workflows for select to authenticated using(public.ff_google() and exists(select 1 from public.ff_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy ff_preferences_read on public.ff_preferences for select to authenticated using(public.ff_google() and exists(select 1 from public.ff_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy ff_history_read on public.ff_simulations for select to authenticated using(public.ff_google() and exists(select 1 from public.ff_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
create policy ff_import_read on public.ff_imports for select to authenticated using(public.ff_google() and exists(select 1 from public.ff_workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
revoke all on public.ff_profiles,public.ff_workspaces,public.ff_workflows,public.ff_preferences,public.ff_simulations,public.ff_imports from anon,authenticated;
grant select on public.ff_profiles,public.ff_workspaces,public.ff_workflows,public.ff_preferences,public.ff_simulations,public.ff_imports to authenticated;

-- Private definer helpers are deliberately narrow write capabilities. Direct writes
-- are denied so clients cannot bypass the revision check through the Data API.
create function flowforge_private.bootstrap() returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); wid uuid; meta jsonb := auth.jwt()->'user_metadata';
begin
  if not public.ff_google() then raise insufficient_privilege; end if;
  insert into public.ff_profiles(id,name,email,avatar_url) values(uid,left(coalesce(meta->>'full_name',meta->>'name',''),10000),left(coalesce(auth.jwt()->>'email',''),10000),left(meta->>'avatar_url',2048)) on conflict(id) do nothing;
  insert into public.ff_workspaces(owner_id) values(uid) on conflict(owner_id) do nothing;
  select id into wid from public.ff_workspaces where owner_id=uid;
  insert into public.ff_preferences(workspace_id,document) values(wid,jsonb_build_object('name',left(coalesce(meta->>'full_name',meta->>'name',''),10000),'email',left(coalesce(auth.jwt()->>'email',''),10000),'workspace','Personal workspace','reduceMotion',false)) on conflict(workspace_id) do nothing;
  return wid;
end $$;
create function public.ff_bootstrap() returns uuid language sql security invoker set search_path='' as $$ select flowforge_private.bootstrap() $$;

create function public.ff_load() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('workspaceId',w.id,'revision',w.revision,'onboarding',w.onboarding,'state',jsonb_build_object('version',1,'settings',p.document,'workflows',coalesce((select jsonb_agg(f.document order by f.id) from public.ff_workflows f where f.workspace_id=w.id),'[]'::jsonb),'executions',coalesce((select jsonb_agg(e.document order by e.document->>'time' desc,e.id) from public.ff_simulations e where e.workspace_id=w.id),'[]'::jsonb)))
  from public.ff_workspaces w join public.ff_preferences p on p.workspace_id=w.id where w.owner_id=(select auth.uid())
$$;

create function flowforge_private.commit_workspace(expected bigint, document jsonb, import_fingerprint text default null, action text default null) returns bigint language plpgsql security definer set search_path='' as $$
declare wid uuid; current_revision bigint; item jsonb; ids text[]; s jsonb := document->'settings';
begin
  if not public.ff_google() then raise insufficient_privilege; end if;
  select id,revision into wid,current_revision from public.ff_workspaces where owner_id=auth.uid() for update;
  if wid is null then raise insufficient_privilege; end if;
  if import_fingerprint is not null and exists(select 1 from public.ff_imports where workspace_id=wid and fingerprint=import_fingerprint) then return current_revision; end if;
  if expected is null or expected < 0 then raise check_violation; end if;
  if current_revision<>expected then raise exception 'Revision conflict' using errcode='40001'; end if;
  if document->>'version' is distinct from '1' or octet_length(document::text)>5000000 or jsonb_typeof(document->'workflows') is distinct from 'array' or jsonb_typeof(document->'executions') is distinct from 'array' or jsonb_typeof(s) is distinct from 'object' then raise check_violation; end if;
  if jsonb_array_length(document->'workflows')>1000 or jsonb_array_length(document->'executions')>200 or exists(select 1 from unnest(array['name','email','workspace']) k where jsonb_typeof(s->k) is distinct from 'string' or length(s->>k)>10000) or jsonb_typeof(s->'reduceMotion') is distinct from 'boolean' or btrim(s->>'workspace')='' then raise check_violation; end if;
  if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(document->'workflows') x) or (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(document->'executions') x) then raise check_violation; end if;
  -- Replacements are explicit authenticated application operations, never migrations.
  select coalesce(array_agg(x->>'id'),'{}') into ids from jsonb_array_elements(document->'workflows') x;
  delete from public.ff_workflows where workspace_id=wid and not(id=any(ids));
  for item in select value from jsonb_array_elements(document->'workflows') loop
    insert into public.ff_workflows(workspace_id,id,document) values(wid,item->>'id',item) on conflict(workspace_id,id) do update set document=excluded.document;
  end loop;
  select coalesce(array_agg(x->>'id'),'{}') into ids from jsonb_array_elements(document->'executions') x;
  delete from public.ff_simulations where workspace_id=wid and not(id=any(ids));
  for item in select value from jsonb_array_elements(document->'executions') loop
    if exists(select 1 from unnest(array['id','workflowId','name','time','status']) k where jsonb_typeof(item->k) is distinct from 'string') or btrim(item->>'workflowId')='' or jsonb_typeof(item->'steps') is distinct from 'array' or item->>'status' not in ('success','failed') then raise check_violation; end if;
    if (select count(*)<>count(distinct t->>'nodeId') from jsonb_array_elements(item->'steps') t) then raise check_violation; end if;
    if (item->>'duration')::numeric is distinct from (select sum((t->>'duration')::numeric) from jsonb_array_elements(item->'steps') t) or (item->>'status'='failed') <> exists(select 1 from jsonb_array_elements(item->'steps') t where t->>'status'='failed') then raise check_violation; end if;
    if jsonb_typeof(item->'workflowId') is distinct from 'string' or jsonb_typeof(item->'name') is distinct from 'string' or jsonb_typeof(item->'duration') is distinct from 'number' or (item->>'duration')::numeric<0 or jsonb_array_length(item->'steps')>1000 then raise check_violation; end if;
    perform (item->>'time')::timestamptz;
    if exists(select 1 from jsonb_array_elements(item->'steps') t where jsonb_typeof(t->'nodeId') is distinct from 'string' or jsonb_typeof(t->'label') is distinct from 'string' or jsonb_typeof(t->'message') is distinct from 'string' or (jsonb_typeof(t->'status') is distinct from 'string' or t->>'status' not in ('success','failed','skipped')) or jsonb_typeof(t->'output') is distinct from 'object' or jsonb_typeof(t->'duration') is distinct from 'number' or (t->>'duration')::numeric<0) then raise check_violation; end if;
    insert into public.ff_simulations(workspace_id,id,document) values(wid,item->>'id',item) on conflict(workspace_id,id) do update set document=excluded.document;
  end loop;
  update public.ff_preferences set document=s where workspace_id=wid;
  update public.ff_workspaces set name=s->>'workspace',revision=revision+1,onboarding=case when action in ('explored','edited','simulated','imported') then array(select distinct unnest(onboarding||array[action])) else onboarding end where id=wid;
  if import_fingerprint is not null then insert into public.ff_imports(workspace_id,fingerprint) values(wid,import_fingerprint); end if;
  return current_revision+1;
end $$;
create function public.ff_commit(expected bigint, document jsonb, import_fingerprint text default null, action text default null) returns bigint language sql security invoker set search_path='' as $$ select flowforge_private.commit_workspace(expected,document,import_fingerprint,action) $$;
revoke all on function flowforge_private.bootstrap(),flowforge_private.commit_workspace(bigint,jsonb,text,text),public.ff_bootstrap(),public.ff_load(),public.ff_commit(bigint,jsonb,text,text) from public,anon;
grant execute on function flowforge_private.bootstrap(),flowforge_private.commit_workspace(bigint,jsonb,text,text),public.ff_bootstrap(),public.ff_load(),public.ff_commit(bigint,jsonb,text,text) to authenticated;
revoke all on function public.ff_valid_workflow(jsonb) from public,anon;
grant execute on function public.ff_valid_workflow(jsonb) to authenticated;
