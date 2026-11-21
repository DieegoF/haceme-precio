import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../lib/auth.jsx";
import { BrandBar } from "../../components/Brand.jsx";
import StoreEditor from "./StoreEditor.jsx";
import MpConnect from "../../components/MpConnect.jsx";
import PlanCard from "../../components/PlanCard.jsx";


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

        <PlanCard account={account} onPaid={reload} />

        {account?.is_admin && <button onClick={() => nav("/admin")} className="mt-4 w-full rounded-2xl bg-zinc-900 py-3 text-[14px] font-semibold text-white">Panel de administración</button>}
        <MpConnect />
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
