-- =====================================================================
-- Promo por categoría: la categoría se compara sin mayúsculas, acentos ni espacios de más.
-- Los productos en liquidación nunca suman la promo (mantienen su precio de remate).
-- =====================================================================
create or replace function public.norm_text(t text) returns text
language sql immutable set search_path = '' as $$
  select lower(btrim(translate(coalesce(t, ''), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')))
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
    v_unit := case when v_pct is not null and not v_p.liquidation and (lower(v_scope) = 'todo' or public.norm_text(v_scope) = public.norm_text(v_p.collection))
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
