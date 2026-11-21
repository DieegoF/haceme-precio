-- =====================================================================
-- Demo pública: «Tienda Demo» (/tienda-demo) y «Vendedor Demo» (/vendedor-demo).
-- - Cualquiera entra al panel de estas cuentas sin registrarse (Edge Function demo-login).
-- - Se puede responder ofertas, aceptar pedidos, pausar productos y cambiar precios,
--   pero NO cambiar textos, fotos, nombre, link ni la tienda (nada ofensivo queda público).
-- - Los teléfonos que dejan los visitantes no se guardan (todos ven el mismo panel).
-- - No se mandan mails de avisos de estas cuentas.
-- - Todo vuelve a como estaba cada noche (demo_reset, 3 AM de Argentina).
-- =====================================================================

alter table public.sellers add column is_demo boolean not null default false; -- solo el servidor lo cambia (no hay grant de update)

create or replace function public.is_demo_seller(p_seller uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.is_demo from public.sellers s where s.id = p_seller), false)
$$;
revoke execute on function public.is_demo_seller(uuid) from public, anon;
grant execute on function public.is_demo_seller(uuid) to authenticated;

-- Bloqueos para quien está logueado como cuenta demo (el reseteo corre sin usuario y no se bloquea).
create or replace function public.demo_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); sid uuid;
begin
  if uid is null or not public.is_demo_seller(uid) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_table_name = 'products' then
    if tg_op = 'INSERT' then raise exception 'DEMO: En la demo no se pueden cargar productos nuevos.'; end if;
    if tg_op = 'DELETE' then raise exception 'DEMO: En la demo no se pueden borrar productos.'; end if;
    if new.title is distinct from old.title or new.description is distinct from old.description or new.photos is distinct from old.photos
       or new.color_photos is distinct from old.color_photos or new.slug is distinct from old.slug
       or new.category is distinct from old.category or new.collection is distinct from old.collection then
      raise exception 'DEMO: En la demo no se pueden cambiar los textos ni las fotos.';
    end if;
    return new;
  end if;
  raise exception 'DEMO: En la demo no se puede cambiar esto.';
end $$;
revoke execute on function public.demo_guard() from public, anon, authenticated;
create trigger products_demo_guard before insert or update or delete on public.products for each row execute function public.demo_guard();
create trigger sellers_demo_guard before update on public.sellers for each row execute function public.demo_guard();
create trigger stores_demo_guard before update or delete on public.stores for each row execute function public.demo_guard();

-- Fotos: una cuenta demo no sube ni borra archivos.
create policy "demo sin subir" on storage.objects as restrictive for insert to authenticated with check (not public.is_demo_seller((select auth.uid())));
create policy "demo sin cambiar" on storage.objects as restrictive for update to authenticated using (not public.is_demo_seller((select auth.uid())));
create policy "demo sin borrar" on storage.objects as restrictive for delete to authenticated using (not public.is_demo_seller((select auth.uid())));

-- Visitantes que ofertan o piden en la demo: su teléfono no se guarda (el panel demo lo ve todo el mundo).
create or replace function public.demo_scrub_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_demo_seller(new.seller_id) then
    new.buyer_contact := '1155550000';
    new.buyer_name := left(new.buyer_name, 20);
  end if;
  return new;
end $$;
revoke execute on function public.demo_scrub_contact() from public, anon, authenticated;
create trigger offers_demo_scrub before insert on public.offers for each row execute function public.demo_scrub_contact();
create trigger orders_demo_scrub before insert on public.orders for each row execute function public.demo_scrub_contact();

-- Sin mails para las cuentas demo.
create or replace function public.notify_offer_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  if not (new.status = 'pendiente' or (new.status = 'aceptada' and new.reason in ('auto', 'contraoferta_aceptada'))) then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  if public.is_demo_seller(new.seller_id) then return new; end if;
  select value into base from public.app_settings where key = 'functions_url';
  if base is null then return new; end if;
  perform net.http_post(url := base || '/notify-offer', body := jsonb_build_object('offer_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 5000);
  return new;
end $$;

create or replace function public.notify_order_new() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  if public.is_demo_seller(new.seller_id) then return new; end if;
  select value into base from public.app_settings where key = 'functions_url';
  if base is null then return new; end if;
  perform net.http_post(url := base || '/notify-order', body := jsonb_build_object('order_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 5000);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Reseteo: deja las dos cuentas demo como nuevas. Lo llama el cron y demo-login la primera vez.
-- ---------------------------------------------------------------------
create or replace function public.demo_reset() returns void
language plpgsql security definer set search_path = '' as $$
declare t uuid; v uuid; p uuid; o uuid; i int;
  px text := 'https://images.pexels.com/photos/%s/pexels-photo-%s.jpeg?auto=compress&cs=tinysrgb&w=1000';
  code text;
begin
  select a.seller_id into t from public.seller_accounts a where a.email = 'tienda@demo.hacemeprecio.app';
  select a.seller_id into v from public.seller_accounts a where a.email = 'vendedor@demo.hacemeprecio.app';
  if t is null or v is null then raise exception 'Faltan las cuentas demo'; end if;

  -- Limpiar todo lo que tocaron los visitantes.
  delete from public.offers where seller_id in (t, v);
  delete from public.orders where seller_id in (t, v);
  delete from public.store_visits where seller_id in (t, v);
  delete from public.plan_payments where seller_id in (t, v);
  delete from public.products where seller_id in (t, v);

  -- Perfiles y planes (siempre al día).
  update public.sellers set name = 'Tienda Demo', slug = 'tienda-demo', is_demo = true where id = t;
  update public.sellers set name = 'Vendedor Demo', slug = 'vendedor-demo', is_demo = true where id = v;
  update public.seller_accounts set plan = 'tienda', status = 'activa', period_end = now() + interval '10 years', trial_ends_at = null where seller_id = t;
  update public.seller_accounts set plan = 'mensual', status = 'activa', period_end = now() + interval '10 years', trial_ends_at = null where seller_id = v;
  insert into public.stores (seller_id) values (t) on conflict (seller_id) do nothing;
  update public.stores set
    tagline = 'Ropa urbana y feria americana · Zona sur', address = 'Av. Mitre 1200, Quilmes', hours = 'Lun a Sáb de 10 a 19 h',
    whatsapp = '1155550000', logo_url = null, banner_url = format(px, 8532611, 8532611), color = '#111111',
    pickup = true, shipping_enabled = true, shipping_note = 'Moto en CABA y GBA sur', free_ship_from = 60000,
    promo = jsonb_build_object('text', '20% OFF en remeras', 'pct', 20, 'scope', 'Remeras', 'ends_at', (now() + interval '6 days 7 hours')::text),
    faq = jsonb_build_array(
      jsonb_build_object('q', '¿Hacen cambios?', 'a', 'Sí, dentro de los 30 días con la etiqueta puesta.'),
      jsonb_build_object('q', '¿Cómo puedo pagar?', 'a', 'Con Mercado Pago o en efectivo al retirar.'),
      jsonb_build_object('q', '¿Cuánto tarda el envío?', 'a', 'En CABA y GBA sur, 24 a 48 h hábiles. Gratis desde $60.000.')),
    ready = true
  where seller_id = t;

  -- ===== Tienda Demo: precio fijo, liquidación y un producto que acepta ofertas =====
  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, photos, color_photos, has_variants, stock, status)
  values (t, 'remera-oversize-negra', 'Remera oversize negra', '100% algodón peinado. Calce amplio, cuello reforzado.', 'Remeras', 'fijo', 18000,
    array[format(px, 8532638, 8532638), format(px, 8532611, 8532611)], '{}'::jsonb, true, 0, 'activa') returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Negro','S',4),(p,'Negro','M',2),(p,'Negro','L',6),(p,'Negro','XL',0);
  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, photos, color_photos, has_variants, stock, status)
  values (t, 'remera-basica-algodon', 'Remera básica de algodón', 'La que usás todos los días. Suave, no se deforma.', 'Remeras', 'fijo', 14000,
    array[format(px, 7319146, 7319146)], '{}'::jsonb, true, 0, 'activa') returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Negro','S',3),(p,'Negro','M',5),(p,'Negro','L',3);
  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, compare_at, photos, color_photos, has_variants, stock, status)
  values (t, 'campera-de-jean', 'Campera de jean', 'Denim rígido lavado azul. Botones metálicos, cuatro bolsillos.', 'Camperas', 'fijo', 52000, 65000,
    array[format(px, 19220632, 19220632)], '{}'::jsonb, true, 0, 'activa') returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Azul','M',2),(p,'Azul','L',3),(p,'Azul','XL',1);
  insert into public.products (seller_id, slug, title, description, collection, mode, list_price, compare_at, photos, color_photos, has_variants, stock, status, liquidation)
  values (t, 'buzo-canguro-rojo', 'Buzo canguro rojo', 'Frisa invisible, capucha forrada. Últimas unidades.', 'Buzos', 'fijo', 19000, 34000,
    array[format(px, 13816095, 13816095)], '{}'::jsonb, true, 0, 'activa', true) returning id into p;
  insert into public.product_variants (product_id, color, size, stock) values (p,'Rojo','M',1),(p,'Rojo','L',2);
  update public.products pr set stock = (select coalesce(sum(x.stock), 0) from public.product_variants x where x.product_id = pr.id)
    where pr.seller_id = t and pr.has_variants;
  -- Feria americana: se regatea.
  insert into public.products (seller_id, slug, title, description, collection, condition, mode, list_price, photos, stock, status)
  values (t, 'jean-recto-usado', 'Jean recto (usado)', 'Corte recto, tiro medio. Muy buen estado. Talle 42.', 'Jeans', 'Usado', 'oferta', 30000,
    array[format(px, 6764007, 6764007)], 1, 'activa') returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, t, 22000, 90);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, expires_at, created_at)
  values (p, t, gen_random_uuid(), 'Romina', '1155550000', 24000, 1, 'pendiente', now() + interval '11 hours', now() - interval '30 minutes');

  -- Visitas de las últimas 2 semanas y pedidos de ejemplo.
  for i in 0..13 loop
    insert into public.store_visits (seller_id, day, visits) values (t, ((now() at time zone 'America/Argentina/Buenos_Aires')::date - i), 18 + (i * 7) % 23);
  end loop;
  code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, address, note, subtotal, total, status, pay_mode, expires_at, created_at)
  values (code, t, gen_random_uuid(), 'Camila', '1155550000', 'envio', 'Av. Mitre 1450, Quilmes', 'Si puede ser a la tarde', 66400, 66400, 'reservado', 'acordar', now() + interval '20 hours', now() - interval '25 minutes') returning id into o;
  insert into public.order_items (order_id, title, photo, color, size, qty, unit_price) values
    (o, 'Remera oversize negra', format(px, 8532638, 8532638), 'Negro', 'L', 2, 14400),
    (o, 'Campera de jean', format(px, 19220632, 19220632), 'Azul', 'M', 1, 37600);
  code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, subtotal, total, status, payment_status, pay_mode, paid_at, paid_amount, expires_at, created_at, decided_at)
  values (code, t, gen_random_uuid(), 'Nicolás', '1155550000', 'retiro', 52000, 52000, 'confirmado', 'pagado', 'mp', now() - interval '3 hours', 52000, now(), now() - interval '3 hours', now() - interval '3 hours') returning id into o;
  insert into public.order_items (order_id, title, photo, color, size, qty, unit_price) values (o, 'Campera de jean', format(px, 19220632, 19220632), 'Azul', 'M', 1, 52000);
  code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into public.orders (code, seller_id, buyer_token, buyer_name, buyer_contact, delivery, subtotal, total, status, payment_status, expires_at, created_at, decided_at)
  values (code, t, gen_random_uuid(), 'Valeria', '1155550000', 'retiro', 30400, 30400, 'entregado', 'pagado', now(), now() - interval '2 days', now() - interval '2 days') returning id into o;
  insert into public.order_items (order_id, title, photo, color, size, qty, unit_price) values
    (o, 'Remera básica de algodón', format(px, 7319146, 7319146), 'Negro', 'M', 1, 11200),
    (o, 'Buzo canguro rojo', format(px, 13816095, 13816095), 'Rojo', 'L', 1, 19000);

  -- ===== Vendedor Demo: ofertas en cada estado =====
  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled)
  values (v, 'bici-playera-rosa', 'Bici playera rodado 26', 'Con canasto. Cubiertas nuevas, frenos regulados.', 'Deportes', 'Usado', 'oferta', 180000,
    array[format(px, 1431117, 1431117)], 1, 'activa', 'Quilmes', false) returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, v, 150000, 95);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, expires_at, created_at)
  values (p, v, gen_random_uuid(), 'Lucía', '1155550000', 160000, 1, 'pendiente', now() + interval '11 hours 20 minutes', now() - interval '40 minutes');
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason, suggested_amount, decided_at, created_at)
  values (p, v, gen_random_uuid(), 'Pablo', '1155550000', 90000, 1, 'rechazada_auto', 'bajo_minimo', 155000, now() - interval '2 hours', now() - interval '2 hours');

  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled)
  values (v, 'bici-de-paseo-roja', 'Bici de paseo roja', 'Clásica, cuadro de acero. Ideal para el barrio.', 'Deportes', 'Usado', 'oferta', 120000,
    array[format(px, 14860979, 14860979)], 1, 'activa', 'Quilmes', false) returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, v, 95000, 95);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, counter_amount, expires_at, decided_at, created_at)
  values (p, v, gen_random_uuid(), 'Martín', '1155550000', 95000, 1, 'contraoferta', 108000, now() + interval '9 hours', now() - interval '3 hours', now() - interval '4 hours');

  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled, shipping_note)
  values (v, 'joystick-inalambrico-blanco', 'Joystick inalámbrico blanco', 'Funciona perfecto, con cable de carga. Sin caja.', 'Electrónica', 'Como nuevo', 'oferta', 45000,
    array[format(px, 3945659, 3945659)], 1, 'activa', 'Quilmes', true, 'Envío por moto a coordinar') returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, v, 38000, 90);
  insert into public.offers (product_id, seller_id, buyer_token, buyer_name, buyer_contact, amount, attempt, status, reason, close_by, decided_at, created_at)
  values (p, v, gen_random_uuid(), 'Sofía', '1155550000', 42000, 1, 'aceptada', 'vendedor', now() + interval '10 hours', now() - interval '1 hour', now() - interval '90 minutes');

  insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos, stock, status, location, shipping_enabled)
  values (v, 'joystick-clasico', 'Joystick clásico', 'Ideal para juegos retro. Botones firmes.', 'Electrónica', 'Usado', 'oferta', 25000,
    array[format(px, 10492317, 10492317)], 1, 'activa', 'Quilmes', false) returning id into p;
  insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct) values (p, v, 18000, 90);
end $$;
revoke execute on function public.demo_reset() from public, anon, authenticated;
grant execute on function public.demo_reset() to service_role;
select cron.schedule('resetear-demo', '0 6 * * *', $cron$ select public.demo_reset(); $cron$);

-- Que el cron de planes nunca toque las cuentas demo.
create or replace function public.expire_plans() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.seller_accounts a set status = 'gracia'
    where a.plan <> 'pase' and a.status in ('prueba', 'activa') and public.plan_due(a) < now() and not public.is_demo_seller(a.seller_id);
  for r in select a.seller_id from public.seller_accounts a
            where a.plan <> 'pase' and a.status = 'gracia' and public.plan_due(a) < now() - interval '3 days' and not public.is_demo_seller(a.seller_id)
            for update loop
    update public.seller_accounts set status = 'vencida' where seller_id = r.seller_id;
    update public.products set status = 'pausada', paused_by_plan = true where seller_id = r.seller_id and status = 'activa';
  end loop;
end $$;
