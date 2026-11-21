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
