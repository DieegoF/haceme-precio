# Haceme Precio — reglas del repo

## Producto
- PWA para vendedores (Marketplace, WhatsApp, Instagram y locales). Textos de la interfaz en español rioplatense con voseo, cortos y simples (pensados para alguien que no sabe de tecnología).
- Planes: Gratis (sin costo fijo, 3% de comisión solo en ventas cobradas con Mercado Pago dentro de la app, desde el 01/01/2027) · Básico $10.000/mes sin comisión · Tienda $40.000/mes sin comisión · Pro con IA $30.000/mes (más adelante). Básico y Tienda con 15 días de prueba. «Una sola cosa» (pase) ya no se ofrece.
- El comprador paga directo a la cuenta de Mercado Pago del vendedor. En el plan Gratis, Haceme Precio cobra su comisión con el split de MP (`marketplace_fee`); el % y la fecha de inicio viven en `app_settings` (server-only). Los planes pagos no tienen comisión.

## Seguridad (no negociable)
- El precio mínimo (`floor_price`) y el % de auto-aceptación viven en una tabla privada que el comprador NUNCA puede leer. La oferta se evalúa en el servidor (función de Postgres o Edge Function), nunca en el navegador.
- RLS activado en todas las tablas. Cada vendedor solo ve lo suyo.
- Nada pasa a «pagado» a mano ni por captura: solo con el webhook de Mercado Pago verificado por firma.
- En el frontend solo van claves públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). La service_role key y las credenciales de Mercado Pago solo en variables del servidor.

## Avisos
- Mails con Resend (`notify-offer`, `notify-order`) y avisos push (Web Push) a los dispositivos en `push_subscriptions` (módulo `_push.ts`). La app pide la clave pública VAPID a la edge `push-key`; el par vive solo en los secretos `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` de Supabase (mismo par en dev y prod).

## Base de datos
- Cambios de esquema siempre como migración en `supabase/migrations/`, aplicados primero en `haceme-precio-dev` (ref `yuhguakcajaeusldklkr`) y recién después en `haceme-precio-prod` (ref `ogipiqwuuxxhinendbsy`).

## Flujo de trabajo
- Cada cambio en una rama + PR. Railway arma un entorno de vista previa por PR; Diego lo prueba en el celular y hace el merge.
- `main` = producción.
- Antes de cerrar una tarea: `npm run build` sin errores.
