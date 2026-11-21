-- Demo «vendedor con ofertas» sobre la cuenta diegofernandez (plan Básico), para reels.
-- Se puede volver a correr: reemplaza solo los productos demo (y sus ofertas). No manda mails.
-- Fotos libres de Pexels. Productos sin marcas a la vista.
do $$
declare s uuid; p uuid; o uuid;
  px text := 'https://images.pexels.com/photos/%s/pexels-photo-%s.jpeg?auto=compress&cs=tinysrgb&w=1000';
begin
  select id into s from public.sellers where slug = 'diegofernandez';
  if s is null then raise exception 'No existe diegofernandez'; end if;
  delete from public.products where seller_id = s and slug in ('bici-playera-rosa', 'bici-de-paseo-roja', 'joystick-inalambrico-blanco', 'joystick-clasico');

  -- 1) Bici playera: oferta nueva para responder (12 h)
  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled)
  values (s, 'bici-playera-rosa', 'Bici playera rodado 26', 'Con canasto. Cubiertas nuevas, frenos regulados. Se usó muy poco.', 'Deportes', 'Usado', 'oferta', 180000,
    array[format(px, 1431117, 1431117)], 1, 'activa', 'Berazategui', false) returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, s, 150000, 95);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, expires_at, created_at)
  values (p, s, gen_random_uuid(), 'Lucía', '1155551111', 160000, 1, 'pendiente', now() + interval '11 hours 20 minutes', now() - interval '40 minutes') returning id into o;
  insert into public.offer_notifications (offer_id, kind) values (o, 'nueva'), (o, 'auto');
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason, suggested_amount, decided_at, created_at)
  values (p, s, gen_random_uuid(), 'Pablo', '1155552222', 90000, 1, 'rechazada_auto', 'bajo_minimo', 155000, now() - interval '2 hours', now() - interval '2 hours') returning id into o;
  insert into public.offer_notifications (offer_id, kind) values (o, 'nueva'), (o, 'auto');

  -- 2) Bici de paseo: contraoferta esperando al comprador
  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled)
  values (s, 'bici-de-paseo-roja', 'Bici de paseo roja', 'Clásica, cuadro de acero. Ideal para andar por el barrio.', 'Deportes', 'Usado', 'oferta', 120000,
    array[format(px, 14860979, 14860979)], 1, 'activa', 'Berazategui', false) returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, s, 95000, 95);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, counter_amount, expires_at, decided_at, created_at)
  values (p, s, gen_random_uuid(), 'Martín', '1155553333', 95000, 1, 'contraoferta', 108000, now() + interval '9 hours', now() - interval '3 hours', now() - interval '4 hours') returning id into o;
  insert into public.offer_notifications (offer_id, kind) values (o, 'nueva'), (o, 'auto');

  -- 3) Joystick blanco: trato hecho (aceptada sola)
  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled, shipping_note)
  values (s, 'joystick-inalambrico-blanco', 'Joystick inalámbrico blanco', 'Funciona perfecto, con cable de carga. Sin caja.', 'Electrónica', 'Como nuevo', 'oferta', 45000,
    array[format(px, 3945659, 3945659)], 1, 'activa', 'Berazategui', true, 'Envío por moto a coordinar') returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, s, 38000, 90);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason, close_by, decided_at, created_at)
  values (p, s, gen_random_uuid(), 'Sofía', '1155554444', 42000, 1, 'aceptada', 'vendedor', now() + interval '10 hours', now() - interval '1 hour', now() - interval '90 minutes') returning id into o;
  insert into public.offer_notifications (offer_id, kind) values (o, 'nueva'), (o, 'auto');

  -- 4) Joystick clásico: sin ofertas todavía (para hacer una en vivo desde el celular)
  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled)
  values (s, 'joystick-clasico', 'Joystick clásico', 'Ideal para juegos retro. Botones firmes, sin detalles.', 'Electrónica', 'Usado', 'oferta', 25000,
    array[format(px, 10492317, 10492317)], 1, 'activa', 'Berazategui', false) returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, s, 18000, 90);
end $$;
