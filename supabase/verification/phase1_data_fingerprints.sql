-- READ ONLY: no row contents are returned. This is an integrity check, NOT a backup.
begin isolation level repeatable read read only;
select 'ff_profiles' as table_name,count(*) as rows,encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') as fingerprint
from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from public.ff_profiles t) s
union all select 'ff_workspaces',count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from public.ff_workspaces t) s
union all select 'ff_workflows',count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from public.ff_workflows t) s
union all select 'ff_preferences',count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from public.ff_preferences t) s
union all select 'ff_simulations',count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from public.ff_simulations t) s
union all select 'ff_imports',count(*),encode(sha256(convert_to(coalesce(string_agg(h,'' order by h),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from public.ff_imports t) s;
commit;
