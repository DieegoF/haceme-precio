-- =====================================================================
-- Fase 3 · Tienda: logo y portada (Storage) y alta/edición de la tienda
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-assets', 'store-assets', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "subir marca en mi carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cambiar marca de mi carpeta" on storage.objects for update to authenticated
  using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "borrar marca de mi carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- El dueño escribe solo estas columnas (ready lo marca el alta; promo/faq llegan en el PR 4).
revoke insert, update on public.stores from authenticated;
grant insert (seller_id, tagline, address, hours, whatsapp, logo_url, banner_url, color, pickup, shipping_enabled, shipping_note, ready)
  on public.stores to authenticated;
grant update (tagline, address, hours, whatsapp, logo_url, banner_url, color, pickup, shipping_enabled, shipping_note, ready)
  on public.stores to authenticated;
-- Editar también exige seguir teniendo el plan Tienda.
drop policy "editar mi tienda" on public.stores;
create policy "editar mi tienda" on public.stores for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()) and exists (select 1 from public.sellers s where s.id = seller_id and s.is_store));
