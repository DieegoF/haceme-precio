-- Links que usa la app (/panel, /ingresar, etc.): ningún vendedor puede tomarlos.
alter table public.sellers add constraint sellers_slug_no_reservado check (
  slug is null or slug::text not in ('panel', 'ingresar', 'demo', 'estado', 'assets', 'admin', 'api', 'ayuda', 'terminos',
    'privacidad', 'planes', 'precios', 'login', 'app', 'www', 'hacemeprecio', 'haceme-precio', 'soporte', 'contacto', 'baja', 'arrepentimiento')
);
