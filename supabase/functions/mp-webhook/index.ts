// Edge Function: aviso de Mercado Pago (evento Order). Verifica la firma con MP_WEBHOOK_SECRET y,
// aun con firma válida, vuelve a consultar la order a MP antes de marcar nada.
import { createClient } from "npm:@supabase/supabase-js@2";
import { syncMpOrder } from "./_mp_sync.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const enc = new TextEncoder();
async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const same = (a: string, b: string) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const dataId = String(url.searchParams.get("data.id") ?? url.searchParams.get("data_id") ?? body?.data?.id ?? "");
  const sig = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=", 2)));
  const requestId = req.headers.get("x-request-id") ?? "";
  if (!dataId || !sig.ts || !sig.v1) return new Response("firma", { status: 401 });

  const secret = Deno.env.get("MP_WEBHOOK_SECRET")!;
  let valid = false;
  for (const id of new Set([dataId, dataId.toLowerCase()])) {
    if (same(await hmacHex(secret, `id:${id};request-id:${requestId};ts:${sig.ts};`), sig.v1)) valid = true;
  }
  if (!valid) return new Response("firma", { status: 401 });

  const type = body?.type ?? url.searchParams.get("type");
  if (type && type !== "order") return new Response(JSON.stringify({ skipped: type }), { status: 200 });
  const result = await syncMpOrder(admin, dataId);
  return new Response(JSON.stringify({ result }), { status: 200, headers: { "Content-Type": "application/json" } });
});
