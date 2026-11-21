-- =====================================================================
-- Cobro de los planes de Haceme Precio (mes a mes) y de los pases de $5.000.
-- - El vendedor paga con Mercado Pago a la cuenta de Haceme Precio (token de la app, solo en el servidor).
-- - Cada pago de mes suma 1 mes desde el vencimiento actual (o desde hoy si ya venció / cambia de plan).
-- - Vence la prueba o el mes → 3 días de «gracia» (todo sigue andando, con aviso).
--   Pasados los 3 días → «vencida»: las publicaciones activas se pausan (no se borran) y vuelven al pagar.
-- - Nada se marca pagado desde la app: solo mark_plan_paid (service_role) tras consultar la order a MP.
-- =====================================================================

create table public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  kind text not null check (kind in ('mes', 'pase')),
  plan public.plan_kind not null,
  amount numeric(12,2) not null check (amount > 0),
  status public.payment_status not null default 'pendiente',
  mp_order_id text unique,
  mp_checkout_url text,
  paid_at timestamptz,
  paid_amount numeric(12,2),
  created_at timestamptz not null default now()
);
create index plan_payments_seller on public.plan_payments (seller_id, created_at desc);
alter table public.plan_payments enable row level security;
-- El vendedor solo LEE sus pagos. Los crea y los marca únicamente el servidor.
create policy plan_payments_own_read on public.plan_payments for select to authenticated using (seller_id = (select auth.uid()));
revoke insert, update, delete on public.plan_payments from authenticated, anon;

-- Publicaciones que pausó el sistema por falta de pago (para reactivarlas al pagar).
alter table public.products add column paused_by_plan boolean not null default false;

-- Precios vigentes (v1 lanza Básico y Tienda; Pro queda listo para después).
create or replace function public.plan_price(p_plan public.plan_kind) returns numeric
language sql immutable set search_path = '' as $$
  select case p_plan when 'pase' then 5000 when 'mensual' then 10000 when 'pro' then 30000 when 'tienda' then 40000 end::numeric
$$;

-- Fecha en que vence lo que tiene hoy (prueba o mes pago).
create or replace function public.plan_due(a public.seller_accounts) returns timestamptz
language sql stable set search_path = '' as $$
  select case when a.status = 'prueba' then a.trial_ends_at else coalesce(a.period_end, a.trial_ends_at) end
$$;

-- Lo llama SOLO el servidor después de verificar la order en Mercado Pago.
create or replace function public.mark_plan_paid(p_payment uuid, p_mp_order text, p_amount numeric) returns text
language plpgsql security definer set search_path = '' as $$
declare pay public.plan_payments; a public.seller_accounts; base timestamptz;
begin
  select * into pay from public.plan_payments where id = p_payment for update;
  if not found then return 'NO_ENCONTRADO'; end if;
  if pay.mp_order_id is distinct from p_mp_order then return 'OTRA_ORDER'; end if;
  if pay.status = 'pagado' then return 'YA_PAGADO'; end if;
  if p_amount < pay.amount then return 'MONTO_INSUFICIENTE'; end if;
  update public.plan_payments set status = 'pagado', paid_at = now(), paid_amount = p_amount where id = pay.id;
  select * into a from public.seller_accounts where seller_id = pay.seller_id for update;

  if pay.kind = 'pase' then
    update public.seller_accounts set pass_credits = pass_credits + 1 where seller_id = pay.seller_id;
    return 'PAGADO';
  end if;

  -- Mes: mismo plan → se suma desde el vencimiento (si todavía no venció); cambio de plan → arranca hoy.
  base := case when pay.plan = a.plan and a.plan <> 'pase' then greatest(now(), coalesce(public.plan_due(a), now())) else now() end;
  update public.seller_accounts set plan = pay.plan, status = 'activa', period_end = base + interval '1 month', cancel_at = null
    where seller_id = pay.seller_id;
  -- Vuelven las publicaciones que había pausado el sistema.
  update public.products set status = 'activa', paused_by_plan = false
    where seller_id = pay.seller_id and paused_by_plan and status = 'pausada';
  return 'PAGADO';
end $$;
revoke execute on function public.mark_plan_paid(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.mark_plan_paid(uuid, text, numeric) to service_role;

-- Cada hora: prueba o mes vencido → gracia (3 días) → vencida (pausa publicaciones).
create or replace function public.expire_plans() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  update public.seller_accounts a set status = 'gracia'
    where a.plan <> 'pase' and a.status in ('prueba', 'activa') and public.plan_due(a) < now();
  for r in select a.seller_id from public.seller_accounts a
            where a.plan <> 'pase' and a.status = 'gracia' and public.plan_due(a) < now() - interval '3 days'
            for update loop
    update public.seller_accounts set status = 'vencida' where seller_id = r.seller_id;
    update public.products set status = 'pausada', paused_by_plan = true where seller_id = r.seller_id and status = 'activa';
  end loop;
end $$;
revoke execute on function public.expire_plans() from public, anon, authenticated;
select cron.schedule('vencer-planes', '7 * * * *', $cron$ select public.expire_plans(); $cron$);

-- Si el vendedor vuelve a activar a mano algo que pausó el sistema, deja de estar marcado.
create or replace function public.clear_paused_by_plan() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and new.status <> 'pausada' then new.paused_by_plan := false; end if;
  return new;
end $$;
create trigger products_clear_paused_by_plan before update of status on public.products
  for each row execute function public.clear_paused_by_plan();
