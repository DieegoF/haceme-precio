# Haceme Precio

Vendé sin contestar «¿sigue disponible?». Ofertas con mínimo oculto, auto-aceptación y auto-rechazo, y modo tienda con carrito, pedidos y promos.

## Stack

- **Web:** React 18 + Vite + Tailwind, publicada en **Railway** (`npm run build` + `npm start`).
- **Datos, login, fotos y lógica del servidor:** **Supabase** (Postgres con RLS, Auth por email, Storage, Edge Functions, pg_cron).
- **Cobros:** Mercado Pago (suscripciones + cobro en la cuenta de cada vendedor).
- **Emails:** Resend.

## Entornos

| Entorno | Web | Supabase |
| --- | --- | --- |
| Local | `npm run dev` | `haceme-precio-dev` |
| Preview / staging | Railway (entorno por PR) | `haceme-precio-dev` |
| Producción | Railway (`main`) | `haceme-precio-prod` |

## Desarrollo local

```bash
cp .env.example .env.local   # completá la publishable key de haceme-precio-dev
npm install
npm run dev                  # http://localhost:5173
```

`/estado` muestra si la app está publicada y conectada a Supabase.

## Estado

Fase 0: la interfaz es el prototipo (`src/prototype/`), con datos de ejemplo en memoria. Las fases siguientes la separan en componentes y la conectan a Supabase. El plan completo está en el documento «Haceme Precio · Plan para pasar a producción».
