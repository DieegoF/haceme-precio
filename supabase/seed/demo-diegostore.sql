-- Tienda demo «diegostore» para reels y redes. Se puede correr de nuevo para dejarla como nueva:
-- reemplaza solo los productos demo (slugs de abajo); no toca logo, portada ni otros productos.
-- Fotos libres de Pexels (licencia Pexels: uso gratis, sin atribución obligatoria).
do $$
declare s uuid; p uuid;
  px text := 'https://images.pexels.com/photos/%s/pexels-photo-%s.jpeg?auto=compress&cs=tinysrgb&w=1000';
begin
  select id into s from public.sellers where slug = 'diegostore';
  if s is null then raise exception 'No existe la tienda diegostore'; end if;

  update public.stores set
    tagline = 'Ropa urbana · Berazategui', pickup = true, shipping_enabled = true,
    shipping_note = 'Moto en CABA y GBA sur', free_ship_from = 60000,
    promo = jsonb_build_object('text', '20% OFF en remeras', 'pct', 20, 'scope', 'Remeras', 'ends_at', (now() + interval '6 days 7 hours')::text),
    faq = jsonb_build_array(
      jsonb_build_object('q', '¿Hacen cambios?', 'a', 'Sí, dentro de los 30 días con la etiqueta puesta. Traelo al local o coordinamos por WhatsApp.'),
      jsonb_build_object('q', '¿Cómo sé mi talle?', 'a', 'Las remeras son oversize: si dudás, pedí tu talle de siempre. Escribinos y te pasamos las medidas.'),
      jsonb_build_object('q', '¿Cómo puedo pagar?', 'a', 'Con Mercado Pago (tarjeta, dinero en cuenta o transferencia) o en efectivo al retirar.'),
      jsonb_build_object('q', '¿Cuánto tarda el envío?', 'a', 'En CABA y GBA sur llega en 24 a 48 h hábiles. Envío gratis desde $60.000.'))
  where seller_id = s;

  delete from public.products where seller_id = s and slug in
    ('remera-oversize-negra', 'remera-basica-algodon', 'campera-de-jean', 'buzo-canguro-rojo', 'jean-recto-clasico', 'remera-oversize-hueso');

  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, compare_at, photos, color_photos, has_variants, stock, status)
  values (s, 'remera-oversize-negra', 'Remera oversize negra', '100% algodón peinado 24/1. Calce amplio, cuello reforzado.', 'Remeras', 'fijo', 18000, null,
    array[format(px, 8532638, 8532638), format(px, 8532611, 8532611)], '{}'::jsonb, true, 0, 'activa') returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Negro','S',4),(p,'Negro','M',2),(p,'Negro','L',6),(p,'Negro','XL',0);

  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, compare_at, photos, color_photos, has_variants, stock, status)
  values (s, 'remera-basica-algodon', 'Remera básica de algodón', 'La que usás todos los días. Suave, no se deforma.', 'Remeras', 'fijo', 14000, null,
    array[format(px, 7319146, 7319146)], '{}'::jsonb, true, 0, 'activa') returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Negro','S',3),(p,'Negro','M',5),(p,'Negro','L',3);

  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, compare_at, photos, color_photos, has_variants, stock, status)
  values (s, 'campera-de-jean', 'Campera de jean', 'Denim rígido lavado azul. Botones metálicos, cuatro bolsillos.', 'Camperas', 'fijo', 52000, 65000,
    array[format(px, 19220632, 19220632)], '{}'::jsonb, true, 0, 'activa') returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Azul','M',2),(p,'Azul','L',3),(p,'Azul','XL',1);

  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, compare_at, photos, color_photos, has_variants, stock, status, liquidation)
  values (s, 'buzo-canguro-rojo', 'Buzo canguro rojo', 'Frisa invisible, capucha forrada. Últimas unidades de la temporada.', 'Buzos', 'fijo', 19000, 34000,
    array[format(px, 13816095, 13816095)], '{}'::jsonb, true, 0, 'activa', true) returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Rojo','M',1),(p,'Rojo','L',2);

  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, compare_at, photos, color_photos, has_variants, stock, status)
  values (s, 'jean-recto-clasico', 'Jean recto clásico', 'Corte recto, tiro medio. Denim con un toque de elastano.', 'Jeans', 'fijo', 42000, null,
    array[format(px, 6764007, 6764007)], '{}'::jsonb, true, 0, 'activa') returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Azul','40',3),(p,'Azul','42',4),(p,'Azul','44',2),(p,'Azul','46',0);

  -- Stock total = suma de talles.
  update public.products pr set stock = (select coalesce(sum(v.stock), 0) from public.product_variants v where v.product_id = pr.id)
    where pr.seller_id = s and pr.has_variants;
end $$;

-- Pedidos y visitas de ejemplo para el panel de la tienda (no mandan mails).
do $$
declare s uuid; o uuid; i int;
begin
  select id into s from public.sellers where slug = 'diegostore';
  delete from public.orders where seller_id = s and note like '[demo]%';
  for i in 0..13 loop
    insert into public.store_visits (seller_id, day, visits) values (s, ((now() at time zone 'America/Argentina/Buenos_Aires')::date - i), 18 + (i * 7) % 23)
    on conflict (seller_id, day) do update set visits = excluded.visits;
  end loop;
  -- Nuevo (esperando confirmación / pago)
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, address, note, subtotal, total, status, expires_at, created_at)
  values ('DEMO01', s, gen_random_uuid(), 'Camila', '1155550101', 'envio', 'Av. Mitre 1450, Quilmes', '[demo] Si puede ser a la tarde', 66400, 66400, 'reservado', now() + interval '20 hours', now() - interval '25 minutes') returning id into o;
  -- El alta de pedidos con MP conectado lo deja en 30 min: para la demo lo dejamos para coordinar, con 20 h.
  update public.orders set pay_mode = 'acordar', expires_at = now() + interval '20 hours' where id = o;
  insert into public.order_notifications (order_id, kind) values (o, 'nuevo');
  insert into public.order_items (order_id, title, photo, color, size, qty, unit_price) values
    (o, 'Remera oversize negra', 'https://images.pexels.com/photos/8532638/pexels-photo-8532638.jpeg?auto=compress&cs=tinysrgb&w=1000', 'Negro', 'L', 2, 14400),
    (o, 'Jean recto clásico', 'https://images.pexels.com/photos/6764007/pexels-photo-6764007.jpeg?auto=compress&cs=tinysrgb&w=1000', 'Azul', '42', 1, 37600);
  -- Confirmado y pagado con Mercado Pago
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, note, subtotal, total, status, payment_status, pay_mode, paid_at, paid_amount, expires_at, created_at, decided_at)
  values ('DEMO02', s, gen_random_uuid(), 'Nicolás', '1155550202', 'retiro', '[demo]', 52000, 52000, 'confirmado', 'pagado', 'mp', now() - interval '3 hours', 52000, now(), now() - interval '3 hours', now() - interval '3 hours') returning id into o;
  insert into public.order_notifications (order_id, kind) values (o, 'nuevo');
  insert into public.order_items (order_id, title, photo, color, size, qty, unit_price) values
    (o, 'Campera de jean', 'https://images.pexels.com/photos/19220632/pexels-photo-19220632.jpeg?auto=compress&cs=tinysrgb&w=1000', 'Azul', 'M', 1, 52000);
  -- Entregados (historial y ventas del mes)
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, note, subtotal, total, status, payment_status, expires_at, created_at, decided_at)
  values ('DEMO03', s, gen_random_uuid(), 'Valeria', '1155550303', 'retiro', '[demo]', 30400, 30400, 'entregado', 'pagado', now(), now() - interval '2 days', now() - interval '2 days') returning id into o;
  insert into public.order_notifications (order_id, kind) values (o, 'nuevo');
  insert into public.order_items (order_id, title, photo, color, size, qty, unit_price) values
    (o, 'Remera básica de algodón', 'https://images.pexels.com/photos/7319146/pexels-photo-7319146.jpeg?auto=compress&cs=tinysrgb&w=1000', 'Negro', 'M', 1, 11200),
    (o, 'Buzo canguro rojo', 'https://images.pexels.com/photos/13816095/pexels-photo-13816095.jpeg?auto=compress&cs=tinysrgb&w=1000', 'Rojo', 'L', 1, 19000);
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, address, note, subtotal, total, free_shipping, status, payment_status, expires_at, created_at, decided_at)
  values ('DEMO04', s, gen_random_uuid(), 'Federico', '1155550404', 'envio', 'Calle 14 2230, Berazategui', '[demo]', 80800, 80800, true, 'entregado', 'pagado', now(), now() - interval '5 days', now() - interval '5 days') returning id into o;
  insert into public.order_notifications (order_id, kind) values (o, 'nuevo');
  insert into public.order_items (order_id, title, photo, color, size, qty, unit_price) values
    (o, 'Remera oversize negra', 'https://images.pexels.com/photos/8532638/pexels-photo-8532638.jpeg?auto=compress&cs=tinysrgb&w=1000', 'Negro', 'M', 3, 14400),
    (o, 'Jean recto clásico', 'https://images.pexels.com/photos/6764007/pexels-photo-6764007.jpeg?auto=compress&cs=tinysrgb&w=1000', 'Azul', '44', 1, 37600);
end $$;
