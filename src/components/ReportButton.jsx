import React, { useState } from "react";
import { Flag, X } from "lucide-react";
import { REPORT_REASONS, submitReport } from "../lib/reports.js";

const WHAT = { producto: "esta publicación", vendedor: "este vendedor", resena: "esta opinión" };

// Link chiquito «Denunciar» que abre una hoja con los motivos.
export default function ReportButton({ kind, target, className = "" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState(null); // null | "enviando" | "ok" | "ya" | "error"
  const send = async () => {
    setState("enviando");
    try { const r = await submitReport(kind, target, reason, detail.trim()); setState(r === "YA_DENUNCIADO" ? "ya" : "ok"); }
    catch (e) { setState(String(e?.message || "").includes("PROPIO") ? "propio" : "error"); }
  };
  const close = () => { setOpen(false); setReason(""); setDetail(""); setState(null); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1 text-[12px] font-semibold text-zinc-500 underline-offset-2 hover:underline ${className}`}>
        <Flag size={12} /> Denunciar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={close}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-xl font-extrabold">Denunciar {WHAT[kind]}</p>
              <button onClick={close} aria-label="Cerrar" className="rounded-full p-1 hover:bg-zinc-100"><X size={18} /></button>
            </div>
            {state === "ok" || state === "ya" ? (
              <>
                <p className="mt-3 text-[15px]">{state === "ok" ? "¡Gracias! Lo vamos a revisar." : "Ya nos avisaste de esto. Lo estamos revisando."}</p>
                <button onClick={close} className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-ink font-semibold text-white">Listo</button>
              </>
            ) : (
              <>
                <p className="mt-1 text-[13px] text-zinc-500">Nadie se entera de que fuiste vos.</p>
                <div className="mt-3 grid gap-2">
                  {REPORT_REASONS.map(([k, l]) => (
                    <label key={k} className={`flex min-h-[46px] cursor-pointer items-center gap-2 rounded-xl px-3 text-[15px] ring-1 ${reason === k ? "bg-zinc-900 text-white ring-zinc-900" : "ring-zinc-300"}`}>
                      <input type="radio" name="motivo" value={k} checked={reason === k} onChange={() => setReason(k)} className="sr-only" /> {l}
                    </label>
                  ))}
                </div>
                {reason && <textarea value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 300))} rows={2} placeholder="Contanos un poco más (opcional)" className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px] outline-none focus:border-zinc-900" />}
                {state === "error" && <p className="mt-2 text-[13px] font-semibold text-rose-700">No pudimos enviarla. Probá de nuevo.</p>}
                {state === "propio" && <p className="mt-2 text-[13px] font-semibold text-rose-700">No podés denunciar algo tuyo.</p>}
                <button disabled={!reason || state === "enviando"} onClick={send} className="mt-3 flex min-h-[50px] w-full items-center justify-center rounded-2xl bg-hpred font-semibold text-white disabled:opacity-40">
                  {state === "enviando" ? "Enviando…" : "Enviar denuncia"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
