import React from "react";
import { Link, useLocation } from "react-router-dom";
import { planDue, GRACE_DAYS, addDays, daysLeft, dayMonth } from "../lib/plan.js";

// Aviso arriba del panel cuando el plan está por vencer, venció o quedó pausado. Lleva a «Mi cuenta» para pagar.
export default function PlanBanner({ account }) {
  const { pathname } = useLocation();
  if (!account || account.plan === "pase" || pathname.startsWith("/panel/cuenta")) return null;
  const due = planDue(account);
  if (!due) return null;
  const left = daysLeft(due);
  let tone, text;
  if (account.status === "vencida") {
    tone = "bg-rose-50 text-rose-900 ring-rose-200";
    text = "Tus publicaciones están pausadas porque el plan venció. Pagá y vuelven solas.";
  } else if (account.status === "gracia") {
    tone = "bg-amber-50 text-amber-900 ring-amber-200";
    text = `Tu plan venció. Pagá antes del ${dayMonth(addDays(due, GRACE_DAYS))} para que no se pausen tus publicaciones.`;
  } else if (left <= 3) {
    tone = "bg-sky-50 text-sky-900 ring-sky-200";
    text = account.status === "prueba"
      ? `Tu prueba gratis termina ${left === 0 ? "hoy" : left === 1 ? "mañana" : `en ${left} días`}. Pagá tu plan para seguir vendiendo sin cortes.`
      : `Tu plan vence ${left === 0 ? "hoy" : left === 1 ? "mañana" : `en ${left} días`}.`;
  } else return null;
  return (
    <Link to="/panel/cuenta" className={`mx-5 mt-4 block rounded-2xl p-3 text-[13px] ring-1 lg:mx-0 ${tone}`}>
      {text} <b className="underline">Pagar ahora</b>
    </Link>
  );
}
