-- =====================================================================
-- Fase 2 · Motor de ofertas (todo en el servidor)
-- * El comprador no tiene cuenta: se identifica con un token aleatorio que guarda su navegador.
-- * Nadie escribe la tabla offers directo: solo por estas funciones (security definer),
--   que aplican las reglas privadas sin devolverlas nunca.
-- Estados: pendiente (15 min) · contraoferta (10 min) · aceptada (12 h para cerrar)
--          · vendida · rechazada_auto · rechazada · expirada · cancelada
-- =====================================================================

create type public.offer_status as enum ('pendiente', 'contraoferta', 'aceptada', 'vendida', 'rechazada_auto', 'rechazada', 'expirada', 'cancelada');

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  buyer_token uuid not null,
  buyer_name text not null check (char_length(buyer_name) between 2 and 40),
  buyer_contact text not null check (buyer_contact ~ '^[0-9]{8,15}$'),
  amount integer not null check (amount > 0),
  attempt smallint not null check (attempt between 1 and 2),
  status public.offer_status not null,
  reason text,
  suggested_amount integer,
  counter_amount integer,
  expires_at timestamptz,
  close_by timestamptz,
  decided_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index offers_seller_idx on public.offers (seller_id, created_at desc);
create index offers_product_buyer_idx on public.offers (product_id, buyer_token);
create index offers_open_idx on public.offers (status, expires_at) where status in ('pendiente', 'contraoferta', 'aceptada');
-- Un solo trato aceptado a la vez por producto (evita la doble venta).
create unique index offers_one_deal_per_product on public.offers (product_id) where status = 'aceptada';

alter table public.offers enable row level security;
revoke all on public.offers from anon, authenticated;   -- sin acceso directo: solo por funciones

-- Vence lo que pasó su tiempo. La llama pg_cron cada minuto y también cada función antes de decidir.
create or replace function public.expire_offers() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.offers set status = 'expirada', decided_at = coalesce(decided_at, now())
  where (status in ('pendiente', 'contraoferta') and expires_at < now())
     or (status = 'aceptada' and close_by < now());
  get diagnostics n = row_count;
  return n;
end $$;

-- Lo que devuelve al comprador: nunca el mínimo ni el % de venta automática.
create or replace function public.offer_public(o public.offers) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'amount', o.amount, 'attempt', o.attempt, 'status', o.status,
    'suggested_amount', o.suggested_amount, 'counter_amount', o.counter_amount,
    'expires_at', o.expires_at, 'close_by', o.close_by, 'created_at', o.created_at)
$$;

-- ---------------------------------------------------------------------
-- Comprador: hacer una oferta
-- ---------------------------------------------------------------------
create or replace function public.submit_offer(p_product uuid, p_token uuid, p_name text, p_contact text, p_amount integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_seller uuid; v_list integer; v_status public.product_status; v_mode public.sale_mode; v_mod text; v_acc public.account_status;
  v_floor integer; v_pct integer; v_used integer; v_active integer; v_recent integer;
  v_st public.offer_status; v_sug integer; v_exp timestamptz; v_close timestamptz; v_reason text; o public.offers;
begin
  p_name := left(btrim(coalesce(p_name, '')), 40);
  p_contact := regexp_replace(coalesce(p_contact, ''), '\D', '', 'g');
  if p_token is null then raise exception 'SIN_TOKEN'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'OFERTA_INVALIDA'; end if;
  if char_length(p_name) < 2 then raise exception 'FALTA_NOMBRE'; end if;
  if char_length(p_contact) not between 8 and 15 then raise exception 'FALTA_CONTACTO'; end if;

  perform public.expire_offers();

  select p.seller_id, p.list_price, p.status, p.mode, p.moderation, a.status
    into v_seller, v_list, v_status, v_mode, v_mod, v_acc
  from public.products p join public.seller_accounts a on a.seller_id = p.seller_id
  where p.id = p_product for update of p;   -- serializa ofertas del mismo producto
  if not found or v_status <> 'activa' or v_mod <> 'ok' or v_acc not in ('prueba', 'activa', 'gracia') then raise exception 'NO_DISPONIBLE'; end if;
  if v_mode <> 'oferta' then raise exception 'PRECIO_FIJO'; end if;

  select count(*) into v_recent from public.offers where buyer_token = p_token and created_at > now() - interval '1 hour';
  if v_recent >= 20 then raise exception 'DEMASIADAS'; end if;
  select count(*), count(*) filter (where status in ('pendiente', 'contraoferta', 'aceptada'))
    into v_used, v_active from public.offers where product_id = p_product and buyer_token = p_token;
  if v_active > 0 then raise exception 'YA_TENES_UNA'; end if;
  if v_used >= 2 then raise exception 'SIN_INTENTOS'; end if;
  if exists (select 1 from public.offers where product_id = p_product and status = 'aceptada') then raise exception 'TRATO_EN_CURSO'; end if;

  if p_amount > v_list then p_amount := v_list; end if;
  select r.floor_price, r.auto_accept_pct into v_floor, v_pct from public.product_rules r where r.product_id = p_product;

  if v_pct is not null and p_amount >= ceil(v_list * v_pct / 100.0) then
    v_st := 'aceptada'; v_close := now() + interval '12 hours'; v_reason := 'auto';
  elsif v_floor is not null and p_amount < v_floor then
    v_st := 'rechazada_auto'; v_reason := 'bajo_minimo';
    v_sug := least(v_list, (ceil(v_floor * 1.03 / 1000.0) * 1000)::integer);   -- orienta sin mostrar el mínimo exacto
  else
    v_st := 'pendiente'; v_exp := now() + interval '15 minutes';
  end if;

  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason,
    suggested_amount, expires_at, close_by, decided_at)
  values (p_product, v_seller, p_token, p_name, p_contact, p_amount, v_used + 1, v_st, v_reason, v_sug, v_exp, v_close,
    case when v_st <> 'pendiente' then now() end)
  returning * into o;
  return public.offer_public(o) || jsonb_build_object('attempts_left', 2 - o.attempt);
end $$;

-- Comprador: ver sus ofertas de un producto (con su token).
create or replace function public.get_my_offers(p_product uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.expire_offers();
  return coalesce((
    select jsonb_agg(public.offer_public(o) order by o.created_at desc)
    from public.offers o where o.product_id = p_product and o.buyer_token = p_token), '[]'::jsonb);
end $$;

-- Comprador: responder una contraoferta.
create or replace function public.answer_counter(p_offer uuid, p_token uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.offers;
begin
  perform public.expire_offers();
  select * into o from public.offers where id = p_offer and buyer_token = p_token for update;
  if not found then raise exception 'NO_ENCONTRADA'; end if;
  if o.status <> 'contraoferta' then raise exception 'YA_NO_VALE'; end if;
  if p_accept then
    if exists (select 1 from public.offers where product_id = o.product_id and status = 'aceptada') then raise exception 'TRATO_EN_CURSO'; end if;
    update public.offers set status = 'aceptada', amount = counter_amount, close_by = now() + interval '12 hours', decided_at = now(), reason = 'contraoferta_aceptada'
    where id = p_offer returning * into o;
  else
    update public.offers set status = 'rechazada', decided_at = now(), reason = 'comprador_rechazo' where id = p_offer returning * into o;
  end if;
  return public.offer_public(o);
end $$;

-- ---------------------------------------------------------------------
-- Vendedor: bandeja (el contacto del comprador se muestra recién cuando hay trato)
-- ---------------------------------------------------------------------
create or replace function public.get_seller_offers()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIN_SESION'; end if;
  perform public.expire_offers();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'product_id', o.product_id, 'product_title', p.title, 'product_slug', p.slug, 'product_photo', p.photos[1],
      'list_price', p.list_price, 'floor_price', r.floor_price, 'amount', o.amount, 'attempt', o.attempt, 'status', o.status,
      'reason', o.reason, 'counter_amount', o.counter_amount, 'expires_at', o.expires_at, 'close_by', o.close_by,
      'created_at', o.created_at, 'decided_at', o.decided_at, 'buyer_name', o.buyer_name,
      'buyer_contact', case when o.status in ('aceptada', 'vendida') then o.buyer_contact end
    ) order by o.created_at desc)
    from public.offers o join public.products p on p.id = o.product_id left join public.product_rules r on r.product_id = o.product_id
    where o.seller_id = uid and o.created_at > now() - interval '60 days'), '[]'::jsonb);
end $$;

-- Vendedor: aceptar · rechazar · contraofertar · vendido (cerrado) · liberar (se cayó)
create or replace function public.seller_offer_action(p_offer uuid, p_action text, p_counter integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); o public.offers; v_list integer; v_stock integer;
begin
  if uid is null then raise exception 'SIN_SESION'; end if;
  perform public.expire_offers();
  select * into o from public.offers where id = p_offer and seller_id = uid for update;
  if not found then raise exception 'NO_ENCONTRADA'; end if;
  select list_price into v_list from public.products where id = o.product_id for update;

  if p_action = 'aceptar' then
    if o.status <> 'pendiente' then raise exception 'YA_NO_VALE'; end if;
    if exists (select 1 from public.offers where product_id = o.product_id and status = 'aceptada') then raise exception 'TRATO_EN_CURSO'; end if;
    update public.offers set status = 'aceptada', close_by = now() + interval '12 hours', decided_at = now(), reason = 'vendedor' where id = o.id returning * into o;
  elsif p_action = 'rechazar' then
    if o.status <> 'pendiente' then raise exception 'YA_NO_VALE'; end if;
    update public.offers set status = 'rechazada', decided_at = now(), reason = 'vendedor' where id = o.id returning * into o;
  elsif p_action = 'contraofertar' then
    if o.status <> 'pendiente' then raise exception 'YA_NO_VALE'; end if;
    if p_counter is null or p_counter <= o.amount or p_counter > v_list then raise exception 'CONTRA_INVALIDA'; end if;
    update public.offers set status = 'contraoferta', counter_amount = p_counter, expires_at = now() + interval '10 minutes', decided_at = now()
    where id = o.id returning * into o;
  elsif p_action = 'vendido' then
    if o.status <> 'aceptada' then raise exception 'YA_NO_VALE'; end if;
    update public.offers set status = 'vendida', closed_at = now() where id = o.id returning * into o;
    update public.products set stock = greatest(stock - 1, 0) where id = o.product_id returning stock into v_stock;
    if v_stock = 0 then
      update public.products set status = 'vendida' where id = o.product_id;
      update public.offers set status = 'rechazada', decided_at = now(), reason = 'vendido_a_otro'
      where product_id = o.product_id and status in ('pendiente', 'contraoferta');
    end if;
  elsif p_action = 'liberar' then
    if o.status <> 'aceptada' then raise exception 'YA_NO_VALE'; end if;
    update public.offers set status = 'cancelada', closed_at = now(), reason = 'se_cayo' where id = o.id returning * into o;
  else
    raise exception 'ACCION_INVALIDA';
  end if;
  return public.offer_public(o);
end $$;

-- Permisos de las funciones
revoke execute on function public.expire_offers() from public, anon, authenticated;
revoke execute on function public.offer_public(public.offers) from public, anon, authenticated;
revoke execute on function public.submit_offer(uuid, uuid, text, text, integer) from public;
revoke execute on function public.get_my_offers(uuid, uuid) from public;
revoke execute on function public.answer_counter(uuid, uuid, boolean) from public;
revoke execute on function public.get_seller_offers() from public, anon;
revoke execute on function public.seller_offer_action(uuid, text, integer) from public, anon;
grant execute on function public.submit_offer(uuid, uuid, text, text, integer) to anon, authenticated;
grant execute on function public.get_my_offers(uuid, uuid) to anon, authenticated;
grant execute on function public.answer_counter(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.get_seller_offers() to authenticated;
grant execute on function public.seller_offer_action(uuid, text, integer) to authenticated;

-- Vencimientos automáticos cada minuto
create extension if not exists pg_cron;
select cron.schedule('expirar-ofertas', '* * * * *', $cron$ select public.expire_offers(); $cron$);
