-- Separate operator approval required on any hosted database. Test fixtures only here.
begin;
grant execute on function public.ff_delivery_claim(uuid,integer),public.ff_delivery_settle(bigint,uuid,bigint,text,text),
  public.ff_delivery_run_claim(uuid,bigint,uuid),public.ff_delivery_recover(integer),public.ff_delivery_status() to service_role;
-- Does not grant 2B admission/worker privileges; those remain a separate gate.
commit;
