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

// Cuenta una visita por sesión del navegador (sin datos de quién visita).
export function trackVisit(sellerId) {
  try {
    const k = `hp_visit_${sellerId}`;
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch { /* sin almacenamiento: contamos igual */ }
  supabase.rpc("track_visit", { p_seller: sellerId }).then(() => {}, () => {});
}

export const countdown = (iso, now) => {
  const s = Math.max(0, Math.floor((new Date(iso) - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (d) return `${d} d ${h} h`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};
