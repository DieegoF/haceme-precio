import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, BellOff, Loader2, Share, X } from "lucide-react";
import { pushState, enablePush, disablePush, testPush } from "../lib/push.js";

// Tarjeta de «Avisos en este celular» (Mi cuenta).
export default function PushToggle() {
  const [state, setState] = useState("cargando");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const refresh = () => pushState().then(setState).catch(() => setState("no-soportado"));
  useEffect(() => { refresh(); }, []);

  const turnOn = async () => {
    setBusy(true); setMsg("");
    try { await enablePush(); await refresh(); setMsg("¡Listo! Ahora tocá «Probar aviso»."); }
    catch (e) { setMsg(e.message === "BLOQUEADO" ? "Bloqueaste los avisos. Activalos desde el candadito de la barra de direcciones." : "No se pudieron activar. Probá de nuevo."); await refresh(); }
    setBusy(false);
  };
  const turnOff = async () => { setBusy(true); setMsg(""); try { await disablePush(); } catch { /* nada */ } await refresh(); setBusy(false); };
  const test = async () => {
    setBusy(true); setMsg("");
    try { const r = await testPush(); setMsg(r?.sent ? "Te mandamos un aviso de prueba. Si no te llegó, revisá que el celular no esté en «No molestar»." : "No encontramos este dispositivo. Apagá y volvé a prender los avisos."); }
    catch { setMsg("No pudimos mandar la prueba. Probá en un rato."); }
    setBusy(false);
  };

  return (
    <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-2 font-display text-lg font-extrabold"><Bell size={18} className="text-hpred" /> Avisos en este celular</p>
      <p className="mt-1 text-[13px] text-zinc-600">Te avisamos al toque de cada oferta, pedido y pago, aunque tengas Haceme Precio cerrado. Los mails te siguen llegando igual.</p>

      {state === "cargando" && <p className="mt-3 text-[13px] text-zinc-500">Revisando…</p>}
      {state === "activo" && (
        <>
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-200">✓ Avisos activados en este dispositivo</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={test} className="min-h-[46px] rounded-2xl bg-hpred text-[14px] font-semibold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Probar aviso"}</button>
            <button disabled={busy} onClick={turnOff} className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold ring-1 ring-zinc-300 disabled:opacity-50"><BellOff size={15} /> Apagar</button>
          </div>
        </>
      )}
      {state === "apagado" && (
        <button disabled={busy} onClick={turnOn} className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-hpred text-[15px] font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Activar avisos
        </button>
      )}
      {state === "ios-instalar" && <IosSteps />}
      {state === "bloqueado" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-950 ring-1 ring-amber-200">Los avisos están bloqueados en este navegador. Tocá el candadito al lado de la dirección → <b>Notificaciones</b> → <b>Permitir</b>, y volvé a esta pantalla.</p>}
      {state === "no-soportado" && <p className="mt-3 text-[13px] text-zinc-500">Este navegador no recibe avisos. En Android usá Chrome; en iPhone, agregá la página a la pantalla de inicio.</p>}
      {state === "sin-configurar" && <p className="mt-3 text-[13px] text-zinc-500">Los avisos todavía no están disponibles. Muy pronto.</p>}
      {msg && <p className="mt-2 text-[13px] font-semibold text-zinc-700">{msg}</p>}
    </section>
  );
}

function IosSteps() {
  return (
    <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-[13px] text-zinc-700 ring-1 ring-zinc-200">
      <p className="font-semibold">En iPhone, primero agregá Haceme Precio a tu pantalla de inicio:</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        <li>Tocá <Share size={13} className="inline -mt-0.5" /> <b>Compartir</b> (abajo en Safari).</li>
        <li>Elegí <b>Agregar a inicio</b>.</li>
        <li>Abrí Haceme Precio desde el ícono nuevo y volvé a <b>Mi cuenta</b> para activar los avisos.</li>
      </ol>
    </div>
  );
}

// Cartelito arriba del panel invitando a activar los avisos (se puede cerrar).
const DISMISS = "hp_push_banner_cerrado";
export function PushBanner() {
  const { pathname } = useLocation();
  const [state, setState] = useState(null);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(DISMISS) === "1"; } catch { return false; } });
  useEffect(() => { pushState().then(setState).catch(() => null); }, [pathname]);
  if (hidden || pathname.startsWith("/panel/cuenta") || !["apagado", "ios-instalar"].includes(state)) return null;
  const close = () => { try { localStorage.setItem(DISMISS, "1"); } catch { /* nada */ } setHidden(true); };
  return (
    <div className="mx-5 mt-4 flex items-center gap-2 rounded-2xl bg-brand-50 p-3 text-[13px] text-brand-dark ring-1 ring-brand-200 lg:mx-0">
      <Bell size={16} className="shrink-0" />
      <Link to="/panel/cuenta" className="min-w-0 flex-1"><b>Activá los avisos</b> y enterate al toque de cada oferta, aunque tengas la página cerrada.</Link>
      <button onClick={close} aria-label="Cerrar" className="shrink-0 rounded-full p-1 hover:bg-brand-100"><X size={14} /></button>
    </div>
  );
}
