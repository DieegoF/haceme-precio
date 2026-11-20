import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

// Vuelta desde Mercado Pago: canjea el código (en el servidor) y muestra el resultado.
export default function MpConectado() {
  const [params] = useSearchParams();
  const [st, setSt] = useState("cargando");
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return; done.current = true;
    const code = params.get("code"), state = params.get("state");
    if (!code || !state) { setSt("error"); return; }
    supabase.functions.invoke("mp-oauth", { body: { action: "finish", code, state } })
      .then(({ data, error }) => setSt(!error && data?.connected ? "ok" : "error"));
  }, [params]);
  return (
    <main className="px-6 py-16 text-center">
      {st === "cargando" && <p className="text-sm text-zinc-500">Conectando tu cuenta de Mercado Pago…</p>}
      {st === "ok" && (<>
        <CheckCircle2 size={48} className="mx-auto text-emerald-600" />
        <h1 className="mt-3 font-display text-2xl font-extrabold">¡Mercado Pago conectado!</h1>
        <p className="mt-2 text-sm text-zinc-600">Desde ahora tus clientes te van a poder pagar directo a tu cuenta.</p>
      </>)}
      {st === "error" && (<>
        <XCircle size={48} className="mx-auto text-hpred" />
        <h1 className="mt-3 font-display text-2xl font-extrabold">No se pudo conectar</h1>
        <p className="mt-2 text-sm text-zinc-600">Puede que el link haya vencido o que hayas cancelado en Mercado Pago. Probá de nuevo desde Mi cuenta.</p>
      </>)}
      {st !== "cargando" && <Link to="/panel/cuenta" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-ink px-6 font-semibold text-white">Volver a Mi cuenta</Link>}
    </main>
  );
}
