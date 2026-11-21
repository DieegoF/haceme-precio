import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

export const PLAN_NAME = { gratis: "Gratis", pase: "Gratis", mensual: "Básico", pro: "Pro con IA", tienda: "Tienda" };
export const PLAN_PRICE = { gratis: 0, pase: 0, mensual: 10000, pro: 30000, tienda: 40000 };
export const PLAN_FOR_SALE = ["mensual", "tienda"]; // v1: Básico y Tienda
// Comisión del plan Gratis (la define el servidor): { commission_pct, commission_from }.
export function usePricing() {
  const [p, setP] = useState(null);
  useEffect(() => { supabase.rpc("pricing_info").then(({ data }) => setP(data || null)); }, []);
  return p;
}
export const commissionLive = (p) => Boolean(p && new Date(p.commission_from) <= new Date());
export const commissionText = (p) => !p ? "" : commissionLive(p)
  ? `${p.commission_pct}% de cada venta que cobrás con Mercado Pago en la app`
  : `${p.commission_pct}% de cada venta que cobrás con Mercado Pago en la app, recién desde el ${new Date(p.commission_from).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })}`;
export const isFree = (plan) => plan === "gratis" || plan === "pase";

export const PLAN_BLURB = {
  mensual: "Sin comisión: todo lo que vendés es tuyo.",
  tienda: "Tu tienda con carrito, pedidos, promos y métricas. Sin comisión.",
};

// Fecha en que vence lo que tiene hoy (igual que plan_due en la base).
export const planDue = (a) => (!a ? null : a.status === "prueba" ? a.trial_ends_at : a.period_end || a.trial_ends_at);
export const GRACE_DAYS = 3;
export const addDays = (iso, d) => new Date(new Date(iso).getTime() + d * 86400000).toISOString();
export const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
export const dayMonth = (iso) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long" });

// Crea el cobro en el servidor (el monto lo pone el servidor) y devuelve el link de Mercado Pago.
export async function payPlan(kind, plan) {
  const { data, error } = await supabase.functions.invoke("plan-checkout", { body: { action: "pay", kind, plan } });
  if (error || !data?.url) throw new Error(data?.error || "MP");
  return data.url;
}

// Al volver de Mercado Pago: el servidor le pregunta a MP si se pagó (la URL de vuelta no marca nada).
export async function syncPlanPayment(paymentId) {
  const { data } = await supabase.functions.invoke("plan-checkout", { body: { action: "sync", payment_id: paymentId } }).catch(() => ({}));
  return data?.result;
}
