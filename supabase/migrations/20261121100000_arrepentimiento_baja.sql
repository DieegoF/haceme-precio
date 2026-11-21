-- =====================================================================
-- Botón de arrepentimiento (Res. SCI 424/2020) y botón de baja de servicios.
-- - Sin registrarse: nombre + mail (+ detalle opcional). Se da el código de trámite al instante.
-- - El admin las ve en el panel y las marca como atendidas.
-- =====================================================================
create table public.consumer_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('arrepentimiento', 'baja')),
  name text not null check (char_length(name) between 2 and 80),
  email extensions.citext not null check (char_length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  detail text check (char_length(detail) <= 500),
  status text not null default 'nuevo' check (status in ('nuevo', 'atendido')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.consumer_requests enable row level security;
revoke all on public.consumer_requests from anon, authenticated;

create or replace function public.submit_consumer_request(p_kind text, p_name text, p_email text, p_detail text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if p_kind not in ('arrepentimiento', 'baja') then raise exception 'DATOS'; end if;
  if (select count(*) from public.consumer_requests where email = p_email::extensions.citext and created_at > now() - interval '1 day') >= 5 then
    raise exception 'DEMASIADAS';
  end if;
  loop
    v_code := case when p_kind = 'baja' then 'BJ-' else 'AR-' end || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from public.consumer_requests where code = v_code);
  end loop;
  insert into public.consumer_requests (code, kind, name, email, detail)
  values (v_code, p_kind, btrim(p_name), lower(btrim(p_email)), nullif(left(btrim(coalesce(p_detail, '')), 500), ''));
  return v_code;
end $$;
revoke execute on function public.submit_consumer_request(text, text, text, text) from public;
grant execute on function public.submit_consumer_request(text, text, text, text) to anon, authenticated;

create or replace function public.admin_consumer_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select r.*, (select s.slug from public.seller_accounts a join public.sellers s on s.id = a.seller_id where a.email = r.email limit 1) as seller_slug
    from public.consumer_requests r order by r.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_consumer_request_done(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.admin_guard();
begin
  update public.consumer_requests set status = 'atendido', handled_at = now() where id = p_id;
  insert into public.admin_log (admin_id, action, detail) select uid, 'tramite_atendido', jsonb_build_object('codigo', code, 'tipo', kind) from public.consumer_requests where id = p_id;
end $$;

-- Contador para el admin (denuncias + trámites pendientes se muestran aparte).
create or replace function public.admin_consumer_requests_count() returns int
language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then (select count(*)::int from public.consumer_requests where status = 'nuevo') else 0 end
$$;

revoke execute on function public.admin_consumer_requests(), public.admin_consumer_request_done(uuid), public.admin_consumer_requests_count() from public, anon;
grant execute on function public.admin_consumer_requests(), public.admin_consumer_request_done(uuid), public.admin_consumer_requests_count() to authenticated;
