-- Supabase da EXECUTE a anon en cada función nueva del esquema public (no alcanza con revocar a PUBLIC).
-- Estas dos solo las usan usuarios logueados; ya rechazaban sin sesión, ahora ni siquiera se pueden llamar.
revoke execute on function public.admin_review_action(uuid, boolean) from anon;
revoke execute on function public.seller_order_action(uuid, text) from anon;
