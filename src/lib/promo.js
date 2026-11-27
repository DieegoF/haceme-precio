import { supabase } from "./supabase.js";

// Promo de la tienda. El servidor aplica el descuento al hacer el pedido; acá solo se muestra igual.
export function activePromo(store, now = Date.now()) {
  const p = store?.promo;
  if (!p?.text || !p.ends_at || new Date(p.ends_at) <= now) return null;
  return { ...p, pct: p.pct ? Number(p.pct) : null, scope: p.scope || "Todo" };
}
// Igual que en el servidor: sin mayúsculas, acentos ni espacios de más.
export const normText = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export const inScope = (product, promo) => normText(promo?.scope) === "todo" || normText(promo?.scope) === normText(product.collection);
// La liquidación nunca suma la promo: mantiene su precio de remate.
export function promoApplies(product, promo) {
  return Boolean(promo?.pct && !product.liquidation && inScope(product, promo));
}
// Precio que paga el cliente y el precio «de antes» para mostrar tachado.
export function priceFor(product, store, now = Date.now()) {
  const promo = activePromo(store, now);
  if (promoApplies(product, promo)) {
    return { price: Math.round((product.list_price * (100 - promo.pct)) / 100), was: product.compare_at || product.list_price, promo: true };
  }
  return { price: product.list_price, was: product.compare_at > product.list_price ? product.compare_at : null, promo: false };
}
export const offPct = (price, was) => (was > price ? Math.round((1 - price / was) * 100) : 0);

// De dónde llegó la visita: ?ref= de los links que comparte el vendedor o, si no, la página anterior.
const REF = { wa: "whatsapp", ig: "instagram", fb: "facebook" };
export function visitSource() {
  try {
    const u = new URL(window.location.href);
    const ref = u.searchParams.get("ref");
    if (ref) {
      u.searchParams.delete("ref");
      window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
      return REF[ref] || "otro";
    }
    const host = document.referrer ? new URL(document.referrer).hostname : "";
    if (!host || host === window.location.hostname) return "directo";
    if (/whatsapp|wa\.me/.test(host)) return "whatsapp";
    if (/instagram/.test(host)) return "instagram";
    if (/facebook|fb\.|messenger/.test(host)) return "facebook";
    return "otro";
  } catch { return "directo"; }
}

// Cuenta una visita por sesión del navegador al vendedor (con su origen) y, si hay, al producto.
// No guarda quién visita: solo suma contadores por día.
export function trackVisit(sellerId, productId = null) {
  let src = null, prod = null;
  try {
    const ks = `hp_visit_${sellerId}`;
    if (!sessionStorage.getItem(ks)) { sessionStorage.setItem(ks, "1"); src = visitSource(); }
    if (productId) {
      const kp = `hp_visit_p_${productId}`;
      if (!sessionStorage.getItem(kp)) { sessionStorage.setItem(kp, "1"); prod = productId; }
    }
  } catch { src = visitSource(); prod = productId; } // sin almacenamiento: contamos igual
  if (!src && !prod) return;
  supabase.rpc("track_visit", { p_seller: sellerId, p_product: prod, p_source: src }).then(() => {}, () => {});
}

export const countdown = (iso, now) => {
  const s = Math.max(0, Math.floor((new Date(iso) - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (d) return `${d} d ${h} h`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};
