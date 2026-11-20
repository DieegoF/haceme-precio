-- =====================================================================
-- Fase 3 · La tienda vende solo a precio fijo: sin ofertas ni contraofertas.
-- Las ofertas son de los planes Pase, Básico y Pro.
-- =====================================================================

-- 1) Un producto de tienda no puede pasar a modo oferta. Se marca «liquidación» nunca más.
create or replace function public.store_fixed_price_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.liquidation := false;
  if new.mode = 'oferta' and (tg_op = 'INSERT' or old.mode is distinct from new.mode)
     and exists (select 1 from public.sellers s where s.id = new.seller_id and s.is_store) then
    raise exception 'SOLO_PRECIO_FIJO: En la tienda los productos van a precio fijo.';
  end if;
  return new;
end $$;
revoke execute on function public.store_fixed_price_only() from public, anon, authenticated;
create trigger products_store_fixed_price before insert or update on public.products
  for each row execute function public.store_fixed_price_only();

-- 2) Nadie puede ofertarle a una tienda, aunque arme la llamada a mano.
create or replace function public.no_offers_to_stores() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.sellers s where s.id = new.seller_id and s.is_store) then
    raise exception 'PRECIO_FIJO';
  end if;
  return new;
end $$;
revoke execute on function public.no_offers_to_stores() from public, anon, authenticated;
create trigger offers_no_stores before insert on public.offers
  for each row execute function public.no_offers_to_stores();

update public.products set liquidation = false where liquidation;
