-- =====================================================================
-- Widgets del panel (fase 1)
-- · Las visitas se cuentan para TODOS los vendedores (antes solo tiendas), por producto y por origen.
--   Solo se guardan contadores por día: nunca quién visitó.
-- · seller_home(): los números de los widgets del vendedor.
-- =====================================================================

-- 1) Visitas por producto (una por sesión del navegador y producto).
create table public.product_visits (
  product_id uuid not null references public.products (id) on delete cascade,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  day date not null,
  visits integer not null default 0,
  primary key (product_id, day)
);
create index product_visits_seller_idx on public.product_visits (seller_id, day);
alter table public.product_visits enable row level security;
revoke all on public.product_visits from anon, authenticated;

-- 2) De dónde viene cada sesión (una por sesión del navegador y vendedor).
create table public.visit_sources (
  seller_id uuid not null references public.sellers (id) on delete cascade,
  day date not null,
  source text not null check (source in ('whatsapp', 'instagram', 'facebook', 'directo', 'otro')),
  visits integer not null default 0,
  primary key (seller_id, day, source)
);
alter table public.visit_sources enable row level security;
revoke all on public.visit_sources from anon, authenticated;

-- 3) track_visit: ahora para cualquier vendedor, con producto y origen opcionales.
--    · p_source presente  → sesión nueva en el vendedor: suma visita + origen.
--    · p_product presente → suma visita al producto (si es de ese vendedor).
--    · los dos vacíos     → llamada vieja (solo vendedor), para no perder visitas durante el deploy.
drop function if exists public.track_visit(uuid);
create or replace function public.track_visit(p_seller uuid, p_product uuid default null, p_source text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_src text := case when p_source in ('whatsapp', 'instagram', 'facebook', 'directo', 'otro') then p_source
                     when p_source is not null then 'otro' end;
begin
  if not exists (select 1 from public.sellers where id = p_seller) then return; end if;
  if v_src is not null or p_product is null then
    insert into public.store_visits (seller_id, day, visits) values (p_seller, v_day, 1)
      on conflict (seller_id, day) do update set visits = public.store_visits.visits + 1;
  end if;
  if v_src is not null then
    insert into public.visit_sources (seller_id, day, source, visits) values (p_seller, v_day, v_src, 1)
      on conflict (seller_id, day, source) do update set visits = public.visit_sources.visits + 1;
  end if;
  if p_product is not null and exists (select 1 from public.products where id = p_product and seller_id = p_seller) then
    insert into public.product_visits (product_id, seller_id, day, visits) values (p_product, p_seller, v_day, 1)
      on conflict (product_id, day) do update set visits = public.product_visits.visits + 1;
  end if;
end $$;
revoke execute on function public.track_visit(uuid, uuid, text) from public;
grant execute on function public.track_visit(uuid, uuid, text) to anon, authenticated;

-- 4) Números de los widgets del vendedor (cada uno ve solo lo suyo).
create or replace function public.seller_home() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if uid is null then raise exception 'SIN_SESION'; end if;
  perform public.expire_offers();
  return jsonb_build_object(
    'offers', (select jsonb_build_object(
        'pending', count(*) filter (where status = 'pendiente'),
        'waiting', count(*) filter (where status = 'contraoferta'),
        'deals', count(*) filter (where status = 'aceptada'),
        'next_expiry', min(expires_at) filter (where status = 'pendiente' and expires_at > now()))
      from public.offers where seller_id = uid and status in ('pendiente', 'contraoferta', 'aceptada')),
    'products', (select jsonb_build_object(
        'active', count(*) filter (where status = 'activa'),
        'sold', count(*) filter (where status = 'vendida'),
        'paused', count(*) filter (where status = 'pausada'))
      from public.products where seller_id = uid),
    'visits', coalesce((select sum(visits) from public.store_visits where seller_id = uid and day > v_today - 7), 0),
    'prev_visits', coalesce((select sum(visits) from public.store_visits where seller_id = uid
        and day > v_today - 14 and day <= v_today - 7), 0)
  );
end $$;
revoke execute on function public.seller_home() from public, anon;
grant execute on function public.seller_home() to authenticated;
