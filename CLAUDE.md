# Haceme Precio — reglas del repo

## Producto
- PWA para vendedores (Marketplace, WhatsApp, Instagram y locales). Textos de la interfaz en español rioplatense con voseo, cortos y simples (pensados para alguien que no sabe de tecnología).
- Planes: pase $5.000 único · Básico $10.000/mes · Pro con IA $30.000/mes · Tienda $40.000/mes. v1 lanza Básico y Tienda.
- El comprador paga directo a la cuenta de Mercado Pago del vendedor. Haceme Precio solo cobra la suscripción: nunca comisión por venta.

## Seguridad (no negociable)
- El precio mínimo (`floor_price`) y el % de auto-aceptación viven en una tabla privada que el comprador NUNCA puede leer. La oferta se evalúa en el servidor (función de Postgres o Edge Function), nunca en el navegador.
- RLS activado en todas las tablas. Cada vendedor solo ve lo suyo.
- Nada pasa a «pagado» a mano ni por captura: solo con el webhook de Mercado Pago verificado por firma.
- En el frontend solo van claves públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). La service_role key y las credenciales de Mercado Pago solo en variables del servidor.

## Base de datos
- Cambios de esquema siempre como migración en `supabase/migrations/`, aplicados primero en `haceme-precio-dev` (ref `yuhguakcajaeusldklkr`) y recién después en `haceme-precio-prod` (ref `ogipiqwuuxxhinendbsy`).

## Flujo de trabajo
- Cada cambio en una rama + PR. Railway arma un entorno de vista previa por PR; Diego lo prueba en el celular y hace el merge.
- `main` = producción.
- Antes de cerrar una tarea: `npm run build` sin errores.
