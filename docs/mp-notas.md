# Mercado Pago · notas para la Fase 4 (parte 2 en adelante)

Leído de la documentación de Checkout Pro con **API de Orders** (nov 2026). Verificar de nuevo los puntos marcados ⚠️ antes de codear.

## Estado actual
- App MP «Haceme Precio»: Checkout Pro, API de Orders, modelo Marketplace, redirect `…/panel/mp/conectado`.
- Secrets en Supabase dev: `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_ACCESS_TOKEN` (prueba), `MP_WEBHOOK_SECRET`.
- Vendedor conectado por OAuth+PKCE → `mp_connections` (token del vendedor solo en el servidor). Cuenta vendedora de prueba: user 3365978572. Renovación diaria: `mp-refresh`.
- Webhook configurado en MP (modo prueba): `https://yuhguakcajaeusldklkr.supabase.co/functions/v1/mp-webhook`, evento **Order (Mercado Pago)**.

## Crear el cobro (order)
- `POST https://api.mercadopago.com/v1/orders`
- Headers: `Authorization: Bearer <ACCESS TOKEN DEL VENDEDOR>` (el de `mp_connections`, así la plata va a su cuenta), `Content-Type: application/json`, `X-Idempotency-Key: <uuid por intento>`.
- Body mínimo:
  ```json
  { "type": "online", "processing_mode": "manual", "total_amount": "36000.00",
    "external_reference": "<orders.id>", "expiration_time": "PT30M",
    "items": [{ "title": "Remera", "unit_price": "18000.00", "quantity": 2 }] }
  ```
  - `total_amount` tiene que ser exactamente la suma de `unit_price × quantity`.
  - `marketplace_fee`: NO mandarlo (Haceme Precio no cobra comisión).
  - ⚠️ `config` lleva las URLs de vuelta (éxito/pendiente/error): la página de create-order no detalla el formato; buscarlo en la referencia de la API de Orders.
- Respuesta: `id` (ORD…), `checkout_url` (redirigir al comprador), `status: created`.

## Webhook (mp-webhook, verify_jwt false)
- MP hace `POST <url>?data.id=ORD…&type=order` con body `{ action: "order.processed", type: "order", data: { id }, user_id, live_mode }`.
- Validar firma con `MP_WEBHOOK_SECRET`:
  - header `x-signature: ts=…,v1=…` y header `x-request-id`.
  - ⚠️ manifest a firmar (confirmar en la doc): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` → HMAC-SHA256 hex == `v1`. Si no coincide → 401 y no tocar nada.
- Con firma válida **no confiar en el body**: hacer `GET /v1/orders/{id}` con el token del vendedor (`user_id` del aviso → `mp_connections.mp_user_id`) y recién ahí, si el estado es pagado y el monto y `external_reference` coinciden con nuestro pedido, marcar `orders.payment_status = 'pagado'` (una sola vez, idempotente).
- ⚠️ Revisar la página «Order status» para los valores exactos de `status` / `status_detail` (pagado, pendiente, rechazado, cancelado, vencido).

## Flujo de la tienda (a decidir en código)
1. Al hacer el pedido, si la tienda tiene MP conectado: reserva de stock **30 min** + crear order MP → redirigir a `checkout_url`.
2. Webhook pagado → `payment_status = pagado`, pedido pasa a «confirmado» solo (o queda para que el vendedor lo entregue).
3. Order vencida o rechazada → liberar stock (lo hace `expire_orders` con el vencimiento de 30 min).
4. Sin MP conectado: queda el flujo actual (24 h y coordinar por WhatsApp).

## Pruebas
- Comprador: cuenta compradora de prueba (Buyer Test User). Tarjeta de prueba del panel (titular APRO = aprobado).
- La URL de vuelta OAuth solo está registrada para producción → probar MP en `web-production-…`, no en las vistas previas.
