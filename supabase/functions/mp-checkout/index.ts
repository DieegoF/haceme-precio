// Edge Function: el comprador (sin cuenta, con su buyer_token) paga su pedido con Mercado Pago.
// pay  → crea la order en MP con el token del VENDEDOR (la plata va a su cuenta) y devuelve el checkout_url.
// sync → al volver de MP, consulta la order a MP y marca pagado si corresponde.
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncMpOrder } from "./_mp_sync.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;
const money = (n: number) => n.toFixed(2);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { action, order_id, token } = await req.json().catch(() => ({}));
  if (!UUID.test(order_id ?? "") || !UUID.test(token ?? "")) return json({ error: "DATOS" }, 400);

  const { data: o } = await admin.from("orders")
    .select("id, code, seller_id, total, status, payment_status, pay_mode, expires_at, mp_order_id, mp_checkout_url, order_items(title, qty, unit_price)")
    .eq("id", order_id).eq("buyer_token", token).maybeSingle();
  if (!o) return json({ error: "NO_ENCONTRADO" }, 404);

  if (action === "sync") {
    if (!o.mp_order_id) return json({ result: "SIN_ORDER" });
    return json({ result: await syncMpOrder(admin, o.mp_order_id) });
  }
  if (action !== "pay") return json({ error: "accion" }, 400);
  if (o.pay_mode !== "mp" || o.payment_status !== "pendiente") return json({ error: "NO_SE_PAGA_ASI" }, 400);
  const minutes = Math.floor((new Date(o.expires_at).getTime() - Date.now()) / 60000);
  if (o.status !== "reservado" || minutes < 3) return json({ error: "VENCIDO" }, 400);
  if (o.mp_checkout_url) return json({ url: o.mp_checkout_url });

  const { data: c } = await admin.from("mp_connections").select("access_token").eq("seller_id", o.seller_id).maybeSingle();
  if (!c) return json({ error: "SIN_MP" }, 400);
  const { data: cfg } = await admin.from("app_settings").select("key, value").in("key", ["app_url", "functions_url"]);
  const conf = Object.fromEntries((cfg ?? []).map((x: any) => [x.key, x.value]));
  const back = `${conf.app_url}/pedido/${o.id}?mp=volver`;

  const items = (o.order_items as any[]).map((i) => ({ title: String(i.title).slice(0, 120), unit_price: money(i.unit_price), quantity: i.qty }));
  const r = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${c.access_token}`, "Content-Type": "application/json", accept: "application/json", "X-Idempotency-Key": o.id },
    body: JSON.stringify({
      type: "online", processing_mode: "manual", total_amount: money(o.total), external_reference: o.id,
      description: `Pedido #${o.code}`, expiration_time: `PT${minutes}M`, items,
      config: { notification_url: `${conf.functions_url}/mp-webhook`, online: { success_url: back, failure_url: back, pending_url: back, auto_return: "all" } },
    }),
  });
  const m = await r.json().catch(() => ({}));
  const url = m.checkout_url ?? m.config?.online?.checkout_url;
  if (!r.ok || !m.id || !url) return json({ error: "MP_RECHAZO", detail: m?.message || m?.errors || r.status }, 502);
  await admin.from("orders").update({ mp_order_id: m.id, mp_checkout_url: url }).eq("id", o.id).is("mp_order_id", null);
  return json({ url });
});
