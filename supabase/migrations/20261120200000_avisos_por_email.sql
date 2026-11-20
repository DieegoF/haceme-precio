-- =====================================================================
-- Avisos por email al vendedor (nueva oferta, aceptada sola, contraoferta aceptada)
-- Flujo: cambio en offers -> trigger -> pg_net llama a la Edge Function notify-offer
--        -> la función lee la oferta con service role, decide el aviso y manda el email (Resend).
-- La función no confía en lo que recibe: solo usa el id y vuelve a leer todo de la base.
-- Cada aviso se manda una sola vez (tabla offer_notifications con clave única).
-- =====================================================================
create extension if not exists pg_net with schema extensions;

-- Configuración del entorno (distinta en dev y en producción). Sin acceso desde la API.
create table public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values
  ('functions_url', 'https://yuhguakcajaeusldklkr.supabase.co/functions/v1'),
  ('app_url', 'https://web-production-92056b32.up.railway.app');

create table public.offer_notifications (
  offer_id uuid not null references public.offers (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (offer_id, kind)
);
alter table public.offer_notifications enable row level security;
revoke all on public.offer_notifications from anon, authenticated;

create or replace function public.notify_offer_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  if not (new.status = 'pendiente' or (new.status = 'aceptada' and new.reason in ('auto', 'contraoferta_aceptada'))) then return new; end if;
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  select value into base from public.app_settings where key = 'functions_url';
  if base is null then return new; end if;
  perform net.http_post(
    url := base || '/notify-offer',
    body := jsonb_build_object('offer_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return new;
end $$;
revoke execute on function public.notify_offer_change() from public, anon, authenticated;
create trigger offers_notify after insert or update of status on public.offers
  for each row execute function public.notify_offer_change();
