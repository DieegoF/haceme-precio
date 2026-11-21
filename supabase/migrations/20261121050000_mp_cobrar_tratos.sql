-- =====================================================================
-- Fase 4 (3) · Cobrar tratos de ofertas con Mercado Pago
-- Cuando una oferta queda «aceptada» y el vendedor tiene MP conectado, el comprador paga el precio
-- acordado. Solo el servidor (consultando la order a MP) marca el pago: el trato pasa a «vendida»,
-- se descuenta stock y se cierran las demás ofertas del producto si no queda.
-- =====================================================================
alter table public.offers
  add column payment_status public.payment_status not null default 'pendiente',
  add column mp_order_id text unique,
  add column mp_checkout_url text,
  add column paid_at timestamptz,
  add column paid_amount numeric(12, 2);

-- Lo que ve el comprador: también si puede pagar con MP y si ya está pagado.
create or replace function public.offer_public(o public.offers) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', o.id, 'amount', o.amount, 'attempt', o.attempt, 'status', o.status,
    'suggested_amount', o.suggested_amount, 'counter_amount', o.counter_amount,
    'expires_at', o.expires_at, 'close_by', o.close_by, 'created_at', o.created_at,
    'payment_status', o.payment_status, 'paid_at', o.paid_at,
    'can_pay_mp', exists (select 1 from public.mp_connections c where c.seller_id = o.seller_id))
$$;
revoke execute on function public.offer_public(public.offers) from public, anon, authenticated;

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
      'buyer_contact', case when o.status in ('contraoferta', 'aceptada', 'vendida') then o.buyer_contact end,
      'payment_status', o.payment_status, 'can_pay_mp', exists (select 1 from public.mp_connections c where c.seller_id = o.seller_id)
    ) order by o.created_at desc)
    from public.offers o join public.products p on p.id = o.product_id left join public.product_rules r on r.product_id = o.product_id
    where o.seller_id = uid and o.created_at > now() - interval '60 days'), '[]'::jsonb);
end $$;

-- Marca pagado (solo Edge Functions con service role, después de consultar a MP).
create or replace function public.mark_offer_paid(p_offer uuid, p_mp_order text, p_amount numeric) returns text
language plpgsql security definer set search_path = '' as $$
declare o public.offers; v_stock integer;
begin
  select * into o from public.offers where id = p_offer for update;
  if not found then return 'NO_ENCONTRADA'; end if;
  if o.mp_order_id is distinct from p_mp_order then return 'OTRA_ORDER'; end if;
  if o.payment_status = 'pagado' then return 'YA_PAGADO'; end if;
  if p_amount < o.amount then return 'MONTO_INSUFICIENTE'; end if;
  if o.status <> 'aceptada' then
    -- Pagó fuera de término (el trato ya había vencido o se cayó): queda registrado para que el vendedor resuelva.
    update public.offers set payment_status = 'pagado', paid_at = now(), paid_amount = p_amount where id = p_offer;
    return 'PAGADO_FUERA_DE_TERMINO';
  end if;
  update public.offers set payment_status = 'pagado', paid_at = now(), paid_amount = p_amount, status = 'vendida', closed_at = now()
    where id = p_offer;
  update public.products set stock = greatest(stock - 1, 0) where id = o.product_id returning stock into v_stock;
  if v_stock = 0 then
    update public.products set status = 'vendida' where id = o.product_id;
    update public.offers set status = 'rechazada', decided_at = now(), reason = 'vendido_a_otro'
      where product_id = o.product_id and status in ('pendiente', 'contraoferta');
  end if;
  return 'PAGADO';
end $$;
revoke execute on function public.mark_offer_paid(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.mark_offer_paid(uuid, text, numeric) to service_role;
