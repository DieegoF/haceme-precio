-- =====================================================================
-- Reseñas: el comprador califica al vendedor (1 a 5 estrellas y un comentario corto).
-- - Solo quien compró de verdad: trato «vendida» o pedido «entregado», con su buyer_token.
-- - Una reseña por trato o pedido, dentro de los 60 días.
-- - Públicas: promedio, cantidad y las últimas. El buyer_token nunca se muestra.
-- - El admin puede ocultar una reseña.
-- - En la demo se puede calificar, pero sin comentario (nada de texto público de visitantes).
-- =====================================================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  offer_id uuid unique references public.offers (id) on delete cascade,
  order_id uuid unique references public.orders (id) on delete cascade,
  buyer_name text not null,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 280),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check ((offer_id is null) <> (order_id is null))
);
create index reviews_seller on public.reviews (seller_id, created_at desc);
alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated; -- se lee y se escribe solo por las funciones de abajo

-- ¿Este comprador puede calificar este trato o pedido? Devuelve también su reseña si ya la dejó.
create or replace function public.review_status(p_kind text, p_id uuid, p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare ok boolean := false; r public.reviews; s text;
begin
  if p_kind = 'oferta' then
    select true, sl.name into ok, s from public.offers o join public.sellers sl on sl.id = o.seller_id
      where o.id = p_id and o.buyer_token = p_token and o.status = 'vendida' and coalesce(o.decided_at, o.created_at) > now() - interval '60 days';
    select * into r from public.reviews where offer_id = p_id;
  elsif p_kind = 'pedido' then
    select true, sl.name into ok, s from public.orders o join public.sellers sl on sl.id = o.seller_id
      where o.id = p_id and o.buyer_token = p_token and o.status = 'entregado' and coalesce(o.decided_at, o.created_at) > now() - interval '60 days';
    select * into r from public.reviews where order_id = p_id;
  end if;
  return jsonb_build_object('can', coalesce(ok, false) and r.id is null, 'seller_name', s,
    'review', case when r.id is null then null else jsonb_build_object('stars', r.stars, 'comment', r.comment) end);
end $$;

create or replace function public.submit_review(p_kind text, p_id uuid, p_token uuid, p_stars int, p_comment text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_seller uuid; v_product uuid; v_name text; v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if p_stars not between 1 and 5 then raise exception 'DATOS'; end if;
  if char_length(v_comment) > 280 then raise exception 'COMENTARIO_LARGO'; end if;
  if p_kind = 'oferta' then
    select o.seller_id, o.product_id, o.buyer_name into v_seller, v_product, v_name from public.offers o
      where o.id = p_id and o.buyer_token = p_token and o.status = 'vendida' and coalesce(o.decided_at, o.created_at) > now() - interval '60 days';
  elsif p_kind = 'pedido' then
    select o.seller_id, (select i.product_id from public.order_items i where i.order_id = o.id and i.product_id is not null limit 1), o.buyer_name
      into v_seller, v_product, v_name from public.orders o
      where o.id = p_id and o.buyer_token = p_token and o.status = 'entregado' and coalesce(o.decided_at, o.created_at) > now() - interval '60 days';
  end if;
  if v_seller is null then raise exception 'NO_SE_PUEDE'; end if;
  if public.is_demo_seller(v_seller) then v_comment := null; end if;
  insert into public.reviews (seller_id, product_id, offer_id, order_id, buyer_name, stars, comment)
  values (v_seller, v_product, case when p_kind = 'oferta' then p_id end, case when p_kind = 'pedido' then p_id end,
    split_part(btrim(v_name), ' ', 1), p_stars, v_comment)
  on conflict do nothing;
  if not found then raise exception 'YA_CALIFICADO'; end if;
  return jsonb_build_object('stars', p_stars, 'comment', v_comment);
end $$;

-- Público: resumen y últimas reseñas visibles de un vendedor.
create or replace function public.seller_reviews(p_seller uuid, p_limit int default 10) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'count', (select count(*) from public.reviews r where r.seller_id = p_seller and not r.hidden),
    'avg', (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.seller_id = p_seller and not r.hidden),
    'items', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select r.id, r.buyer_name, r.stars, r.comment, r.created_at, p.title as product_title
      from public.reviews r left join public.products p on p.id = r.product_id
      where r.seller_id = p_seller and not r.hidden order by r.created_at desc limit least(greatest(p_limit, 1), 30)) x), '[]'::jsonb))
$$;

-- Admin: ocultar o volver a mostrar una reseña (queda en el registro).
create or replace function public.admin_review_action(p_review uuid, p_hide boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  update public.reviews set hidden = p_hide where id = p_review;
  insert into public.admin_log (admin_id, action, seller_id, detail)
  select auth.uid(), case when p_hide then 'ocultar_resena' else 'mostrar_resena' end, r.seller_id, jsonb_build_object('review', r.id, 'stars', r.stars)
  from public.reviews r where r.id = p_review;
end $$;

revoke execute on function public.review_status(text, uuid, uuid), public.submit_review(text, uuid, uuid, int, text),
  public.seller_reviews(uuid, int), public.admin_review_action(uuid, boolean) from public;
grant execute on function public.review_status(text, uuid, uuid), public.submit_review(text, uuid, uuid, int, text),
  public.seller_reviews(uuid, int) to anon, authenticated;
grant execute on function public.admin_review_action(uuid, boolean) to authenticated;

-- Demo: después del reseteo, unas reseñas de ejemplo (atadas a un pedido entregado y a un trato vendido).
alter function public.demo_reset() rename to demo_reset_base;
create or replace function public.demo_reset() returns void
language plpgsql security definer set search_path = '' as $$
declare t uuid; v uuid; o uuid; p uuid;
  px text := 'https://images.pexels.com/photos/%s/pexels-photo-%s.jpeg?auto=compress&cs=tinysrgb&w=1000';
begin
  perform public.demo_reset_base();
  select id into t from public.sellers where slug = 'tienda-demo';
  select id into v from public.sellers where slug = 'vendedor-demo';
  select id into o from public.orders where seller_id = t and status = 'entregado' limit 1;
  insert into public.reviews (seller_id, order_id, buyer_name, stars, comment, created_at)
  values (t, o, 'Valeria', 5, 'Llegó al otro día y el talle justo. Muy buena atención.', now() - interval '1 day');
  -- Vendedor: un producto ya vendido con su trato y la reseña.
  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location)
  values (v, 'joystick-inalambrico-2', 'Joystick inalámbrico', 'El otro que tenía: funcionando perfecto.', 'Electrónica', 'Usado', 'oferta', 45000,
    array[format(px, 3945659, 3945659)], 0, 'vendida', 'Quilmes') returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, v, 38000, 95);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason, decided_at, created_at)
  values (p, v, gen_random_uuid(), 'Gustavo', '1155550000', 41000, 1, 'vendida', 'vendedor', now() - interval '3 days', now() - interval '4 days') returning id into o;
  insert into public.reviews (seller_id, product_id, offer_id, buyer_name, stars, comment, created_at)
  values (v, p, o, 'Gustavo', 5, 'Todo como en la foto. Arreglamos el precio en un minuto.', now() - interval '2 days');
end $$;
revoke execute on function public.demo_reset(), public.demo_reset_base() from public, anon, authenticated;
grant execute on function public.demo_reset() to service_role;
