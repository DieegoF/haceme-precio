// Edge Function: «Probar aviso» desde Mi cuenta. Manda un aviso push a los dispositivos del vendedor logueado.
// Requiere la sesión (JWT). Las cuentas demo no tienen avisos.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush } from "./_push.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await sb.auth.getUser(jwt);
  const uid = u?.user?.id;
  if (!uid) return json({ error: "SIN_SESION" }, 401);
  const { data: me } = await sb.from("sellers").select("is_demo").eq("id", uid).maybeSingle();
  if (me?.is_demo) return json({ error: "DEMO" }, 403);
  const r = await sendPush(sb, uid, { title: "¡Listo! Los avisos funcionan 🎉", body: "Así te vamos a avisar de cada oferta, pedido y pago.", url: "/panel", tag: "prueba" });
  if ((r as any).skipped) return json({ error: (r as any).skipped }, 503);
  return json(r);
});
