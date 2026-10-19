-- OPERATOR APPROVAL REQUIRED on hosted databases. No history/data deletion.
-- Stop approved runners first; after COMMIT, drain any already-authorized calls
-- as documented in docs/PHASE2B_MIGRATION_RECOVERY.md. ACL changes do not abort
-- statements already in flight. This script touches only Phase 2B function ACLs.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
revoke execute on function public.ff_exec_start(text,bigint,jsonb,text),
  public.ff_exec_claim(uuid),public.ff_exec_advance(uuid,uuid,bigint,boolean,integer)
  from public,anon,authenticated,service_role;
commit;
