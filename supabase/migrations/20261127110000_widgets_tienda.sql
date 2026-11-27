-- =====================================================================
-- Widgets del panel (fase 2): métricas pro del modo Tienda.
-- store_insights(p_period): negociación, más vistos vs. vendidos, de dónde vienen y pedidos por estado.
-- Mismos períodos que store_metrics: 'hoy' | '7d' | 'mes'.
-- =====================================================================
create or replace function public.store_insights(p_period text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tz text := 'America/Argentina/Buenos_Aires';
  v_now timestamptz := now();
  v_start timestamptz; v_day date;
begin
  if uid is null then raise exception 'SIN_SESION'; end if;
  if p_period = 'hoy' then v_start := date_trunc('day', v_now at time zone tz) at time zone tz;
  elsif p_period = 'mes' then v_start := date_trunc('month', v_now at time zone tz) at time zone tz;
  else v_start := v_now - interval '7 days';
  end if;
  v_day := (v_start at time zone tz)::date;

  return jsonb_build_object(
    -- Negociación: ofertas recibidas, cuántas cerraron trato y el descuento promedio que se negoció.
    'negotiation', (select jsonb_build_object(
        'received', count(*),
        'accepted', count(*) filter (where o.status in ('aceptada', 'vendida')),
        'auto_stopped', count(*) filter (where o.status = 'rechazada_auto'),
        'avg_discount', coalesce(round(avg(100.0 * (1 - o.amount::numeric / p.list_price))
            filter (where o.status in ('aceptada', 'vendida') and p.list_price > 0)), 0)::integer)
      from public.offers o join public.products p on p.id = o.product_id
      where o.seller_id = uid and o.created_at >= v_start),
    -- Más vistos y cuánto se vendieron (pedidos confirmados/entregados + tratos vendidos).
    'products', coalesce((select jsonb_agg(t order by t.views desc, t.title) from (
        select p.id, p.title, p.photos[1] as photo, sum(v.visits)::integer as views,
          (coalesce((select sum(i.qty) from public.order_items i join public.orders o on o.id = i.order_id
              where i.product_id = p.id and o.created_at >= v_start and o.status in ('confirmado', 'entregado')), 0)
           + (select count(*) from public.offers f where f.product_id = p.id and f.status = 'vendida' and f.created_at >= v_start))::integer as sold
        from public.product_visits v join public.products p on p.id = v.product_id
        where v.seller_id = uid and v.day >= v_day
        group by p.id order by views desc limit 5) t), '[]'::jsonb),
    'sources', coalesce((select jsonb_object_agg(source, n) from (
        select source, sum(visits)::integer as n from public.visit_sources
        where seller_id = uid and day >= v_day group by source) s), '{}'::jsonb),
    'orders', coalesce((select jsonb_object_agg(status, n) from (
        select status::text, count(*)::integer as n from public.orders
        where seller_id = uid and created_at >= v_start group by status) s), '{}'::jsonb)
  );
end $$;
revoke execute on function public.store_insights(text) from public, anon;
grant execute on function public.store_insights(text) to authenticated;
