-- =====================================================================
-- Planes:
-- - Pase («vendo una sola cosa»): la PRIMERA publicación es gratis. Queda registrado que la usó
--   (se haya vendido o no, aunque la borre). Desde la segunda, cada publicación es un pase de $5.000
--   (pass_credits: lo suma solo el pago verificado de Mercado Pago, nunca la app).
-- - Básico, Pro y Tienda: 15 días de prueba gratis.
-- =====================================================================
alter table public.seller_accounts
  add column free_pass_used_at timestamptz,
  add column pass_credits integer not null default 0 check (pass_credits >= 0);
-- La app no puede tocar estas columnas (solo el servidor).
revoke update (free_pass_used_at, pass_credits) on public.seller_accounts from authenticated, anon;

create or replace function public.check_product_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare acc record; activos int;
begin
  select a.plan, a.status, a.free_pass_used_at, a.pass_credits into acc
    from public.seller_accounts a where a.seller_id = new.seller_id for update;
  if new.status = 'activa' and (tg_op = 'INSERT' or old.status is distinct from 'activa') then
    if acc.status not in ('prueba', 'activa', 'gracia') then
      raise exception 'PLAN_INACTIVO: Tu plan no está activo. Renovalo para publicar.';
    end if;
    if acc.plan = 'pase' then
      select count(*) into activos from public.products p where p.seller_id = new.seller_id and p.status = 'activa' and p.id <> new.id;
      if activos >= 1 then raise exception 'LIMITE_PASE: El pase permite una sola publicación activa.'; end if;
      -- Cada publicación NUEVA usa un pase: primero el gratis, después uno pago.
      if tg_op = 'INSERT' then
        if acc.free_pass_used_at is null then
          update public.seller_accounts set free_pass_used_at = now() where seller_id = new.seller_id;
        elsif acc.pass_credits > 0 then
          update public.seller_accounts set pass_credits = pass_credits - 1 where seller_id = new.seller_id;
        else
          raise exception 'PASE_PAGO: Ya usaste tu publicación gratis. Para publicar otra, pagá el pase de $5.000.';
        end if;
      end if;
    end if;
  end if;
  if (select s.name from public.sellers s where s.id = new.seller_id) is null then
    raise exception 'SIN_PERFIL: Completá tu nombre y tu link antes de publicar.';
  end if;
  return new;
end $$;

-- Cuentas nuevas: el pase arranca activo (sin vencimiento de prueba); el resto, 15 días de prueba.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p text := new.raw_user_meta_data ->> 'plan_elegido';
  chosen public.plan_kind := case when p in ('pase', 'mensual', 'pro', 'tienda') then p::public.plan_kind else 'mensual' end;
begin
  insert into public.sellers (id) values (new.id);
  insert into public.seller_accounts (seller_id, email, plan, status, trial_ends_at)
  values (new.id, new.email, chosen,
    case when chosen = 'pase' then 'activa'::public.account_status else 'prueba'::public.account_status end,
    case when chosen = 'pase' then null else now() + interval '15 days' end);
  return new;
end $$;

-- Cuentas que ya están en prueba: llevan su prueba a 15 días desde que se crearon.
update public.seller_accounts a set trial_ends_at = greatest(a.trial_ends_at, a.created_at + interval '15 days')
  where a.status = 'prueba' and a.plan <> 'pase';
