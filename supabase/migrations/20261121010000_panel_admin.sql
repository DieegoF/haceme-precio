-- =====================================================================
-- Panel de administración (solo cuentas con is_admin). Todo pasa por funciones que
-- verifican is_admin() y dejan registro de cada acción en admin_log.
-- =====================================================================
create table public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  action text not null,
  seller_id uuid,
  product_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

create or replace function public.admin_guard() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'SOLO_ADMIN'; end if;
  return auth.uid();
end $$;
revoke execute on function public.admin_guard() from public, anon;

-- Números generales
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
    'deals_month', (select count(*) from public.offers where created_at >= m and status in ('aceptada', 'vendida'))
  );
end $$;

-- Vendedores (con buscador por mail, nombre o link)
create or replace function public.admin_sellers(p_q text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select a.seller_id as id, a.email, s.name, s.slug, a.plan, a.status, a.trial_ends_at, a.created_at, a.is_admin,
      a.free_pass_used_at, a.pass_credits,
      exists (select 1 from public.mp_connections c where c.seller_id = a.seller_id) as mp,
      (select count(*) from public.products p where p.seller_id = a.seller_id and p.status = 'activa') as products,
      (select count(*) from public.orders o where o.seller_id = a.seller_id) as orders,
      (select coalesce(sum(total), 0) from public.orders o where o.seller_id = a.seller_id and o.status in ('confirmado', 'entregado')) as sold,
      (select count(*) from public.offers f where f.seller_id = a.seller_id) as offers
    from public.seller_accounts a join public.sellers s on s.id = a.seller_id
    where p_q is null or p_q = '' or a.email ilike '%' || p_q || '%' or s.name ilike '%' || p_q || '%' or s.slug::text ilike '%' || p_q || '%'
    order by a.created_at desc limit 300) x), '[]'::jsonb);
end $$;

-- Acciones sobre un vendedor: plan, prueba, estado
create or replace function public.admin_seller_action(p_seller uuid, p_action text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.admin_guard(); prev jsonb;
begin
  select to_jsonb(a) - 'email' into prev from public.seller_accounts a where seller_id = p_seller;
  if prev is null then raise exception 'NO_ENCONTRADO'; end if;
  if p_action = 'plan' then
    if p_value not in ('pase', 'mensual', 'pro', 'tienda') then raise exception 'DATOS'; end if;
    update public.seller_accounts set plan = p_value::public.plan_kind where seller_id = p_seller;
  elsif p_action = 'extender' then
    if p_value::int not between 1 and 90 then raise exception 'DATOS'; end if;
    update public.seller_accounts set status = 'prueba',
      trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => p_value::int)
      where seller_id = p_seller;
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

-- Publicaciones (las últimas, con buscador) y pausar/liberar por moderación
create or replace function public.admin_products(p_q text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select p.id, p.title, p.slug, p.status, p.moderation, p.mode, p.list_price, p.photos[1] as photo, p.created_at,
      s.name as seller, s.slug as seller_slug
    from public.products p join public.sellers s on s.id = p.seller_id
    where p_q is null or p_q = '' or p.title ilike '%' || p_q || '%' or s.name ilike '%' || p_q || '%' or s.slug::text ilike '%' || p_q || '%'
    order by p.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_product_action(p_product uuid, p_action text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.admin_guard(); v_seller uuid;
begin
  if p_action not in ('pausar', 'liberar') then raise exception 'DATOS'; end if;
  update public.products set moderation = case when p_action = 'pausar' then 'pausada' else 'ok' end
    where id = p_product returning seller_id into v_seller;
  if v_seller is null then raise exception 'NO_ENCONTRADO'; end if;
  insert into public.admin_log (admin_id, action, seller_id, product_id, detail)
  values (uid, p_action, v_seller, p_product, jsonb_build_object('motivo', left(coalesce(p_reason, ''), 200)));
end $$;

create or replace function public.admin_log_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select l.id, l.action, l.detail, l.created_at, a.email as seller_email, p.title as product
    from public.admin_log l left join public.seller_accounts a on a.seller_id = l.seller_id left join public.products p on p.id = l.product_id
    order by l.created_at desc limit 200) x), '[]'::jsonb);
end $$;

revoke execute on function public.admin_overview(), public.admin_sellers(text), public.admin_seller_action(uuid, text, text),
  public.admin_products(text), public.admin_product_action(uuid, text, text), public.admin_log_list() from public, anon;
grant execute on function public.admin_overview(), public.admin_sellers(text), public.admin_seller_action(uuid, text, text),
  public.admin_products(text), public.admin_product_action(uuid, text, text), public.admin_log_list() to authenticated;

-- Admin: Diego
update public.seller_accounts set is_admin = true where email = 'diegofernandez637@gmail.com';
