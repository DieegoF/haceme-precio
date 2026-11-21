// Edge Function: entrar al panel de la demo pública sin registrarse.
// { who: "tienda" | "vendedor" } → devuelve un token de un solo uso para iniciar sesión en esa cuenta demo.
// No hay contraseñas en la web: el token lo genera el servidor (service role) y vence enseguida.
// La primera vez crea las dos cuentas demo y las deja cargadas (demo_reset).
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const DEMO = {
  tienda: { email: "tienda@demo.hacemeprecio.app", plan: "tienda" },
  vendedor: { email: "vendedor@demo.hacemeprecio.app", plan: "mensual" },
} as const;

async function ensureDemo() {
  const { data } = await admin.from("sellers").select("id").eq("is_demo", true);
  if ((data?.length ?? 0) >= 2) return;
  for (const d of Object.values(DEMO)) {
    // Si ya existe, createUser falla y seguimos.
    await admin.auth.admin.createUser({ email: d.email, email_confirm: true, user_metadata: { plan_elegido: d.plan } });
  }
  const { error } = await admin.rpc("demo_reset");
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { who } = await req.json().catch(() => ({}));
  const d = DEMO[who as keyof typeof DEMO];
  if (!d) return json({ error: "DATOS" }, 400);
  try { await ensureDemo(); } catch { return json({ error: "DEMO_NO_LISTA" }, 500); }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: d.email });
  const token_hash = data?.properties?.hashed_token;
  if (error || !token_hash) return json({ error: "NO_SE_PUDO" }, 500);
  return json({ token_hash });
});
