import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, PauseCircle } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { fmt } from "../lib/format.js";
import { PLAN_NAME, PLAN_PRICE, PLAN_FOR_SALE, PLAN_BLURB, planDue, GRACE_DAYS, addDays, daysLeft, dayMonth, payPlan, syncPlanPayment } from "../lib/plan.js";

const STATUS = { prueba: "Prueba gratis", activa: "Al día", gracia: "Pago pendiente", vencida: "Vencido", suspendida: "Suspendida", cancelada: "Cancelada" };

// Mi plan: qué tiene, hasta cuándo, y los botones para pagar el mes, cambiar de plan o comprar un pase.
export default function PlanCard({ account, onPaid }) {
  const [params, setParams] = useSearchParams();
  const [confirming, setConfirming] = useState(null); // "esperando" | "ok" | "no"
  const [history, setHistory] = useState([]);
  const plan = account?.plan || "mensual";
  const due = planDue(account);

  useEffect(() => {
    supabase.from("plan_payments").select("id, kind, plan, amount, paid_at").eq("status", "pagado").order("paid_at", { ascending: false }).limit(5)
      .then(({ data }) => setHistory(data || []));
  }, [account?.period_end, account?.pass_credits]);

  // Volvió de Mercado Pago: el servidor consulta el pago (unas veces, MP puede tardar unos segundos).
  useEffect(() => {
    const id = params.get("pago");
    if (params.get("mp") !== "volver" || !id) return undefined;
    let alive = true;
    setConfirming("esperando");
    (async () => {
      for (let i = 0; i < 8 && alive; i++) {
        const r = await syncPlanPayment(id);
        if (r === "PAGADO" || r === "YA_PAGADO") { if (alive) { setConfirming("ok"); onPaid?.(); } return; }
        await new Promise((res) => setTimeout(res, 3000));
      }
      if (alive) setConfirming("no");
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const closeNotice = () => { setConfirming(null); params.delete("mp"); params.delete("pago"); setParams(params, { replace: true }); };

  const mensual = plan !== "pase";
  const others = PLAN_FOR_SALE.filter((p) => p !== plan);

  return (
    <section className="mt-5 rounded-2xl bg-ink p-4 text-white">
      {confirming && <Notice state={confirming} account={account} onClose={closeNotice} />}

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-zinc-300">Tu plan: <b className="text-white">{PLAN_NAME[plan]}</b></p>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${account?.status === "gracia" ? "bg-amber-400 text-amber-950" : account?.status === "vencida" ? "bg-rose-500 text-white" : "bg-white/15"}`}>{STATUS[account?.status] || "—"}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-extrabold">{mensual ? `${fmt(PLAN_PRICE[plan])}/mes` : `${fmt(PLAN_PRICE.pase)} por publicación`}</p>

      {mensual && due && <DueLine status={account.status} due={due} />}
      {!mensual && <PaseLine account={account} />}

      {mensual && PLAN_FOR_SALE.includes(plan) && (
        <PayButton label={account.status === "prueba" ? `Pagar mi plan · ${fmt(PLAN_PRICE[plan])}` : `Pagar 1 mes · ${fmt(PLAN_PRICE[plan])}`} kind="mes" plan={plan} />
      )}
      {mensual && account.status === "prueba" && <p className="mt-1.5 text-[11px] text-zinc-400">Si pagás ahora, el mes empieza a contar cuando termina tu prueba gratis.</p>}
      {mensual && account.status === "activa" && <p className="mt-1.5 text-[11px] text-zinc-400">Si pagás ahora, se suma un mes más a partir del {dayMonth(due)}.</p>}
      {!mensual && <PayButton label={`Comprar 1 pase · ${fmt(PLAN_PRICE.pase)}`} kind="pase" />}

      {others.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[12px] font-semibold text-zinc-300">{mensual ? "¿Querés cambiar de plan?" : "¿Vendés seguido? Pasate a un plan:"}</p>
          {others.map((p) => (
            <div key={p} className="mt-2 rounded-xl bg-white/5 p-3">
              <p className="text-[14px] font-bold">{PLAN_NAME[p]} · {fmt(PLAN_PRICE[p])}/mes</p>
              <p className="text-[12px] text-zinc-300">{PLAN_BLURB[p]}</p>
              {plan === "tienda" && p === "mensual" && <p className="mt-1 text-[11px] text-amber-300">Tu tienda vuelve a ser una vidriera simple: sin carrito ni pedidos.</p>}
              <PayButton small label={`Pasarme a ${PLAN_NAME[p]} · ${fmt(PLAN_PRICE[p])}`} kind="mes" plan={p} />
              <p className="mt-1 text-[11px] text-zinc-400">El nuevo plan arranca el día que pagás.</p>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[12px] font-semibold text-zinc-300">Últimos pagos</p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-zinc-300">
            {history.map((h) => <li key={h.id} className="flex justify-between"><span>{dayMonth(h.paid_at)} · {h.kind === "pase" ? "Pase" : `${PLAN_NAME[h.plan]} (1 mes)`}</span><span>{fmt(h.amount)}</span></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}

function DueLine({ status, due }) {
  if (status === "prueba") return <p className="mt-1 text-[13px] text-zinc-300">Prueba gratis hasta el <b className="text-white">{dayMonth(due)}</b> ({daysLeft(due)} {daysLeft(due) === 1 ? "día" : "días"}).</p>;
  if (status === "activa") return <p className="mt-1 text-[13px] text-zinc-300">Pagado hasta el <b className="text-white">{dayMonth(due)}</b>.</p>;
  if (status === "gracia") return (
    <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-400/15 p-2.5 text-[13px] text-amber-200"><AlertTriangle size={16} className="mt-px shrink-0" />
      <span>Tu plan venció el {dayMonth(due)}. Pagá antes del <b className="text-white">{dayMonth(addDays(due, GRACE_DAYS))}</b> para que no se pausen tus publicaciones.</span></p>
  );
  if (status === "vencida") return (
    <p className="mt-2 flex gap-1.5 rounded-xl bg-rose-500/20 p-2.5 text-[13px] text-rose-100"><PauseCircle size={16} className="mt-px shrink-0" />
      <span>Tus publicaciones están pausadas. Pagá y vuelven solas, como estaban.</span></p>
  );
  return null;
}

function PaseLine({ account }) {
  const used = account?.free_passes_used ?? 0;
  const credits = account?.pass_credits ?? 0;
  return (
    <p className="mt-1 text-[13px] text-zinc-300">
      {used < 2 ? <>Te {2 - used === 1 ? "queda" : "quedan"} <b className="text-white">{2 - used} {2 - used === 1 ? "publicación gratis" : "publicaciones gratis"}</b>.</>
        : credits > 0 ? <>Tenés <b className="text-white">{credits} {credits === 1 ? "pase" : "pases"}</b> para publicar.</>
        : <>Ya usaste tus 2 publicaciones gratis. Cada publicación nueva cuesta un pase.</>}
    </p>
  );
}

function PayButton({ label, kind, plan, small }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try { window.location.href = await payPlan(kind, plan); }
    catch { setErr("No pudimos abrir Mercado Pago. Probá de nuevo en un momento."); setBusy(false); }
  };
  return (
    <>
      <button disabled={busy} onClick={go} className={`mt-3 flex w-full items-center justify-center rounded-xl bg-[#009EE3] font-semibold text-white disabled:opacity-50 ${small ? "min-h-[42px] text-[14px]" : "min-h-[50px] text-[15px]"}`}>
        {busy ? "Abriendo Mercado Pago…" : label}
      </button>
      {err && <p className="mt-1.5 text-[12px] font-semibold text-rose-300">{err}</p>}
    </>
  );
}

function Notice({ state, account, onClose }) {
  if (state === "esperando") return <p className="mb-3 rounded-xl bg-white/10 p-3 text-[13px]">Confirmando tu pago con Mercado Pago…</p>;
  if (state === "ok") return (
    <div className="mb-3 rounded-xl bg-emerald-500/20 p-3 text-[13px] text-emerald-100">
      <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 size={16} /> ¡Pago recibido, gracias!</p>
      <p className="mt-0.5">{account?.plan === "pase" ? "Ya podés publicar." : account?.period_end ? `Tu plan está al día hasta el ${dayMonth(account.period_end)}.` : "Tu plan está al día."}</p>
      <button onClick={onClose} className="mt-1 text-[12px] font-semibold underline">Listo</button>
    </div>
  );
  return (
    <div className="mb-3 rounded-xl bg-amber-400/15 p-3 text-[13px] text-amber-100">
      <p>Todavía no vemos el pago confirmado. Si pagaste, en unos minutos se actualiza solo. Si no, podés volver a intentarlo.</p>
      <button onClick={onClose} className="mt-1 text-[12px] font-semibold underline">Entendido</button>
    </div>
  );
}
