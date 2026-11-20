import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../lib/auth.jsx";
import { BrandBar } from "../../components/Brand.jsx";
import StoreEditor from "./StoreEditor.jsx";

const PLAN_NAME = { pase: "Una sola cosa", mensual: "Básico", pro: "Pro con IA", tienda: "Tienda" };
const PLAN_PRICE = { pase: "$5.000 único", mensual: "$10.000/mes", pro: "$30.000/mes", tienda: "$40.000/mes" };
const STATUS = { prueba: "Prueba gratis", activa: "Activa", gracia: "Pago pendiente", vencida: "Vencida", suspendida: "Suspendida", cancelada: "Cancelada" };
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));

export default function Cuenta() {
  const { seller, account, store, reload } = useOutletContext();
  const { session } = useAuth();
  const nav = useNavigate();
  const plan = account?.plan || "mensual";
  const salir = async () => { await supabase.auth.signOut(); nav("/", { replace: true }); };
  return (
    <>
      <BrandBar />
      <main className="px-5 pt-6">
        <p className="text-sm text-zinc-500">Mi cuenta</p>
        <h1 className="font-display text-2xl font-extrabold">{seller.name}</h1>
        <a href={`/${seller.slug}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-[13px] text-hpred underline">{window.location.host}/{seller.slug}</a>
        <p className="text-[12px] text-zinc-500">Tu vidriera: todo lo que publicás, en un solo link.</p>

        <section className="mt-5 rounded-2xl bg-ink p-4 text-white">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-zinc-300">Tu plan: <b className="text-white">{PLAN_NAME[plan]}</b></p>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">{STATUS[account?.status] || "—"}</span>
          </div>
          <p className="mt-1 font-display text-2xl font-extrabold">{PLAN_PRICE[plan]}</p>
          {account?.status === "prueba" && account.trial_ends_at && (
            <p className="mt-1 text-[13px] text-zinc-300">Te quedan <b className="text-white">{daysLeft(account.trial_ends_at)} días</b> de prueba gratis.</p>
          )}
          <p className="mt-3 text-[11px] text-zinc-400">El cobro con Mercado Pago se activa en la fase 6.</p>
        </section>

        {seller.is_store && store && <StoreEditor seller={seller} store={store} onSaved={reload} />}

        <button onClick={() => nav("/demo")} className="mt-4 text-[13px] font-semibold text-hpred underline">Ver la demo completa</button>
        <div className="mt-8 border-t border-zinc-100 pt-4 text-center">
          <p className="text-[12px] text-zinc-500">Entraste como {session.user.email}</p>
          <button onClick={salir} className="mt-2 text-[13px] font-semibold text-zinc-600 underline">Cerrar sesión</button>
        </div>
      </main>
    </>
  );
}
