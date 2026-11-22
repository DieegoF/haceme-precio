-- Portada de la tienda: el vendedor elige qué parte de la foto se ve (arriba / centro / abajo).
alter table public.stores add column if not exists banner_pos text not null default 'center'
  check (banner_pos in ('top', 'center', 'bottom'));
grant insert (banner_pos), update (banner_pos) on public.stores to authenticated;

-- Demo: portada horizontal de un local (se ve bien en celular y en compu).
create or replace function public.demo_reset() returns void
language plpgsql security definer set search_path = '' as $$
declare t uuid; v uuid; o uuid; p uuid;
  px text := 'https://images.pexels.com/photos/%s/pexels-photo-%s.jpeg?auto=compress&cs=tinysrgb&w=1000';
begin
  perform public.demo_reset_base();
  select id into t from public.sellers where slug = 'tienda-demo';
  select id into v from public.sellers where slug = 'vendedor-demo';
  update public.stores set banner_url = 'https://images.pexels.com/photos/17293347/pexels-photo-17293347.jpeg?auto=compress&cs=tinysrgb&w=1600',
    banner_pos = 'center' where seller_id = t;
  select id into o from public.orders where seller_id = t and status = 'entregado' limit 1;
  insert into public.reviews (seller_id, order_id, buyer_name, stars, comment, created_at)
  values (t, o, 'Valeria', 5, 'Llegó al otro día y el talle justo. Muy buena atención.', now() - interval '1 day');
  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location)
  values (v, 'joystick-inalambrico-2', 'Joystick inalámbrico', 'El otro que tenía: funcionando perfecto.', 'Electrónica', 'Usado', 'oferta', 45000,
    array[format(px, 3945659, 3945659)], 0, 'vendida', 'Quilmes') returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, v, 38000, 95);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason, decided_at, created_at)
  values (p, v, gen_random_uuid(), 'Gustavo', '1155550000', 41000, 1, 'vendida', 'vendedor', now() - interval '3 days', now() - interval '4 days') returning id into o;
  insert into public.reviews (seller_id, product_id, offer_id, buyer_name, stars, comment, created_at)
  values (v, p, o, 'Gustavo', 5, 'Todo como en la foto. Arreglamos el precio en un minuto.', now() - interval '2 days');
end $$;
