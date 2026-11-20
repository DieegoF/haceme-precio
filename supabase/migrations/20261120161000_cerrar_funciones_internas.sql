-- Las funciones de trigger no tienen que poder llamarse por la API (/rest/v1/rpc/...).
-- Los triggers siguen funcionando igual: los ejecuta la base, no el usuario.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_is_store() from public, anon, authenticated;
-- is_admin() queda ejecutable a propósito: la usan las políticas RLS y solo responde
-- si el usuario que pregunta es admin (no expone datos de nadie más).
comment on function public.is_admin() is 'Usada por políticas RLS. Devuelve true solo si el usuario actual es admin.';
