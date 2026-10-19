-- Stop delivery/maintenance invocations and drain already authorized transactions.
begin;
revoke execute on function public.ff_delivery_claim(uuid,integer),public.ff_delivery_settle(bigint,uuid,bigint,text,text),
  public.ff_delivery_run_claim(uuid,bigint,uuid),public.ff_delivery_recover(integer),public.ff_delivery_status() from public,anon,authenticated,service_role;
commit;
