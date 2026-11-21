-- Nuevo plan «gratis» (se usa en la migración siguiente: Postgres no deja usar un valor de enum nuevo en la misma transacción).
alter type public.plan_kind add value if not exists 'gratis';
