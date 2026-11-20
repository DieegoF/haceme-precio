-- =====================================================================
-- Fase 2 · Productos: fotos (Storage), límites por plan y guardado atómico
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- Fotos de productos: lectura pública (se muestran en el link); cada vendedor
-- solo sube/borra dentro de su carpeta "<su id>/...". Máx 5 MB, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "subir fotos en mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cambiar fotos de mi carpeta" on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "borrar fotos de mi carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Límites al publicar: cuenta vigente y, en el pase, una sola publicación activa.
create or replace function public.check_product_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare acc record; activos int;
begin
  select a.plan, a.status into acc from public.seller_accounts a where a.seller_id = new.seller_id;
  if new.status = 'activa' and (tg_op = 'INSERT' or old.status is distinct from 'activa') then
    if acc.status not in ('prueba', 'activa', 'gracia') then
      raise exception 'PLAN_INACTIVO: Tu plan no está activo. Renovalo para publicar.';
    end if;
    if acc.plan = 'pase' then
      select count(*) into activos from public.products p where p.seller_id = new.seller_id and p.status = 'activa' and p.id <> new.id;
      if activos >= 1 then raise exception 'LIMITE_PASE: El pase permite una sola publicación activa.'; end if;
    end if;
  end if;
  if (select s.name from public.sellers s where s.id = new.seller_id) is null then
    raise exception 'SIN_PERFIL: Completá tu nombre y tu link antes de publicar.';
  end if;
  return new;
end $$;
revoke execute on function public.check_product_quota() from public, anon, authenticated;
create trigger products_quota before insert or update of status on public.products
  for each row execute function public.check_product_quota();

-- Guarda producto + reglas privadas en una sola transacción. Corre con los permisos
-- del usuario (security invoker): RLS sigue aplicando. p_id null = producto nuevo.
create or replace function public.save_product(p_id uuid, p jsonb, r jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  pid uuid := p_id;
  base text;
  s text;
  i int := 1;
begin
  if uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if pid is null then
    base := trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(p ->> 'title', ''))), '[^a-z0-9]+', '-', 'g'));
    base := left(coalesce(nullif(base, ''), 'producto'), 60);
    if length(base) < 3 then base := base || '-hp'; end if;
    s := base;
    while exists (select 1 from public.products x where x.seller_id = uid and x.slug = s) loop
      i := i + 1; s := base || '-' || i;
    end loop;
    insert into public.products (seller_id, slug, title, description, category, condition, mode, list_price, photos,
      stock, location, shipping_enabled, shipping_note, status)
    values (uid, s, p ->> 'title', p ->> 'description', p ->> 'category', p ->> 'condition',
      coalesce(p ->> 'mode', 'oferta')::public.sale_mode, (p ->> 'list_price')::int,
      coalesce(array(select jsonb_array_elements_text(p -> 'photos')), '{}'),
      coalesce((p ->> 'stock')::int, 1), p ->> 'location', coalesce((p ->> 'shipping_enabled')::boolean, false),
      p ->> 'shipping_note', coalesce(p ->> 'status', 'activa')::public.product_status)
    returning id into pid;
  else
    update public.products set
      title = p ->> 'title', description = p ->> 'description', category = p ->> 'category', condition = p ->> 'condition',
      list_price = (p ->> 'list_price')::int, photos = coalesce(array(select jsonb_array_elements_text(p -> 'photos')), '{}'),
      stock = coalesce((p ->> 'stock')::int, stock), location = p ->> 'location',
      shipping_enabled = coalesce((p ->> 'shipping_enabled')::boolean, false), shipping_note = p ->> 'shipping_note'
    where id = pid and seller_id = uid;
    if not found then raise exception 'No encontramos ese producto'; end if;
  end if;

  if r is not null and (r ->> 'floor_price') is not null then
    insert into public.product_rules (product_id, seller_id, floor_price, auto_accept_pct)
    values (pid, uid, (r ->> 'floor_price')::int, nullif(r ->> 'auto_accept_pct', '')::int)
    on conflict (product_id) do update set floor_price = excluded.floor_price, auto_accept_pct = excluded.auto_accept_pct;
  end if;
  return pid;
end $$;
revoke execute on function public.save_product(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_product(uuid, jsonb, jsonb) to authenticated;
