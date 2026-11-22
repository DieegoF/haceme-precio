// Edge Function: devuelve la clave PÚBLICA VAPID (no es secreta: el navegador la necesita para activar los avisos).
// Así la app usa siempre la misma clave que está cargada en los secretos, sin copiarla a mano.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  return new Response(JSON.stringify({ publicKey }), { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
});
