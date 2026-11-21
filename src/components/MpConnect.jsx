import React, { useEffect, useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { usePricing, commissionText, isFree } from "../lib/plan.js";

// «Mi cuenta» → conectar la cuenta de Mercado Pago donde el vendedor cobra (los tokens quedan solo en el servidor).
export default function MpConnect({ plan }) {
  const pricing = usePricing();
  const free = isFree(plan);
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const load = () => supabase.rpc("mp_status").then(({ data }) => setSt(data || { connected: false }));
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.functions.invoke("mp-oauth", { body: { action: "start" } });
    if (error || !data?.url) { setErr("No pudimos abrir Mercado Pago. Probá de nuevo."); setBusy(false); return; }
    window.location.href = data.url;
  };
  const disconnect = async () => { setBusy(true); await supabase.rpc("mp_disconnect"); await load(); setBusy(false); setConfirm(false); };

  return (
    <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Wallet size={13} /> Cobros con Mercado Pago</p>
      {!st ? <p className="mt-2 text-sm text-zinc-500">Cargando…</p> : st.connected ? (
        <>
          <p className="mt-2 flex items-center gap-1.5 text-[15px] font-bold text-emerald-700"><CheckCircle2 size={17} /> Cuenta conectada</p>
          <p className="text-[13px] text-zinc-600">Tus clientes te pagan directo a tu cuenta de Mercado Pago{st.live_mode ? "" : " (modo prueba)"}.{" "}{free ? <>En el plan Gratis, Haceme Precio cobra el {commissionText(pricing)}; Mercado Pago lo descuenta solo.</> : "Con tu plan no pagás comisión."}</p>
          {confirm ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="min-h-[42px] rounded-xl text-[13px] font-semibold ring-1 ring-zinc-300">No</button>
              <button disabled={busy} onClick={disconnect} className="min-h-[42px] rounded-xl bg-rose-600 text-[13px] font-semibold text-white">Sí, desconectar</button>
            </div>
          ) : <button onClick={() => setConfirm(true)} className="mt-3 text-[13px] font-semibold text-zinc-500 underline">Desconectar</button>}
        </>
      ) : (
        <>
          <p className="mt-2 text-[14px] text-zinc-700">Conectá tu cuenta para que tus clientes te paguen con Mercado Pago. La plata va <b>directo a tu cuenta</b>.{" "}{free ? <>En el plan Gratis cobramos el {commissionText(pricing)}.</> : "Con tu plan no pagás comisión."}</p>
          <button disabled={busy} onClick={connect} className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#009EE3] text-[15px] font-semibold text-white disabled:opacity-50">
            {busy ? "Abriendo Mercado Pago…" : "Conectar Mercado Pago"}
          </button>
          {err && <p className="mt-2 text-[13px] font-semibold text-hpred">{err}</p>}
        </>
      )}
    </section>
  );
}
