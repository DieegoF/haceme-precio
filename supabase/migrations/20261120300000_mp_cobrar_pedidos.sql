-- =====================================================================
-- Fase 4 (2) · Cobrar pedidos de tienda con Mercado Pago (API de Orders)
-- - Si la tienda tiene MP conectado, el pedido es «pay_mode = mp»: reserva de stock 30 min.
-- - El pago lo confirma SOLO el servidor, consultando la order a MP con el token del vendedor
--   (webhook o sincronización), nunca el navegador ni una captura.
-- =====================================================================
alter table public.orders
  add column pay_mode text not null default 'acordar' check (pay_mode in ('acordar', 'mp')),
  add column mp_order_id text unique,
  add column mp_checkout_url text,
  add column paid_at timestamptz,
  add column paid_amount numeric(12, 2);

-- La vidriera muestra si la tienda cobra con MP (sin exponer nada de la conexión).
alter table public.stores add column accepts_mp boolean not null default false;
revoke insert (accepts_mp), update (accepts_mp) on public.stores from authenticated, anon;
create or replace function public.sync_accepts_mp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.stores set accepts_mp = (tg_op <> 'DELETE')
    where seller_id = coalesce(new.seller_id, old.seller_id);
  return null;
end $$;
revoke execute on function public.sync_accepts_mp() from public, anon, authenticated;
create trigger mp_connections_accepts after insert or delete on public.mp_connections
  for each row execute function public.sync_accepts_mp();
update public.stores st set accepts_mp = exists (select 1 from public.mp_connections c where c.seller_id = st.seller_id);

-- Pedido nuevo: con MP conectado, reserva 30 min y queda esperando el pago.
create or replace function public.order_set_pay_mode() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.mp_connections where seller_id = new.seller_id) then
    new.pay_mode := 'mp';
    new.expires_at := least(new.expires_at, now() + interval '30 minutes');
  end if;
  return new;
end $$;
revoke execute on function public.order_set_pay_mode() from public, anon, authenticated;
create trigger orders_pay_mode before insert on public.orders
  for each row execute function public.order_set_pay_mode();

-- Marca pagado (lo llaman solo las Edge Functions con service role, después de consultar a MP).
-- Si el pedido ya había vencido o se había cancelado, intenta volver a tomar el stock;
-- si no hay, queda «pagado» pero cancelado → el vendedor tiene que devolver el dinero.
create or replace function public.mark_order_paid(p_order uuid, p_mp_order text, p_amount numeric) returns text
language plpgsql security definer set search_path = '' as $$
declare v public.orders; it record; ok boolean := true;
begin
  select * into v from public.orders where id = p_order for update;
  if not found then return 'NO_ENCONTRADO'; end if;
  if v.mp_order_id is distinct from p_mp_order then return 'OTRA_ORDER'; end if;
  if v.payment_status = 'pagado' then return 'YA_PAGADO'; end if;
  if p_amount < v.total then return 'MONTO_INSUFICIENTE'; end if;
  if v.status in ('vencido', 'cancelado') then
    for it in select product_id, color, size, qty from public.order_items where order_id = p_order and product_id is not null loop
      if not public.move_stock(it.product_id, it.color, it.size, -it.qty) then ok := false; end if;
    end loop;
    if not ok then
      perform public.release_order_stock(p_order); -- deshace lo que sí tomó
      update public.orders set payment_status = 'pagado', paid_at = now(), paid_amount = p_amount where id = p_order;
      return 'PAGADO_SIN_STOCK';
    end if;
  end if;
  update public.orders set payment_status = 'pagado', paid_at = now(), paid_amount = p_amount,
    status = case when status in ('reservado', 'vencido', 'cancelado') then 'confirmado' else status end,
    cancelled_by = case when status in ('vencido', 'cancelado') then null else cancelled_by end,
    decided_at = now()
  where id = p_order;
  return 'PAGADO';
end $$;
revoke execute on function public.mark_order_paid(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, numeric) to service_role;

-- Lo que ve el comprador: también cómo se paga y si ya está pagado.
create or replace function public.order_public(p_order uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'status', o.status, 'payment_status', o.payment_status, 'pay_mode', o.pay_mode,
    'delivery', o.delivery, 'address', o.address, 'note', o.note,
    'subtotal', o.subtotal, 'shipping', o.shipping, 'total', o.total, 'free_shipping', o.free_shipping,
    'buyer_name', o.buyer_name, 'cancelled_by', o.cancelled_by,
    'expires_at', o.expires_at, 'created_at', o.created_at, 'paid_at', o.paid_at,
    'seller', jsonb_build_object('name', s.name, 'slug', s.slug, 'whatsapp', st.whatsapp, 'logo_url', st.logo_url,
      'color', st.color, 'address', st.address, 'hours', st.hours, 'shipping_note', st.shipping_note),
    'items', coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'photo', i.photo, 'color', i.color,
      'size', i.size, 'qty', i.qty, 'unit_price', i.unit_price) order by i.title) from public.order_items i where i.order_id = o.id), '[]'::jsonb))
  from public.orders o join public.sellers s on s.id = o.seller_id left join public.stores st on st.seller_id = o.seller_id
  where o.id = p_order
$$;
