-- =====================================================================
-- Fase 3 (3/4) · Carrito y pedidos de la tienda
-- - El comprador (sin cuenta, con su buyer_token) arma un pedido. Precios y stock los decide el servidor.
-- - El stock queda reservado 24 h. Si el vendedor no lo confirma, vence solo y el stock vuelve.
-- - El vendedor confirma, marca entregado o cancela. El pago NO se marca a mano: payment_status
--   solo lo cambiará el webhook de Mercado Pago verificado por firma (fase 4).
-- =====================================================================

create type public.order_status as enum ('reservado', 'confirmado', 'entregado', 'cancelado', 'vencido');
create type public.payment_status as enum ('pendiente', 'pagado', 'reembolsado');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  buyer_token uuid not null,
  buyer_name text not null check (char_length(buyer_name) between 2 and 40),
  buyer_contact text not null check (buyer_contact ~ '^[0-9]{8,15}$'),
  delivery text not null check (delivery in ('retiro', 'envio')),
  address text check (char_length(address) <= 160),
  note text check (char_length(note) <= 300),
  subtotal integer not null check (subtotal > 0),
  shipping integer not null default 0 check (shipping >= 0),
  total integer not null check (total > 0),
  status public.order_status not null default 'reservado',
  payment_status public.payment_status not null default 'pendiente',
  cancelled_by text check (cancelled_by in ('comprador', 'vendedor', 'sistema')),
  expires_at timestamptz not null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_buyer_idx on public.orders (buyer_token, created_at desc);
create index orders_expiring_idx on public.orders (expires_at) where status = 'reservado';
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  title text not null,
  photo text,
  color text not null default '',
  size text not null default '',
  qty integer not null check (qty between 1 and 20),
  unit_price integer not null check (unit_price > 0)
);
create index order_items_order_idx on public.order_items (order_id);

-- Solo el vendedor dueño lee sus pedidos. Nadie escribe directo: todo pasa por funciones.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
create policy "orders: el vendedor ve los suyos" on public.orders for select to authenticated
  using (seller_id = (select auth.uid()));
create policy "order_items: el vendedor ve los suyos" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.seller_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- Stock: mueve una línea (resta al reservar, suma al liberar) y recalcula el total del producto.
-- ---------------------------------------------------------------------
create or replace function public.move_stock(p_product uuid, p_color text, p_size text, p_delta integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_has boolean;
begin
  select has_variants into v_has from public.products where id = p_product for update;
  if not found then return false; end if;
  if v_has then
    update public.product_variants set stock = stock + p_delta
      where product_id = p_product and color = coalesce(p_color, '') and size = coalesce(p_size, '') and stock + p_delta >= 0;
    if not found then return false; end if;
    update public.products set stock = (select coalesce(sum(stock), 0) from public.product_variants where product_id = p_product)
      where id = p_product;
  else
    update public.products set stock = stock + p_delta where id = p_product and stock + p_delta >= 0;
    if not found then return false; end if;
  end if;
  return true;
end $$;

create or replace function public.release_order_stock(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare it record;
begin
  for it in select product_id, color, size, qty from public.order_items where order_id = p_order and product_id is not null loop
    perform public.move_stock(it.product_id, it.color, it.size, it.qty);
  end loop;
end $$;

-- Vence los pedidos reservados que pasaron las 24 h (pg_cron cada minuto y antes de cada pedido nuevo).
create or replace function public.expire_orders() returns integer
language plpgsql security definer set search_path = '' as $$
declare o record; n integer := 0;
begin
  for o in select id from public.orders where status = 'reservado' and expires_at < now() for update skip locked loop
    update public.orders set status = 'vencido', cancelled_by = 'sistema', decided_at = now() where id = o.id;
    perform public.release_order_stock(o.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Lo que ve el comprador de su pedido (con los datos de la tienda para escribirle).
create or replace function public.order_public(p_order uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'status', o.status, 'payment_status', o.payment_status,
    'delivery', o.delivery, 'address', o.address, 'note', o.note,
    'subtotal', o.subtotal, 'shipping', o.shipping, 'total', o.total,
    'buyer_name', o.buyer_name, 'cancelled_by', o.cancelled_by,
    'expires_at', o.expires_at, 'created_at', o.created_at,
    'seller', jsonb_build_object('name', s.name, 'slug', s.slug, 'whatsapp', st.whatsapp, 'logo_url', st.logo_url,
      'color', st.color, 'address', st.address, 'hours', st.hours, 'shipping_note', st.shipping_note),
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'photo', i.photo, 'color', i.color,
      'size', i.size, 'qty', i.qty, 'unit_price', i.unit_price) order by i.title) from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o join public.sellers s on s.id = o.seller_id left join public.stores st on st.seller_id = o.seller_id
  where o.id = p_order
$$;

-- ---------------------------------------------------------------------
-- Comprador: confirmar el pedido
-- p_items = [{ "product_id": uuid, "color": "Negro", "size": "M", "qty": 2 }, ...]
-- ---------------------------------------------------------------------
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
    select id, title, list_price, photos, color_photos, status, mode, moderation into v_p
      from public.products where id = (it ->> 'product_id')::uuid and seller_id = p_seller;
    if not found then raise exception 'NO_DISPONIBLE: un producto'; end if;
    if v_p.status <> 'activa' or v_p.moderation <> 'ok' or v_p.mode <> 'fijo' then
      raise exception 'NO_DISPONIBLE: %', v_p.title;
    end if;
    if not public.move_stock(v_p.id, v_color, v_size, -v_qty) then
      raise exception 'SIN_STOCK: %', v_p.title || case when v_color <> '' or v_size <> '' then ' (' || btrim(v_color || ' ' || v_size) || ')' else '' end;
    end if;
    v_sub := v_sub + v_p.list_price * v_qty;
    v_lines := v_lines || jsonb_build_object('product_id', v_p.id, 'title', v_p.title,
      'photo', coalesce(v_p.color_photos -> v_color ->> 0, v_p.photos[1]),
      'color', v_color, 'size', v_size, 'qty', v_qty, 'unit_price', v_p.list_price);
  end loop;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when char_length(v_code) = 6 and not exists (select 1 from public.orders where code = v_code);
  end loop;

  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, address, note,
    subtotal, shipping, total, expires_at)
  values (v_code, p_seller, p_token, v_name, v_contact, p_delivery, case when p_delivery = 'envio' then v_address end, v_note,
    v_sub, 0, v_sub, now() + interval '24 hours')
  returning id into v_oid;

  insert into public.order_items (order_id, product_id, title, photo, color, size, qty, unit_price)
  select v_oid, (l ->> 'product_id')::uuid, l ->> 'title', l ->> 'photo', l ->> 'color', l ->> 'size',
         (l ->> 'qty')::integer, (l ->> 'unit_price')::integer
  from jsonb_array_elements(v_lines) l;

  return public.order_public(v_oid);
end $$;

-- Comprador: ver sus pedidos y cancelar uno reservado.
create or replace function public.get_my_orders(p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.expire_orders();
  return coalesce((select jsonb_agg(public.order_public(o.id) order by o.created_at desc)
    from (select id, created_at from public.orders where buyer_token = p_token order by created_at desc limit 30) o), '[]'::jsonb);
end $$;

create or replace function public.cancel_my_order(p_order uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.orders;
begin
  select * into v from public.orders where id = p_order and buyer_token = p_token for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
  if v.status <> 'reservado' then raise exception 'YA_NO_VALE'; end if;
  update public.orders set status = 'cancelado', cancelled_by = 'comprador', decided_at = now() where id = p_order;
  perform public.release_order_stock(p_order);
  return public.order_public(p_order);
end $$;

-- Vendedor: confirmar, marcar entregado o cancelar.
create or replace function public.seller_order_action(p_order uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.orders; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  perform public.expire_orders();
  select * into v from public.orders where id = p_order and seller_id = uid for update;
  if not found then raise exception 'NO_ENCONTRADO'; end if;
  if p_action = 'confirmar' and v.status = 'reservado' then
    update public.orders set status = 'confirmado', decided_at = now() where id = p_order;
  elsif p_action = 'entregado' and v.status in ('reservado', 'confirmado') then
    update public.orders set status = 'entregado', decided_at = now() where id = p_order;
  elsif p_action = 'cancelar' and v.status in ('reservado', 'confirmado') then
    update public.orders set status = 'cancelado', cancelled_by = 'vendedor', decided_at = now() where id = p_order;
    perform public.release_order_stock(p_order);
  else
    raise exception 'YA_NO_VALE';
  end if;
  return jsonb_build_object('id', p_order, 'status', (select status from public.orders where id = p_order));
end $$;

revoke execute on function public.move_stock(uuid, text, text, integer), public.release_order_stock(uuid),
  public.expire_orders(), public.order_public(uuid) from public, anon, authenticated;
revoke execute on function public.place_order(uuid, uuid, text, text, text, text, text, jsonb),
  public.get_my_orders(uuid), public.cancel_my_order(uuid, uuid), public.seller_order_action(uuid, text) from public;
grant execute on function public.place_order(uuid, uuid, text, text, text, text, text, jsonb),
  public.get_my_orders(uuid), public.cancel_my_order(uuid, uuid) to anon, authenticated;
grant execute on function public.seller_order_action(uuid, text) to authenticated;

select cron.schedule('vencer-pedidos', '* * * * *', $cron$ select public.expire_orders(); $cron$);

-- ---------------------------------------------------------------------
-- Aviso por email al vendedor cuando entra un pedido (Edge Function notify-order, una sola vez).
-- ---------------------------------------------------------------------
create table public.order_notifications (
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (order_id, kind)
);
alter table public.order_notifications enable row level security;
revoke all on public.order_notifications from anon, authenticated;

create or replace function public.notify_order_new() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  select value into base from public.app_settings where key = 'functions_url';
  if base is null then return new; end if;
  perform net.http_post(url := base || '/notify-order', body := jsonb_build_object('order_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 5000);
  return new;
end $$;
revoke execute on function public.notify_order_new() from public, anon, authenticated;
-- Después de insertar los ítems (la función los lee): se dispara al final de la transacción.
create constraint trigger orders_notify after insert on public.orders deferrable initially deferred
  for each row execute function public.notify_order_new();

-- «pedido» pasa a ser un link de la app (/pedido/:id).
alter table public.sellers drop constraint sellers_slug_no_reservado;
alter table public.sellers add constraint sellers_slug_no_reservado check (
  slug is null or slug::text not in ('panel', 'ingresar', 'demo', 'estado', 'assets', 'admin', 'api', 'ayuda', 'terminos',
    'privacidad', 'planes', 'precios', 'login', 'app', 'www', 'hacemeprecio', 'haceme-precio', 'soporte', 'contacto', 'baja',
    'arrepentimiento', 'pedido', 'pedidos')
);
