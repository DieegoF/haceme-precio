-- =====================================================================
-- Fase 1 · Base de datos: vendedores, cuentas, tiendas, productos y reglas privadas
-- Reglas de oro:
--   * RLS en todas las tablas.
--   * product_rules (mínimo y venta automática) NUNCA es legible por compradores.
--   * Plan, estado de cuenta y moderación solo los cambia el servidor (service role / admin).
-- =====================================================================

create extension if not exists citext with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create type public.plan_kind as enum ('pase', 'mensual', 'pro', 'tienda');
create type public.account_status as enum ('prueba', 'activa', 'gracia', 'vencida', 'suspendida', 'cancelada');
create type public.product_status as enum ('borrador', 'activa', 'pausada', 'vendida');
create type public.sale_mode as enum ('oferta', 'fijo');

-- ---------------------------------------------------------------------
-- Perfil PÚBLICO del vendedor (nombre y link). Lo ve cualquiera.
-- ---------------------------------------------------------------------
create table public.sellers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text check (char_length(name) between 2 and 60),
  slug extensions.citext unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'),
  is_store boolean not null default false,          -- lo sincroniza el plan (trigger)
  phone_verified boolean not null default false,    -- lo marca el servidor
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sellers_updated before update on public.sellers for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Cuenta PRIVADA: email, teléfono, plan y estado. Solo el dueño la lee.
-- ---------------------------------------------------------------------
create table public.seller_accounts (
  seller_id uuid primary key references public.sellers (id) on delete cascade,
  email extensions.citext not null,
  phone text,
  plan public.plan_kind not null default 'mensual',
  status public.account_status not null default 'prueba',
  trial_ends_at timestamptz,
  period_end timestamptz,
  cancel_at timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger seller_accounts_updated before update on public.seller_accounts for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select a.is_admin from public.seller_accounts a where a.seller_id = auth.uid()), false)
$$;

-- El plan Tienda activa el modo tienda en el perfil público.
create or replace function public.sync_is_store() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.sellers set is_store = (new.plan = 'tienda') where id = new.seller_id;
  return new;
end $$;
create trigger seller_accounts_sync_store after insert or update of plan on public.seller_accounts
  for each row execute function public.sync_is_store();

-- Al crearse un usuario (primer login) se crean su perfil y su cuenta en prueba gratis.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p text := new.raw_user_meta_data ->> 'plan_elegido';
  chosen public.plan_kind := case when p in ('pase', 'mensual', 'pro', 'tienda') then p::public.plan_kind else 'mensual' end;
begin
  insert into public.sellers (id) values (new.id);
  insert into public.seller_accounts (seller_id, email, plan, status, trial_ends_at)
  values (new.id, new.email, chosen, 'prueba', now() + interval '7 days');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Datos de la tienda (solo plan Tienda). Públicos: se muestran en la vidriera.
-- ---------------------------------------------------------------------
create table public.stores (
  seller_id uuid primary key references public.sellers (id) on delete cascade,
  tagline text check (char_length(tagline) <= 80),
  address text check (char_length(address) <= 120),
  hours text check (char_length(hours) <= 80),
  whatsapp text check (whatsapp ~ '^[0-9]{8,15}$'),
  logo_url text,
  banner_url text,
  color text not null default '#111111' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  pickup boolean not null default true,
  shipping_enabled boolean not null default false,
  shipping_note text check (char_length(shipping_note) <= 120),
  free_ship_from integer check (free_ship_from > 0),
  promo jsonb,
  faq jsonb not null default '[]'::jsonb,
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stores_updated before update on public.stores for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Productos (públicos si están activos o vendidos y no pausados por moderación)
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 2000),
  category text,
  collection text,
  condition text,
  mode public.sale_mode not null default 'oferta',
  list_price integer not null check (list_price > 0),
  compare_at integer,
  photos text[] not null default '{}',
  has_variants boolean not null default false,
  stock integer not null default 1 check (stock >= 0),
  liquidation boolean not null default false,
  location text,
  shipping_enabled boolean not null default false,
  shipping_note text,
  status public.product_status not null default 'activa',
  moderation text not null default 'ok' check (moderation in ('ok', 'pausada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, slug),
  check (compare_at is null or compare_at > list_price)
);
create index products_seller_status_idx on public.products (seller_id, status);
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  color text not null default '',
  size text not null default '',
  stock integer not null default 0 check (stock >= 0),
  unique (product_id, color, size)
);
create index product_variants_product_idx on public.product_variants (product_id);

-- ---------------------------------------------------------------------
-- Reglas PRIVADAS de cada producto. Solo el dueño. El comprador jamás las lee:
-- las ofertas se evalúan en el servidor (fase 2) con una función security definer.
-- ---------------------------------------------------------------------
create table public.product_rules (
  product_id uuid primary key references public.products (id) on delete cascade,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  floor_price integer not null check (floor_price > 0),
  auto_accept_pct integer check (auto_accept_pct between 50 and 100),
  updated_at timestamptz not null default now()
);
create index product_rules_seller_idx on public.product_rules (seller_id);
create trigger product_rules_updated before update on public.product_rules for each row execute function public.set_updated_at();

create or replace function public.check_rules() returns trigger
language plpgsql set search_path = '' as $$
declare lp integer; owner uuid;
begin
  select p.list_price, p.seller_id into lp, owner from public.products p where p.id = new.product_id;
  if owner is distinct from new.seller_id then raise exception 'La regla no corresponde al vendedor del producto'; end if;
  if new.floor_price > lp then raise exception 'El mínimo no puede ser mayor que el precio publicado'; end if;
  return new;
end $$;
create trigger product_rules_check before insert or update on public.product_rules for each row execute function public.check_rules();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.sellers enable row level security;
alter table public.seller_accounts enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_rules enable row level security;

-- sellers: lectura pública de perfiles armados; el dueño edita solo nombre y link.
create policy "perfiles visibles" on public.sellers for select using (name is not null or id = (select auth.uid()) or (select public.is_admin()));
create policy "editar mi perfil" on public.sellers for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.sellers from anon, authenticated;
grant update (name, slug) on public.sellers to authenticated;

-- seller_accounts: solo lectura del dueño (o admin). Cambios solo desde el servidor.
create policy "mi cuenta" on public.seller_accounts for select to authenticated using (seller_id = (select auth.uid()) or (select public.is_admin()));
revoke all on public.seller_accounts from anon;
revoke insert, update, delete on public.seller_accounts from authenticated;

-- stores: lectura pública; el dueño con plan Tienda la crea y la edita.
create policy "tiendas visibles" on public.stores for select using (true);
create policy "crear mi tienda" on public.stores for insert to authenticated
  with check (seller_id = (select auth.uid()) and exists (select 1 from public.sellers s where s.id = seller_id and s.is_store));
create policy "editar mi tienda" on public.stores for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
revoke insert, update, delete on public.stores from anon;

-- products: públicos si están activos/vendidos y sin moderación; el dueño ve y maneja los suyos.
create policy "productos visibles" on public.products for select
  using ((status in ('activa', 'vendida') and moderation = 'ok') or seller_id = (select auth.uid()) or (select public.is_admin()));
create policy "crear mis productos" on public.products for insert to authenticated with check (seller_id = (select auth.uid()) and moderation = 'ok');
create policy "editar mis productos" on public.products for update to authenticated using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy "borrar mis productos" on public.products for delete to authenticated using (seller_id = (select auth.uid()));
revoke insert, update, delete on public.products from anon;
revoke update on public.products from authenticated;
grant update (slug, title, description, category, collection, condition, mode, list_price, compare_at, photos,
  has_variants, stock, liquidation, location, shipping_enabled, shipping_note, status) on public.products to authenticated;

-- product_variants: visibles si el producto es visible; el dueño las maneja.
create policy "variantes visibles" on public.product_variants for select
  using (exists (select 1 from public.products p where p.id = product_id));
create policy "manejar mis variantes" on public.product_variants for all to authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.seller_id = (select auth.uid())))
  with check (exists (select 1 from public.products p where p.id = product_id and p.seller_id = (select auth.uid())));
revoke insert, update, delete on public.product_variants from anon;

-- product_rules: SOLO el dueño. Nada para anon.
create policy "mis reglas" on public.product_rules for all to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
revoke all on public.product_rules from anon;

-- Usuarios que ya existían antes de esta migración (por ej. el primer login de prueba).
insert into public.sellers (id)
  select u.id from auth.users u where not exists (select 1 from public.sellers s where s.id = u.id);
insert into public.seller_accounts (seller_id, email, plan, status, trial_ends_at)
  select u.id, u.email,
         case when u.raw_user_meta_data ->> 'plan_elegido' in ('pase', 'mensual', 'pro', 'tienda')
              then (u.raw_user_meta_data ->> 'plan_elegido')::public.plan_kind else 'mensual' end,
         'prueba', now() + interval '7 days'
  from auth.users u where not exists (select 1 from public.seller_accounts a where a.seller_id = u.id);
