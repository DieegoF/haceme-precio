-- Recordatorio por mail (y push) antes de que venza un plan pago: 3 días antes y el día anterior.
-- Lo manda la edge plan-reminders, que llama pg_cron una vez por día (9:13 hora argentina).

create table public.plan_reminders (
  seller_id uuid not null references public.sellers(id) on delete cascade,
  due_day date not null,
  kind text not null check (kind in ('tres_dias', 'manana')),
  sent_at timestamptz not null default now(),
  primary key (seller_id, due_day, kind)
);
alter table public.plan_reminders enable row level security;
revoke all on public.plan_reminders from anon, authenticated;

-- A quién avisar hoy. Solo planes pagos activos o en prueba, nunca cuentas demo.
create or replace function public.plan_reminder_candidates()
returns table (seller_id uuid, email text, name text, plan public.plan_kind, status public.account_status, due timestamptz, due_day date, kind text)
language sql stable security definer set search_path = '' as $$
  select x.seller_id, x.email, x.name, x.plan, x.status, x.due, x.due_day,
         case x.days when 3 then 'tres_dias' else 'manana' end
  from (
    select a.seller_id, a.email::text as email, s.name, a.plan, a.status, public.plan_due(a) as due,
           (public.plan_due(a) at time zone 'America/Argentina/Buenos_Aires')::date as due_day,
           (public.plan_due(a) at time zone 'America/Argentina/Buenos_Aires')::date
             - (now() at time zone 'America/Argentina/Buenos_Aires')::date as days
    from public.seller_accounts a
    join public.sellers s on s.id = a.seller_id
    where a.plan in ('mensual', 'pro', 'tienda') and a.status in ('prueba', 'activa') and not s.is_demo
  ) x
  where x.due is not null and x.days in (1, 3)
    and not exists (select 1 from public.plan_reminders r where r.seller_id = x.seller_id and r.due_day = x.due_day
                    and r.kind = case x.days when 3 then 'tres_dias' else 'manana' end);
$$;
revoke execute on function public.plan_reminder_candidates() from public, anon, authenticated;

select cron.schedule('recordar-planes', '13 12 * * *', $cron$
  select net.http_post(url := (select value from public.app_settings where key = 'functions_url') || '/plan-reminders',
    body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 30000);
$cron$);
