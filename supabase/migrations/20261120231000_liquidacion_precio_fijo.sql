-- Liquidación = remate de stock a precio fijo (con precio anterior tachado), sin ofertas.
-- Solo los productos de precio fijo (tienda) pueden marcarse como liquidación.
create or replace function public.store_fixed_price_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mode <> 'fijo' then new.liquidation := false; end if;
  if new.mode = 'oferta' and (tg_op = 'INSERT' or old.mode is distinct from new.mode)
     and exists (select 1 from public.sellers s where s.id = new.seller_id and s.is_store) then
    raise exception 'SOLO_PRECIO_FIJO: En la tienda los productos van a precio fijo.';
  end if;
  return new;
end $$;
