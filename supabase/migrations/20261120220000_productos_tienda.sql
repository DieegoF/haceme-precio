-- =====================================================================
-- Fase 3 · Productos de tienda: precio fijo, talles y colores con stock, fotos por color
-- =====================================================================
alter table public.products add column color_photos jsonb not null default '{}'::jsonb;
grant update (color_photos) on public.products to authenticated;

-- save_product v2: suma variantes (talle × color con stock) y modo de venta.
drop function if exists public.save_product(uuid, jsonb, jsonb);
create or replace function public.save_product(p_id uuid, p jsonb, r jsonb default null, v jsonb default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  pid uuid := p_id;
  base text; s text; i int := 1;
  v_mode public.sale_mode := coalesce(p ->> 'mode', 'oferta')::public.sale_mode;
  v_is_store boolean;
  v_has_variants boolean := v is not null and jsonb_typeof(v) = 'array' and jsonb_array_length(v) > 0;
  v_stock int;
begin
  if uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  select is_store into v_is_store from public.sellers where id = uid;
  if v_mode = 'fijo' and not coalesce(v_is_store, false) then raise exception 'SOLO_TIENDA: El precio fijo es del plan Tienda.'; end if;
  if v_mode = 'oferta' and (r is null or (r ->> 'floor_price') is null) then raise exception 'FALTA_MINIMO: Poné lo mínimo que aceptás.'; end if;

  if v_has_variants then
    select coalesce(sum(greatest((x ->> 'stock')::int, 0)), 0) into v_stock from jsonb_array_elements(v) x;
  else
    v_stock := greatest(coalesce((p ->> 'stock')::int, 1), 0);
  end if;

  if pid is null then
    base := trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p ->> 'title', ''))), '[^a-z0-9]+', '-', 'g'));
    base := left(coalesce(nullif(base, ''), 'producto'), 60);
    if length(base) < 3 then base := base || '-hp'; end if;
    s := base;
    while exists (select 1 from public.products x where x.seller_id = uid and x.slug = s) loop i := i + 1; s := base || '-' || i; end loop;
    insert into public.products (seller_id, slug, title, description, category, collection, condition, mode, list_price, compare_at, photos,
      color_photos, has_variants, stock, liquidation, location, shipping_enabled, shipping_note, status)
    values (uid, s, p ->> 'title', p ->> 'description', p ->> 'category', p ->> 'collection', p ->> 'condition', v_mode,
      (p ->> 'list_price')::int, nullif(p ->> 'compare_at', '')::int,
      coalesce(array(select jsonb_array_elements_text(p -> 'photos')), '{}'), coalesce(p -> 'color_photos', '{}'::jsonb),
      v_has_variants, v_stock, coalesce((p ->> 'liquidation')::boolean, false), p ->> 'location',
      coalesce((p ->> 'shipping_enabled')::boolean, false), p ->> 'shipping_note', coalesce(p ->> 'status', 'activa')::public.product_status)
    returning id into pid;
  else
    update public.products set
      title = p ->> 'title', description = p ->> 'description', category = p ->> 'category', collection = p ->> 'collection',
      condition = p ->> 'condition', mode = v_mode, list_price = (p ->> 'list_price')::int, compare_at = nullif(p ->> 'compare_at', '')::int,
      photos = coalesce(array(select jsonb_array_elements_text(p -> 'photos')), '{}'), color_photos = coalesce(p -> 'color_photos', '{}'::jsonb),
      has_variants = v_has_variants, stock = v_stock, liquidation = coalesce((p ->> 'liquidation')::boolean, false),
      location = p ->> 'location', shipping_enabled = coalesce((p ->> 'shipping_enabled')::boolean, false), shipping_note = p ->> 'shipping_note'
    where id = pid and seller_id = uid;
    if not found then raise exception 'No encontramos ese producto'; end if;
  end if;

  -- Variantes: se reemplaza el conjunto (borra las que ya no están, actualiza o crea el resto).
  delete from public.product_variants pv where pv.product_id = pid
    and (not v_has_variants or not exists (select 1 from jsonb_array_elements(v) x where coalesce(x ->> 'color', '') = pv.color and coalesce(x ->> 'size', '') = pv.size));
  if v_has_variants then
    insert into public.product_variants (product_id, color, size, stock)
    select pid, coalesce(x ->> 'color', ''), coalesce(x ->> 'size', ''), greatest((x ->> 'stock')::int, 0) from jsonb_array_elements(v) x
    on conflict (product_id, color, size) do update set stock = excluded.stock;
  end if;

  -- Reglas privadas: solo para productos que aceptan ofertas.
  if v_mode = 'oferta' then
    insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct)
    values (pid, uid, (r ->> 'floor_price')::int, nullif(r ->> 'auto_accept_pct', '')::int)
    on conflict (product_id) do update set floor_price = excluded.floor_price, auto_accept_pct = excluded.auto_accept_pct;
  else
    delete from public.product_rules where product_id = pid;
  end if;
  return pid;
end $$;
revoke execute on function public.save_product(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_product(uuid, jsonb, jsonb, jsonb) to authenticated;
