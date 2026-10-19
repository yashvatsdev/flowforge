-- READ ONLY. Capture before/after application with psql -X -qAt -v ON_ERROR_STOP=1.
-- The phase1 baseline must already have a registered history table.
begin read only;
set local search_path = pg_catalog;
select jsonb_build_object(
  'history',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations),
  'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' and c.relname in ('ff_runs','ff_run_steps') or n.nspname='flowforge_private' and c.relname='ff_execution_outbox') and c.relkind='r'),
  'columns',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity) order by n.nspname,c.relname,a.attnum)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
    where (n.nspname='public' and c.relname in ('ff_runs','ff_run_steps') or n.nspname='flowforge_private' and c.relname='ff_execution_outbox') and a.attnum>0 and not a.attisdropped),
  'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid),'validated',c.convalidated) order by c.conrelid::regclass::text,c.conname)
    from pg_constraint c where c.conrelid in (to_regclass('public.ff_runs'),to_regclass('public.ff_run_steps'),to_regclass('flowforge_private.ff_execution_outbox')) and c.contype<>'n'),
  'indexes',(select jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) order by indexname) from pg_indexes where schemaname='public' and tablename in ('ff_runs','ff_run_steps') or schemaname='flowforge_private' and tablename='ff_execution_outbox'),
  'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('ff_runs','ff_run_steps') or schemaname='flowforge_private' and tablename='ff_execution_outbox'),
  'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'args',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,
    'body_sha256',encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')) order by n.nspname,p.proname)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('ff_exec_start','ff_exec_cancel','ff_exec_read','ff_exec_claim','ff_exec_advance') or n.nspname='flowforge_private' and p.proname in ('execution_immutable','execution_compile','execution_finish','execution_expire')),
  'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t where t.tgrelid=to_regclass('public.ff_runs') and not t.tgisinternal),
  'sequence_acl',(select c.relacl::text from pg_class c where c.oid=to_regclass('flowforge_private.ff_execution_outbox_id_seq')),
  'effective_function_privileges',(select jsonb_agg(jsonb_build_object('role',r.rolname,'function',p.oid::regprocedure::text,'execute',has_function_privilege(r.oid,p.oid,'EXECUTE')) order by r.rolname,p.oid::regprocedure::text)
    from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace where r.rolname in ('anon','authenticated','service_role') and (n.nspname='public' and p.proname in ('ff_exec_start','ff_exec_cancel','ff_exec_read','ff_exec_claim','ff_exec_advance') or n.nspname='flowforge_private' and p.proname in ('execution_immutable','execution_compile','execution_finish','execution_expire'))),
  'effective_table_privileges',(select jsonb_agg(jsonb_build_object('role',r.rolname,'table',c.oid::regclass::text,'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE')) order by r.rolname,c.oid::regclass::text)
    from pg_roles r cross join pg_class c where r.rolname in ('anon','authenticated','service_role') and c.oid in (to_regclass('public.ff_runs'),to_regclass('public.ff_run_steps'),to_regclass('flowforge_private.ff_execution_outbox')))
) as inventory;
commit;
