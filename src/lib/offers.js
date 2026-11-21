import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// El comprador no tiene cuenta: su navegador guarda un identificador aleatorio y su nombre/WhatsApp.
export function buyerToken() {
  try {
    let t = localStorage.getItem("hp_buyer_token");
    if (!t) { t = crypto.randomUUID(); localStorage.setItem("hp_buyer_token", t); }
    return t;
  } catch { return crypto.randomUUID(); }
}
// Pago del trato con Mercado Pago (el servidor crea el cobro con la cuenta del vendedor).
export async function payOffer(offerId) {
  const { data, error } = await supabase.functions.invoke("mp-checkout", { body: { action: "pay_offer", offer_id: offerId, token: buyerToken() } });
  if (error || !data?.url) throw new Error(data?.error || "MP");
  return data.url;
}
// Al volver de MP o mientras espera: el servidor consulta el pago a MP (la URL de vuelta no marca nada).
export async function syncOfferPayment(offerId) {
  await supabase.functions.invoke("mp-checkout", { body: { action: "sync_offer", offer_id: offerId, token: buyerToken() } }).catch(() => {});
}

// Link personal de la oferta (?o=identificador): al abrirlo en otro navegador, recupera las ofertas.
export function adoptBuyerToken() {
  try {
    const t = new URLSearchParams(window.location.search).get("o");
    if (t && /^[0-9a-f-]{36}$/i.test(t)) {
      localStorage.setItem("hp_buyer_token", t);
      const u = new URL(window.location.href); u.searchParams.delete("o");
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  } catch { /* sin almacenamiento */ }
}
export const savedBuyer = () => { try { return JSON.parse(localStorage.getItem("hp_buyer") || "{}"); } catch { return {}; } };
export const saveBuyer = (b) => { try { localStorage.setItem("hp_buyer", JSON.stringify(b)); } catch { /* sin almacenamiento */ } };

export async function submitOffer(productId, { name, contact, amount }) {
  const { data, error } = await supabase.rpc("submit_offer", { p_product: productId, p_token: buyerToken(), p_name: name, p_contact: contact, p_amount: amount });
  if (error) throw error;
  return data;
}
export async function getMyOffers(productId) {
  const { data, error } = await supabase.rpc("get_my_offers", { p_product: productId, p_token: buyerToken() });
  if (error) throw error;
  return data || [];
}
export async function answerCounter(offerId, accept) {
  const { data, error } = await supabase.rpc("answer_counter", { p_offer: offerId, p_token: buyerToken(), p_accept: accept });
  if (error) throw error;
  return data;
}
export async function getSellerOffers() {
  const { data, error } = await supabase.rpc("get_seller_offers");
  if (error) throw error;
  return data || [];
}
export async function sellerAction(offerId, action, counter) {
  const { data, error } = await supabase.rpc("seller_offer_action", { p_offer: offerId, p_action: action, p_counter: counter ?? null });
  if (error) throw error;
  return data;
}

const MSG = {
  NO_DISPONIBLE: "Esta publicación ya no está disponible.",
  PRECIO_FIJO: "Este producto tiene precio fijo.",
  FALTA_NOMBRE: "Escribí tu nombre.",
  FALTA_CONTACTO: "Escribí tu WhatsApp con código de área (ej: 11 5555 1234).",
  OFERTA_INVALIDA: "Escribí cuánto ofrecés.",
  DEMASIADAS: "Hiciste muchas ofertas seguidas. Esperá un rato.",
  YA_TENES_UNA: "Ya tenés una oferta en curso para este producto.",
  SIN_INTENTOS: "Ya usaste tus 2 ofertas para este producto.",
  TRATO_EN_CURSO: "El vendedor tiene un trato en curso por este producto. Probá más tarde.",
  YA_NO_VALE: "Esta oferta ya cambió de estado. Actualizá la página.",
  CONTRA_INVALIDA: "La contraoferta tiene que ser más que la oferta y no más que tu precio.",
  NO_ENCONTRADA: "No encontramos esa oferta.",
};
export function offerError(e) {
  const m = e?.message || "";
  const k = Object.keys(MSG).find((key) => m.includes(key));
  return k ? MSG[k] : "No pudimos enviar. Revisá tu conexión y probá de nuevo.";
}

// Reloj que se actualiza cada segundo (para las cuentas regresivas).
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
export const left = (iso, now) => {
  const s = Math.max(0, Math.floor((new Date(iso) - now) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m}:${String(r).padStart(2, "0")}`;
};
export const hhmm = (iso) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

// Número de WhatsApp argentino para wa.me (agrega 549 si lo escribieron sin país).
export function waNumber(digits) {
  let d = String(digits || "").replace(/\D/g, "");
  if (d.startsWith("54")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
  return "549" + d;
}
export const waLink = (digits, text) => `https://wa.me/${waNumber(digits)}?text=${encodeURIComponent(text)}`;
