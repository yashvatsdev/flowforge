-- OPERATOR APPROVAL REQUIRED; not a deployment or worker-start command.
-- Restore precisely the originally reviewed runtime privileges, after all
-- recovery checks and a separate authorization to enable the intended environment.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
revoke execute on function public.ff_exec_start(text,bigint,jsonb,text),
  public.ff_exec_claim(uuid),public.ff_exec_advance(uuid,uuid,bigint,boolean,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.ff_exec_start(text,bigint,jsonb,text) to authenticated;
grant execute on function public.ff_exec_claim(uuid),public.ff_exec_advance(uuid,uuid,bigint,boolean,integer) to service_role;
commit;
