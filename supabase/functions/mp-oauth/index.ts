// Edge Function: conecta la cuenta de Mercado Pago del vendedor (OAuth, código de autorización + PKCE).
// start  → devuelve la URL de autorización de MP (guarda state + code_verifier).
// finish → canjea el código por los tokens y los guarda solo en el servidor.
// Secretos: MP_CLIENT_ID, MP_CLIENT_SECRET. Requiere la sesión del vendedor (JWT).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Quién es: la sesión del vendedor.
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(jwt);
  const uid = u?.user?.id;
  if (!uid) return json({ error: "SIN_SESION" }, 401);
  const { data: seller } = await admin.from("sellers").select("id").eq("id", uid).maybeSingle();
  if (!seller) return json({ error: "SIN_PERFIL" }, 403);

  const body = await req.json().catch(() => ({}));
  const { data: cfg } = await admin.from("app_settings").select("value").eq("key", "app_url").single();
  const redirect = `${cfg!.value}/panel/mp/conectado`;

  if (body.action === "start") {
    const state = random(24), verifier = random(48);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    await admin.from("mp_oauth_states").delete().lt("created_at", new Date(Date.now() - 15 * 60e3).toISOString());
    await admin.from("mp_oauth_states").insert({ state, seller_id: uid, code_verifier: verifier });
    const q = new URLSearchParams({ client_id: Deno.env.get("MP_CLIENT_ID")!, response_type: "code", platform_id: "mp",
      state, redirect_uri: redirect, code_challenge: challenge, code_challenge_method: "S256" });
    return json({ url: `https://auth.mercadopago.com.ar/authorization?${q}` });
  }

  if (body.action === "finish") {
    const { code, state } = body;
    if (typeof code !== "string" || typeof state !== "string") return json({ error: "DATOS" }, 400);
    const { data: st } = await admin.from("mp_oauth_states").select("*").eq("state", state).eq("seller_id", uid).maybeSingle();
    if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60e3) return json({ error: "VENCIDO" }, 400);
    await admin.from("mp_oauth_states").delete().eq("state", state);

    const r = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: Deno.env.get("MP_CLIENT_ID"), client_secret: Deno.env.get("MP_CLIENT_SECRET"),
        grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: st.code_verifier }),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) return json({ error: "MP_RECHAZO", detail: t?.message || t?.error || r.status }, 502);

    const { error } = await admin.from("mp_connections").upsert({
      seller_id: uid, mp_user_id: t.user_id, access_token: t.access_token, refresh_token: t.refresh_token ?? null,
      public_key: t.public_key ?? null, live_mode: Boolean(t.live_mode),
      expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null, updated_at: new Date().toISOString(),
    });
    if (error) return json({ error: "GUARDAR" }, 500);
    return json({ connected: true, mp_user_id: t.user_id });
  }
  return json({ error: "accion" }, 400);
});
