import { supabase } from "./supabase.js";

export const DEMO_DOMAIN = "@demo.hacemeprecio.app";
export const DEMO_SLUGS = ["tienda-demo", "vendedor-demo"];
export const isDemoEmail = (email) => Boolean(email && email.endsWith(DEMO_DOMAIN));

// Entra al panel de una cuenta demo sin contraseña: el servidor da un token de un solo uso.
export async function enterDemo(who) {
  const { data, error } = await supabase.functions.invoke("demo-login", { body: { who } });
  if (error || !data?.token_hash) throw new Error("DEMO");
  await supabase.auth.signOut().catch(() => {});
  const { error: e2 } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
  if (e2) throw e2;
}

// La franja «Demo» se puede ocultar para grabar (con la ✕ o con ?grabar=1 en el link; ?grabar=0 la vuelve a mostrar).
const KEY = "hp_demo_franja_oculta";
export function stripHidden() {
  try {
    const g = new URLSearchParams(window.location.search).get("grabar");
    if (g === "1") localStorage.setItem(KEY, "1");
    if (g === "0") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch { return false; }
}
export function hideStrip() { try { localStorage.setItem(KEY, "1"); } catch { /* nada */ } }
