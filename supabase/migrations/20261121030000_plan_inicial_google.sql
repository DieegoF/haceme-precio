-- =====================================================================
-- Ingreso con Google: Google no deja mandar el plan elegido al crear la cuenta.
-- El navegador lo aplica justo después del primer ingreso, solo si la cuenta es nueva
-- (creada hace menos de 30 minutos) y todavía no publicó nada.
-- =====================================================================
create or replace function public.claim_initial_plan(p_plan text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); a public.seller_accounts;
begin
  if uid is null or p_plan not in ('pase', 'mensual', 'pro', 'tienda') then return; end if;
  select * into a from public.seller_accounts where seller_id = uid for update;
  if not found or a.created_at < now() - interval '30 minutes' or a.plan::text = p_plan then return; end if;
  if exists (select 1 from public.products where seller_id = uid) then return; end if;
  update public.seller_accounts set plan = p_plan::public.plan_kind,
    status = case when p_plan = 'pase' then 'activa'::public.account_status else 'prueba'::public.account_status end,
    trial_ends_at = case when p_plan = 'pase' then null else a.created_at + interval '15 days' end
  where seller_id = uid;
end $$;
revoke execute on function public.claim_initial_plan(text) from public, anon;
grant execute on function public.claim_initial_plan(text) to authenticated;
