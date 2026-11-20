-- =====================================================================
-- Fase 3 (4/4) · Promos, envío gratis, preguntas frecuentes, visitas y métricas de la tienda
-- =====================================================================

-- 1) Promo, envío gratis y FAQ: los edita el dueño, con formato validado en la base.
create or replace function public.validate_store_extras() returns trigger
language plpgsql set search_path = '' as $$
declare q jsonb;
begin
  if new.promo is not null then
    if jsonb_typeof(new.promo) <> 'object'
       or char_length(coalesce(new.promo ->> 'text', '')) not between 3 and 60
       or (new.promo ->> 'ends_at') is null
       or (nullif(new.promo ->> 'pct', '') is not null and (new.promo ->> 'pct')::integer not between 5 and 70)
       or char_length(coalesce(new.promo ->> 'scope', '')) > 30 then
      raise exception 'PROMO_INVALIDA';
    end if;
    perform (new.promo ->> 'ends_at')::timestamptz;
  end if;
  if jsonb_typeof(new.faq) <> 'array' or jsonb_array_length(new.faq) > 10 then raise exception 'FAQ_INVALIDA'; end if;
  for q in select value from jsonb_array_elements(new.faq) loop
    if char_length(coalesce(q ->> 'q', '')) not between 3 and 120 or char_length(coalesce(q ->> 'a', '')) not between 1 and 500 then
      raise exception 'FAQ_INVALIDA';
    end if;
  end loop;
  return new;
end $$;
create trigger stores_validate_extras before insert or update on public.stores
  for each row execute function public.validate_store_extras();
grant update (promo, faq, free_ship_from) on public.stores to authenticated;

-- 2) El pedido guarda si tuvo envío gratis; place_order aplica la promo vigente.
alter table public.orders add column free_shipping boolean not null default false;

create or replace function public.order_public(p_order uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'status', o.status, 'payment_status', o.payment_status,
    'delivery', o.delivery, 'address', o.address, 'note', o.note,
    'subtotal', o.subtotal, 'shipping', o.shipping, 'total', o.total, 'free_shipping', o.free_shipping,
    'buyer_name', o.buyer_name, 'cancelled_by', o.cancelled_by,
    'expires_at', o.expires_at, 'created_at', o.created_at,
    'seller', jsonb_build_object('name', s.name, 'slug', s.slug, 'whatsapp', st.whatsapp, 'logo_url', st.logo_url,
      'color', st.color, 'address', st.address, 'hours', st.hours, 'shipping_note', st.shipping_note),
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'photo', i.photo, 'color', i.color,
      'size', i.size, 'qty', i.qty, 'unit_price', i.unit_price) order by i.title) from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o join public.sellers s on s.id = o.seller_id left join public.stores st on st.seller_id = o.seller_id
  where o.id = p_order
$$;

create or replace function public.place_order(p_seller uuid, p_token uuid, p_name text, p_contact text,
  p_delivery text, p_address text, p_note text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_contact text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
  v_address text := nullif(btrim(coalesce(p_address, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_is_store boolean; v_acc public.account_status; v_store public.stores;
  it jsonb; v_p record; v_qty integer; v_color text; v_size text;
  v_sub integer := 0; v_lines jsonb := '[]'::jsonb; v_oid uuid; v_code text;
  v_pct integer; v_scope text; v_unit integer; v_free boolean;
begin
  perform public.expire_orders();
  if p_token is null then raise exception 'DATOS'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then raise exception 'FALTA_NOMBRE'; end if;
  if v_contact !~ '^[0-9]{8,15}$' then raise exception 'FALTA_CONTACTO'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then raise exception 'CARRITO_VACIO'; end if;
  if jsonb_array_length(p_items) > 20 then raise exception 'CARRITO_GRANDE'; end if;

  select s.is_store, a.status into v_is_store, v_acc
    from public.sellers s join public.seller_accounts a on a.seller_id = s.id where s.id = p_seller;
  if not coalesce(v_is_store, false) then raise exception 'NO_TIENDA'; end if;
  if v_acc not in ('prueba', 'activa', 'gracia') then raise exception 'NO_DISPONIBLE'; end if;
  select * into v_store from public.stores where seller_id = p_seller and ready;
  if not found then raise exception 'NO_TIENDA'; end if;
  -- Promo vigente con descuento: la aplica el servidor (el navegador solo la muestra).
  if v_store.promo is not null and (v_store.promo ->> 'ends_at')::timestamptz > now() then
    v_pct := nullif(v_store.promo ->> 'pct', '')::integer;
    v_scope := coalesce(nullif(v_store.promo ->> 'scope', ''), 'Todo');
  end if;

  if p_delivery = 'retiro' and not v_store.pickup then raise exception 'ENTREGA'; end if;
  if p_delivery = 'envio' and not v_store.shipping_enabled then raise exception 'ENTREGA'; end if;
  if p_delivery not in ('retiro', 'envio') then raise exception 'ENTREGA'; end if;
  if p_delivery = 'envio' and char_length(coalesce(v_address, '')) < 6 then raise exception 'FALTA_DIRECCION'; end if;

  -- Freno anti-abuso: hasta 3 pedidos reservados a la vez por comprador y tienda.
  if (select count(*) from public.orders where buyer_token = p_token and seller_id = p_seller and status = 'reservado') >= 3 then
    raise exception 'MUCHOS_PEDIDOS';
  end if;

  for it in select value from jsonb_array_elements(p_items) loop
    v_qty := (it ->> 'qty')::integer;
    v_color := coalesce(it ->> 'color', ''); v_size := coalesce(it ->> 'size', '');
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'CANTIDAD'; end if;
    select id, title, list_price, photos, color_photos, status, mode, moderation, collection, liquidation into v_p
      from public.products where id = (it ->> 'product_id')::uuid and seller_id = p_seller;
    if not found then raise exception 'NO_DISPONIBLE: un producto'; end if;
    if v_p.status <> 'activa' or v_p.moderation <> 'ok' or v_p.mode <> 'fijo' then
      raise exception 'NO_DISPONIBLE: %', v_p.title;
    end if;
    if not public.move_stock(v_p.id, v_color, v_size, -v_qty) then
      raise exception 'SIN_STOCK: %', v_p.title || case when v_color <> '' or v_size <> '' then ' (' || btrim(v_color || ' ' || v_size) || ')' else '' end;
    end if;
    v_unit := case when v_pct is not null and not v_p.liquidation and (v_scope = 'Todo' or v_scope = v_p.collection)
      then round(v_p.list_price * (100 - v_pct) / 100.0)::integer else v_p.list_price end;
    v_sub := v_sub + v_unit * v_qty;
    v_lines := v_lines || jsonb_build_object('product_id', v_p.id, 'title', v_p.title,
      'photo', coalesce(v_p.color_photos -> v_color ->> 0, v_p.photos[1]),
      'color', v_color, 'size', v_size, 'qty', v_qty, 'unit_price', v_unit);
  end loop;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when char_length(v_code) = 6 and not exists (select 1 from public.orders where code = v_code);
  end loop;

  v_free := p_delivery = 'envio' and v_store.free_ship_from is not null and v_sub >= v_store.free_ship_from;
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, address, note,
    subtotal, shipping, total, free_shipping, expires_at)
  values (v_code, p_seller, p_token, v_name, v_contact, p_delivery, case when p_delivery = 'envio' then v_address end, v_note,
    v_sub, 0, v_sub, v_free, now() + interval '24 hours')
  returning id into v_oid;

  insert into public.order_items (order_id, product_id, title, photo, color, size, qty, unit_price)
  select v_oid, (l ->> 'product_id')::uuid, l ->> 'title', l ->> 'photo', l ->> 'color', l ->> 'size',
         (l ->> 'qty')::integer, (l ->> 'unit_price')::integer
  from jsonb_array_elements(v_lines) l;

  return public.order_public(v_oid);
end $$;

-- 3) Visitas a la tienda (una por sesión del navegador; solo cuenta, no guarda quién).
create table public.store_visits (
  seller_id uuid not null references public.sellers (id) on delete cascade,
  day date not null,
  visits integer not null default 0,
  primary key (seller_id, day)
);
alter table public.store_visits enable row level security;
revoke all on public.store_visits from anon, authenticated;

create or replace function public.track_visit(p_seller uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.sellers where id = p_seller and is_store) then return; end if;
  insert into public.store_visits (seller_id, day, visits)
  values (p_seller, (now() at time zone 'America/Argentina/Buenos_Aires')::date, 1)
  on conflict (seller_id, day) do update set visits = public.store_visits.visits + 1;
end $$;
revoke execute on function public.track_visit(uuid) from public;
grant execute on function public.track_visit(uuid) to anon, authenticated;

-- 4) Métricas del vendedor: 'hoy' | '7d' | 'mes', comparadas con el período anterior.
create or replace function public.store_metrics(p_period text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tz text := 'America/Argentina/Buenos_Aires';
  v_now timestamptz := now();
  v_start timestamptz; v_len interval; v_pstart timestamptz; v_pend timestamptz;
  res jsonb;
begin
  if uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if p_period = 'hoy' then v_start := date_trunc('day', v_now at time zone tz) at time zone tz; v_len := interval '1 day';
  elsif p_period = 'mes' then v_start := date_trunc('month', v_now at time zone tz) at time zone tz; v_len := interval '1 month';
  else v_start := v_now - interval '7 days'; v_len := interval '7 days';
  end if;
  v_pstart := v_start - v_len; v_pend := v_pstart + (v_now - v_start);

  with cur as (select * from public.orders where seller_id = uid and created_at >= v_start),
       sold as (select * from cur where status in ('confirmado', 'entregado')),
       prev as (select * from public.orders where seller_id = uid and created_at >= v_pstart and created_at < v_pend and status in ('confirmado', 'entregado'))
  select jsonb_build_object(
    'sold', coalesce((select sum(total) from sold), 0),
    'sold_orders', (select count(*) from sold),
    'prev_sold', coalesce((select sum(total) from prev), 0),
    'orders', (select count(*) from cur),
    'pending', (select count(*) from public.orders where seller_id = uid and status = 'reservado' and expires_at > v_now),
    'avg_ticket', coalesce((select round(avg(total))::integer from sold), 0),
    'visits', coalesce((select sum(visits) from public.store_visits where seller_id = uid and day >= (v_start at time zone tz)::date), 0),
    'prev_visits', coalesce((select sum(visits) from public.store_visits where seller_id = uid
        and day >= (v_pstart at time zone tz)::date and day < (v_start at time zone tz)::date), 0),
    'top', coalesce((select jsonb_agg(t) from (
        select i.title, sum(i.qty)::integer as units, sum(i.qty * i.unit_price)::integer as amount
        from public.order_items i join sold o on o.id = i.order_id
        group by i.product_id, i.title order by units desc, amount desc limit 3) t), '[]'::jsonb),
    'low_stock', coalesce((select jsonb_agg(l) from (
        select p.id, p.title, v.color, v.size, v.stock
          from public.products p join public.product_variants v on v.product_id = p.id
          where p.seller_id = uid and p.status = 'activa' and p.mode = 'fijo' and p.has_variants and v.stock <= 3
        union all
        select p.id, p.title, '' as color, '' as size, p.stock
          from public.products p
          where p.seller_id = uid and p.status = 'activa' and p.mode = 'fijo' and not p.has_variants and p.stock <= 3
        order by stock, title limit 8) l), '[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke execute on function public.store_metrics(text) from public, anon;
grant execute on function public.store_metrics(text) to authenticated;
