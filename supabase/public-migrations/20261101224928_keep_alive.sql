-- Public project only; apply separately after approval. No application data access.
create or replace function public.keep_alive()
returns integer
language sql
stable
security invoker
set search_path = pg_catalog
as $$ select 1; $$;

revoke all on function public.keep_alive() from public, anon, authenticated, service_role;
grant execute on function public.keep_alive() to anon;

-- Refresh PostgREST's function cache after the transaction commits.
notify pgrst, 'reload schema';
