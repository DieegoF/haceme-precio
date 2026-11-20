-- =====================================================================
-- Fase 4 (1) · Conectar la cuenta de Mercado Pago del vendedor (OAuth con PKCE)
-- Los tokens del vendedor viven SOLO en el servidor: sin permisos para la app ni para el comprador.
-- =====================================================================
create table public.mp_connections (
  seller_id uuid primary key references public.sellers (id) on delete cascade,
  mp_user_id bigint not null,
  access_token text not null,
  refresh_token text,
  public_key text,
  live_mode boolean not null default false,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mp_connections enable row level security;
revoke all on public.mp_connections from anon, authenticated;

-- Pedidos de conexión en curso (state + code_verifier), duran 15 minutos.
create table public.mp_oauth_states (
  state text primary key,
  seller_id uuid not null references public.sellers (id) on delete cascade,
  code_verifier text not null,
  created_at timestamptz not null default now()
);
alter table public.mp_oauth_states enable row level security;
revoke all on public.mp_oauth_states from anon, authenticated;

-- El vendedor solo sabe si está conectado (nunca ve los tokens).
create or replace function public.mp_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('connected', true, 'mp_user_id', mp_user_id, 'live_mode', live_mode, 'connected_at', connected_at)
    from public.mp_connections where seller_id = auth.uid()), jsonb_build_object('connected', false))
$$;
create or replace function public.mp_disconnect() returns void
language sql security definer set search_path = '' as $$
  delete from public.mp_connections where seller_id = auth.uid()
$$;
revoke execute on function public.mp_status(), public.mp_disconnect() from public, anon;
grant execute on function public.mp_status(), public.mp_disconnect() to authenticated;
