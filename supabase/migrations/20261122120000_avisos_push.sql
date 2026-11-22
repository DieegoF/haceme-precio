-- Avisos push (Web Push): cada celular/compu del vendedor que activó los avisos.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index push_subscriptions_seller on public.push_subscriptions(seller_id);
alter table public.push_subscriptions enable row level security;
create policy "mis avisos" on public.push_subscriptions for select to authenticated using (seller_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

-- Guardar / sacar el aviso de este dispositivo (el endpoint es único: si cambia de dueño, pasa al nuevo).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'SIN_SESION'; end if;
  if public.is_demo_seller(uid) then raise exception 'DEMO'; end if;
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then raise exception 'DATOS'; end if;
  if (select count(*) from public.push_subscriptions where seller_id = uid) >= 10 then
    delete from public.push_subscriptions where id = (select id from public.push_subscriptions where seller_id = uid order by created_at limit 1);
  end if;
  insert into public.push_subscriptions (seller_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update set seller_id = uid, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, created_at = now();
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and seller_id = auth.uid();
$$;

revoke execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text), public.delete_push_subscription(text) to authenticated;

-- Ofertas: además de los avisos que ya había, avisar cuando un trato se paga con Mercado Pago.
create or replace function public.notify_offer_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text; paid boolean;
begin
  paid := new.payment_status = 'pagado' and (tg_op = 'INSERT' or old.payment_status is distinct from 'pagado');
  if not paid then
    if not (new.status = 'pendiente' or (new.status = 'aceptada' and new.reason in ('auto', 'contraoferta_aceptada'))) then return new; end if;
    if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  end if;
  if public.is_demo_seller(new.seller_id) then return new; end if;
  select value into base from public.app_settings where key = 'functions_url';
  if base is null then return new; end if;
  perform net.http_post(url := base || '/notify-offer', body := jsonb_build_object('offer_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 5000);
  return new;
end $$;

-- Pedidos: avisar también cuando se pagan con Mercado Pago.
create or replace function public.notify_order_paid() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text;
begin
  if new.payment_status <> 'pagado' or old.payment_status = 'pagado' then return new; end if;
  if public.is_demo_seller(new.seller_id) then return new; end if;
  select value into base from public.app_settings where key = 'functions_url';
  if base is null then return new; end if;
  perform net.http_post(url := base || '/notify-order', body := jsonb_build_object('order_id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 5000);
  return new;
end $$;
revoke execute on function public.notify_order_paid() from public, anon, authenticated;
create trigger orders_notify_paid after update of payment_status on public.orders
  for each row execute function public.notify_order_paid();
