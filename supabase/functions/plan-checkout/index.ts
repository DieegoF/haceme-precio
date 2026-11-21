// Edge Function: el vendedor paga su plan (un mes) o un pase de $5.000 a Haceme Precio con Mercado Pago.
// pay  → { kind: "mes", plan: "mensual" | "tienda" } o { kind: "pase" }: crea la order con el token de
//        Haceme Precio (MP_ACCESS_TOKEN, solo servidor) y devuelve el checkout_url.
// sync → { payment_id }: consulta la order a MP y, si está pagada, la acredita (mark_plan_paid).
// El monto sale SIEMPRE del servidor (plan_price), nunca del navegador. Requiere la sesión del vendedor (JWT).
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncMpOrder } from "./_mp_sync.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f-]{36}$/i;
const PLANES_A_LA_VENTA = ["mensual", "tienda"]; // v1: Básico y Tienda (Pro queda para después)
const NOMBRE: Record<string, string> = { mensual: "Básico", pro: "Pro con IA", tienda: "Tienda" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(jwt);
  const uid = u?.user?.id;
  if (!uid) return json({ error: "SIN_SESION" }, 401);
  const { data: me } = await admin.from("sellers").select("is_demo").eq("id", uid).maybeSingle();
  if (me?.is_demo) return json({ error: "DEMO" }, 403); // las cuentas demo no pagan nada
  const body = await req.json().catch(() => ({}));

  if (body.action === "sync") {
    if (!UUID.test(body.payment_id ?? "")) return json({ error: "DATOS" }, 400);
    const { data: p } = await admin.from("plan_payments").select("mp_order_id").eq("id", body.payment_id).eq("seller_id", uid).maybeSingle();
    if (!p?.mp_order_id) return json({ result: "SIN_ORDER" });
    return json({ result: await syncMpOrder(admin, p.mp_order_id) });
  }
  if (body.action !== "pay") return json({ error: "accion" }, 400);

  const { data: acc } = await admin.from("seller_accounts").select("plan, status").eq("seller_id", uid).maybeSingle();
  if (!acc) return json({ error: "SIN_CUENTA" }, 403);
  if (["suspendida", "cancelada"].includes(acc.status)) return json({ error: "CUENTA_SUSPENDIDA" }, 403);

  let kind: string, plan: string, title: string;
  if (body.kind === "pase") {
    if (acc.plan !== "pase") return json({ error: "SOLO_PASE" }, 400);
    kind = "pase"; plan = "pase"; title = "Haceme Precio · Pase para 1 publicación";
  } else if (body.kind === "mes" && PLANES_A_LA_VENTA.includes(body.plan)) {
    kind = "mes"; plan = body.plan; title = `Haceme Precio · Plan ${NOMBRE[plan]} (1 mes)`;
  } else return json({ error: "DATOS" }, 400);

  const { data: price } = await admin.rpc("plan_price", { p_plan: plan });
  const amount = Number(price);
  if (!(amount > 0)) return json({ error: "PRECIO" }, 500);

  // Si tocó «Pagar» hace poco y no terminó, reusamos ese cobro (evita duplicados).
  const { data: prev } = await admin.from("plan_payments").select("id, mp_checkout_url")
    .eq("seller_id", uid).eq("kind", kind).eq("plan", plan).eq("status", "pendiente").not("mp_checkout_url", "is", null)
    .gt("created_at", new Date(Date.now() - 20 * 60e3).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (prev) return json({ url: prev.mp_checkout_url, payment_id: prev.id });

  const { data: pay, error } = await admin.from("plan_payments").insert({ seller_id: uid, kind, plan, amount }).select("id").single();
  if (error || !pay) return json({ error: "NO_SE_PUDO" }, 500);
  const { data: cfg } = await admin.from("app_settings").select("value").eq("key", "app_url").single();
  const back = `${cfg!.value}/panel/cuenta?mp=volver&pago=${pay.id}`;
  const money = amount.toFixed(2);
  const r = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`, "Content-Type": "application/json", accept: "application/json", "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      type: "online", processing_mode: "manual", total_amount: money, external_reference: pay.id,
      description: title, expiration_time: "PT30M",
      items: [{ title, unit_price: money, quantity: 1 }],
      config: { online: { success_url: back, failure_url: back, pending_url: back, auto_return: "all" } },
    }),
  });
  const m = await r.json().catch(() => ({}));
  const url = m.checkout_url ?? m.config?.online?.checkout_url;
  if (!r.ok || !m.id || !url) return json({ error: "MP_RECHAZO", detail: m?.message || m?.errors || r.status }, 502);
  await admin.from("plan_payments").update({ mp_order_id: m.id, mp_checkout_url: url }).eq("id", pay.id);
  return json({ url, payment_id: pay.id });
});
