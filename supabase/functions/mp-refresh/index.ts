// Edge Function: renueva los tokens de Mercado Pago de los vendedores que vencen en menos de 30 días.
// La llama pg_cron una vez por día. No recibe datos: solo renueva lo que está por vencer (inofensivo si alguien la llama).
// Secretos: MP_CLIENT_ID, MP_CLIENT_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async () => {
  const soon = new Date(Date.now() + 30 * 86400e3).toISOString();
  const { data: rows } = await admin.from("mp_connections").select("seller_id, refresh_token").lt("expires_at", soon).not("refresh_token", "is", null).limit(50);
  let ok = 0, failed = 0;
  for (const c of rows ?? []) {
    const r = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: Deno.env.get("MP_CLIENT_ID"), client_secret: Deno.env.get("MP_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: c.refresh_token }),
    });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) { failed++; continue; }
    await admin.from("mp_connections").update({
      access_token: t.access_token, refresh_token: t.refresh_token ?? c.refresh_token, public_key: t.public_key ?? undefined,
      expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null, updated_at: new Date().toISOString(),
    }).eq("seller_id", c.seller_id);
    ok++;
  }
  return new Response(JSON.stringify({ checked: rows?.length ?? 0, ok, failed }), { headers: { "Content-Type": "application/json" } });
});
