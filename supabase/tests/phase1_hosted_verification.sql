-- Manual hosted verification. Requires exactly one existing workspace with a saved workflow
-- and a second Google identity without a workspace. Controlled JWT claims, not browser OAuth.
-- All test writes are rolled back; assertions abort on failure.
BEGIN;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select owner_id from public.ff_workspaces limit 1),'app_metadata',jsonb_build_object('provider','google'),'amr',jsonb_build_array(jsonb_build_object('method','oauth')))::text,true);
set local role authenticated;
DO $$ begin
 if (select count(*) from public.ff_workspaces)<>1 or (select count(*) from public.ff_workflows)<>1 then raise exception 'Owner read failed'; end if;
 if public.ff_bootstrap() is distinct from public.ff_bootstrap() then raise exception 'Bootstrap not idempotent'; end if;
 begin perform public.ff_commit(-1,public.ff_load()->'state'); raise exception 'Invalid revision accepted'; exception when check_violation then null; end;
 begin perform public.ff_commit(0,public.ff_load()->'state'); raise exception 'Stale revision accepted'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select user_id from auth.identities where provider='google' and user_id not in(select owner_id from public.ff_workspaces) limit 1),'app_metadata',jsonb_build_object('provider','google'),'amr',jsonb_build_array(jsonb_build_object('method','oauth')))::text,true);
set local role authenticated;
DO $$ begin
 if auth.uid() is null then raise exception 'Second Google identity unavailable'; end if;
 if (select count(*) from public.ff_workspaces)<>0 or (select count(*) from public.ff_workflows)<>0 then raise exception 'Cross-user read leak'; end if;
 begin perform public.ff_commit(0,'{}'); raise exception 'Foreign write accepted'; exception when insufficient_privilege then null; end;
 perform public.ff_bootstrap();
 if (select count(*) from public.ff_workspaces)<>1 or (select count(*) from public.ff_workflows)<>0 then raise exception 'Second workspace isolation failed'; end if;
end $$;
reset role;
select 'PASS: ownership, bootstrap idempotence, invalid/stale revisions, second-user isolation' as verification;
ROLLBACK;
