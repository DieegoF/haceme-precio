-- =====================================================================
-- Nuevo modelo de precios:
-- - Gratis: publicaciones sin límite. Haceme Precio cobra 3% SOLO de las ventas cobradas con Mercado Pago dentro
--   de la app (split de MP: marketplace_fee). Sin comisión hasta el lanzamiento (commission_from).
-- - Básico ($10.000) y Tienda ($40.000): sin comisión. 15 días de prueba al registrarse.
-- - «Una sola cosa» (pase) deja de ofrecerse: esas cuentas pasan a Gratis.
-- - Si el Básico vence y no paga, pasa solo a Gratis (no se pausa nada). La Tienda sigue con gracia y pausa.
-- =====================================================================
insert into public.app_settings (key, value) values
  ('commission_pct', '3'),
  ('commission_from', '2027-02-21T03:00:00Z')   -- 21/02/2027 00:00 hora Argentina
on conflict (key) do nothing;

-- Comisión vigente para un vendedor (en %). Solo el plan Gratis paga, y recién desde commission_from.
create or replace function public.commission_pct(p_seller uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when a.plan = 'gratis'
      and now() >= coalesce((select value::timestamptz from public.app_settings where key = 'commission_from'), now())
    then coalesce((select value::numeric from public.app_settings where key = 'commission_pct'), 0) else 0 end
  from public.seller_accounts a where a.seller_id = p_seller
$$;
revoke execute on function public.commission_pct(uuid) from public, anon, authenticated;
grant execute on function public.commission_pct(uuid) to service_role;

-- Lo que puede ver cualquiera (landing, panel): el % y desde cuándo.
create or replace function public.pricing_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'commission_pct', (select value::numeric from public.app_settings where key = 'commission_pct'),
    'commission_from', (select value from public.app_settings where key = 'commission_from'))
$$;
revoke execute on function public.pricing_info() from public;
grant execute on function public.pricing_info() to anon, authenticated;

-- Comisión registrada en cada cobro (para el reporte del admin).
alter table public.orders add column fee_amount numeric(12,2) not null default 0;
alter table public.offers add column fee_amount numeric(12,2) not null default 0;

-- Cuentas nuevas: sin plan elegido (o «pase») → Gratis, activa. Básico/Tienda/Pro → 15 días de prueba.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p text := new.raw_user_meta_data ->> 'plan_elegido';
  chosen public.plan_kind := case when p in ('mensual', 'pro', 'tienda') then p::public.plan_kind else 'gratis' end;
begin
  insert into public.sellers (id) values (new.id);
  insert into public.seller_accounts (seller_id, email, plan, status, trial_ends_at)
  values (new.id, new.email, chosen,
    case when chosen = 'gratis' then 'activa'::public.account_status else 'prueba'::public.account_status end,
    case when chosen = 'gratis' then null else now() + interval '15 days' end);
  return new;
end $$;

create or replace function public.claim_initial_plan(p_plan text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); a public.seller_accounts; v text := case when p_plan = 'pase' then 'gratis' else p_plan end;
begin
  if uid is null or v not in ('gratis', 'mensual', 'pro', 'tienda') then return; end if;
  select * into a from public.seller_accounts where seller_id = uid for update;
  if not found or a.created_at < now() - interval '30 minutes' or a.plan::text = v then return; end if;
  if exists (select 1 from public.products where seller_id = uid) then return; end if;
  update public.seller_accounts set plan = v::public.plan_kind,
    status = case when v = 'gratis' then 'activa'::public.account_status else 'prueba'::public.account_status end,
    trial_ends_at = case when v = 'gratis' then null else a.created_at + interval '15 days' end
  where seller_id = uid;
end $$;

-- Quien tenía «Una sola cosa» pasa a Gratis.
update public.seller_accounts set plan = 'gratis', status = 'activa', trial_ends_at = null where plan = 'pase';

-- Vencimientos: Básico/Pro → Gratis (sin pausar). Tienda → 3 días de gracia → vencida (pausa).
create or replace function public.expire_plans() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.seller_accounts a set plan = 'gratis', status = 'activa', trial_ends_at = null, period_end = null
    where a.plan in ('mensual', 'pro') and a.status in ('prueba', 'activa', 'gracia') and public.plan_due(a) < now()
      and not public.is_demo_seller(a.seller_id);
  -- Si quedó algo pausado por un vencimiento anterior, vuelve.
  update public.products p set status = 'activa', paused_by_plan = false
    from public.seller_accounts a
    where a.seller_id = p.seller_id and a.plan = 'gratis' and p.paused_by_plan and p.status = 'pausada';
  update public.seller_accounts a set status = 'activa'
    where a.plan = 'gratis' and a.status in ('vencida', 'gracia');

  update public.seller_accounts a set status = 'gracia'
    where a.plan = 'tienda' and a.status in ('prueba', 'activa') and public.plan_due(a) < now() and not public.is_demo_seller(a.seller_id);
  for r in select a.seller_id from public.seller_accounts a
            where a.plan = 'tienda' and a.status = 'gracia' and public.plan_due(a) < now() - interval '3 days' and not public.is_demo_seller(a.seller_id)
            for update loop
    update public.seller_accounts set status = 'vencida' where seller_id = r.seller_id;
    update public.products set status = 'pausada', paused_by_plan = true where seller_id = r.seller_id and status = 'activa';
  end loop;
end $$;

-- Admin: también puede poner a alguien en Gratis.
create or replace function public.admin_seller_action(p_seller uuid, p_action text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.admin_guard(); prev jsonb;
begin
  select to_jsonb(a) - 'email' into prev from public.seller_accounts a where seller_id = p_seller;
  if prev is null then raise exception 'NO_ENCONTRADO'; end if;
  if p_action = 'plan' then
    if p_value not in ('gratis', 'mensual', 'pro', 'tienda') then raise exception 'DATOS'; end if;
    update public.seller_accounts set plan = p_value::public.plan_kind,
      status = case when p_value = 'gratis' then 'activa'::public.account_status else status end
      where seller_id = p_seller;
  elsif p_action = 'extender' then
    if p_value::int not between 1 and 90 then raise exception 'DATOS'; end if;
    update public.seller_accounts set status = 'prueba',
      trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_value::int)
      where seller_id = p_seller;
    update public.products set status = 'activa', paused_by_plan = false where seller_id = p_seller and paused_by_plan and status = 'pausada';
  elsif p_action = 'estado' then
    if p_value not in ('prueba', 'activa', 'suspendida') then raise exception 'DATOS'; end if;
    update public.seller_accounts set status = p_value::public.account_status where seller_id = p_seller;
  elsif p_action = 'pases' then
    if p_value::int not between 0 and 50 then raise exception 'DATOS'; end if;
    update public.seller_accounts set pass_credits = p_value::int where seller_id = p_seller;
  else
    raise exception 'DATOS';
  end if;
  insert into public.admin_log (admin_id, action, seller_id, detail)
  values (uid, p_action, p_seller, jsonb_build_object('valor', p_value, 'antes', prev - 'free_pass_used_at'));
end $$;

-- Admin: comisiones cobradas este mes (ventas con MP del plan Gratis).
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m timestamptz := date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires';
begin
  perform public.admin_guard();
  return jsonb_build_object(
    'sellers', (select count(*) from public.seller_accounts),
    'new_month', (select count(*) from public.seller_accounts where created_at >= m),
    'by_plan', (select jsonb_object_agg(plan, n) from (select plan, count(*) n from public.seller_accounts group by plan) x),
    'by_status', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.seller_accounts group by status) x),
    'trials_ending', (select count(*) from public.seller_accounts where status = 'prueba' and trial_ends_at between now() and now() + interval '3 days'),
    'mp_connected', (select count(*) from public.mp_connections),
    'products_active', (select count(*) from public.products where status = 'activa'),
    'products_paused_admin', (select count(*) from public.products where moderation = 'pausada'),
    'orders_month', (select count(*) from public.orders where created_at >= m),
    'orders_paid_month', (select count(*) from public.orders where created_at >= m and payment_status = 'pagado'),
    'sold_month', (select coalesce(sum(total), 0) from public.orders where created_at >= m and status in ('confirmado', 'entregado')),
    'offers_month', (select count(*) from public.offers where created_at >= m),
    'deals_month', (select count(*) from public.offers where created_at >= m and status in ('aceptada', 'vendida')),
    'fees_month', (select coalesce(sum(fee_amount), 0) from public.orders where paid_at >= m and payment_status = 'pagado')
                + (select coalesce(sum(fee_amount), 0) from public.offers where paid_at >= m and payment_status = 'pagado'),
    'plans_paid_month', (select coalesce(sum(paid_amount), 0) from public.plan_payments where paid_at >= m and status = 'pagado')
  );
end $$;
