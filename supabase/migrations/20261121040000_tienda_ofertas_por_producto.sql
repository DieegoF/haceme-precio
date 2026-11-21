-- =====================================================================
-- Ofertas en la tienda, por producto (feria americana, usados).
-- Cada producto de una tienda es «precio fijo» (carrito) o «acepto ofertas» (mínimo oculto,
-- aceptación automática, 12 h), igual que en el plan Básico. Se sacan los bloqueos anteriores.
-- La liquidación sigue siendo solo para precio fijo.
-- =====================================================================
create or replace function public.store_fixed_price_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mode <> 'fijo' then new.liquidation := false; end if;
  return new;
end $$;

drop trigger if exists offers_no_stores on public.offers;
drop function if exists public.no_offers_to_stores();
