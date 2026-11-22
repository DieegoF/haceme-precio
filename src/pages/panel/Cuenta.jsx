import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../lib/auth.jsx";
import { BrandBar } from "../../components/Brand.jsx";
import StoreEditor from "./StoreEditor.jsx";
import MpConnect from "../../components/MpConnect.jsx";
import PlanCard from "../../components/PlanCard.jsx";
import PushToggle from "../../components/PushToggle.jsx";


export default function Cuenta() {
  const { seller, account, store, reload } = useOutletContext();
  const { session } = useAuth();
  const nav = useNavigate();
  const salir = async () => { await supabase.auth.signOut(); nav("/", { replace: true }); };
  return (
    <>
      <BrandBar />
      <main className="px-5 pt-6">
        <p className="text-sm text-zinc-500">Mi cuenta</p>
        <h1 className="font-display text-2xl font-extrabold">{seller.name}</h1>
        <a href={`/${seller.slug}`} target="_blank" rel="noreferrer" className="mt-1 block font-mono text-[13px] text-hpred underline">{window.location.host}/{seller.slug}</a>
        <p className="text-[12px] text-zinc-500">Tu vidriera: todo lo que publicás, en un solo link.</p>

        {seller.is_demo ? (
          <section className="mt-5 rounded-2xl bg-amber-50 p-4 text-[13px] text-amber-950 ring-1 ring-amber-200">
            <p className="font-bold">Cuenta de prueba</p>
            <p className="mt-1">Acá vas a ver tu plan, hasta cuándo lo tenés y el botón para pagarlo con Mercado Pago. También vas a conectar tu Mercado Pago para cobrar directo.</p>
          </section>
        ) : <PlanCard account={account} onPaid={reload} />}

        {account?.is_admin && <button onClick={() => nav("/admin")} className="mt-4 w-full rounded-2xl bg-zinc-900 py-3 text-[14px] font-semibold text-white">Panel de administración</button>}
        {!seller.is_demo && <PushToggle />}
        {!seller.is_demo && <MpConnect plan={account?.plan} />}
        {seller.is_store && store && <StoreEditor seller={seller} store={store} onSaved={reload} />}

        <a href="/ayuda" className="mt-4 flex min-h-[48px] items-center justify-center rounded-2xl bg-white text-[15px] font-semibold ring-1 ring-zinc-300">¿Necesitás ayuda? Preguntas y WhatsApp</a>
        <button onClick={() => nav("/demo")} className="mt-4 text-[13px] font-semibold text-hpred underline">Ver la demo completa</button>
        <div className="mt-8 border-t border-zinc-100 pt-4 text-center">
          <p className="text-[12px] text-zinc-500">Entraste como {session.user.email}</p>
          <button onClick={salir} className="mt-2 text-[13px] font-semibold text-zinc-600 underline">Cerrar sesión</button>
          <p className="mt-4 text-[12px] text-zinc-400"><a href="/terminos" className="underline">Términos</a> · <a href="/privacidad" className="underline">Privacidad</a> · <a href="/arrepentimiento" className="underline">Arrepentimiento</a> · <a href="/baja" className="underline">Darme de baja</a></p>
        </div>
      </main>
    </>
  );
}
