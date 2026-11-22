import React, { useEffect, useState } from "react";
import { isProdHost, supabaseConfigured, supabaseUrl, supabaseKey } from "./lib/supabase.js";

// Página /estado: chequea que la app esté publicada y conectada a Supabase.
export default function Status() {
  const [db, setDb] = useState({ state: "checking" });
  useEffect(() => {
    if (!supabaseConfigured) return setDb({ state: "error", msg: "Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY" });
    const t0 = performance.now();
    fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: supabaseKey } })
      .then((r) => (r.ok ? setDb({ state: "ok", ms: Math.round(performance.now() - t0) }) : setDb({ state: "error", msg: `Supabase respondió ${r.status}` })))
      .catch((e) => setDb({ state: "error", msg: e.message }));
  }, []);
  const row = (label, ok, detail) => (
    <li className="flex items-start justify-between gap-3 border-b border-zinc-100 py-3 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <span className={`text-right text-sm font-semibold ${ok === true ? "text-emerald-700" : ok === false ? "text-hpred" : "text-zinc-500"}`}>{detail}</span>
    </li>
  );
  return (
    <main className="mx-auto max-w-md px-5 py-10 font-sans text-ink">
      <h1 className="font-display text-2xl font-extrabold">Estado de Haceme Precio</h1>
      <p className="mt-1 text-sm text-zinc-500">Base <b>{isProdHost ? "producción" : "pruebas"}</b> · versión {__APP_COMMIT__}</p>
      <ul className="mt-6 rounded-2xl bg-white px-4 ring-1 ring-zinc-200">
        {row("App publicada", true, "✓ OK")}
        {row("Conexión con Supabase", db.state === "checking" ? null : db.state === "ok", db.state === "checking" ? "Revisando…" : db.state === "ok" ? `✓ OK (${db.ms} ms)` : `✗ ${db.msg}`)}
      </ul>
      <a href="/" className="mt-6 inline-block text-sm font-semibold text-hpred underline">Ir al inicio</a>
    </main>
  );
}
