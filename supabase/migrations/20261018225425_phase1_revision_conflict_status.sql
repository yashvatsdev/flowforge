-- Preserve signature, owner, grants and RLS; avoid PostgREST serialization retry loops.
create or replace function flowforge_private.commit_workspace(expected bigint, document jsonb, import_fingerprint text default null, action text default null) returns bigint language plpgsql security definer set search_path='' as $$
declare wid uuid; current_revision bigint; item jsonb; ids text[]; s jsonb := document->'settings';
begin
  if not public.ff_google() then raise insufficient_privilege; end if;
  select id,revision into wid,current_revision from public.ff_workspaces where owner_id=auth.uid() for update;
  if wid is null then raise insufficient_privilege; end if;
  if import_fingerprint is not null and exists(select 1 from public.ff_imports where workspace_id=wid and fingerprint=import_fingerprint) then return current_revision; end if;
  if expected is null or expected < 0 then raise check_violation; end if;
  if current_revision<>expected then raise exception 'Revision conflict' using errcode='PT409'; end if;
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
