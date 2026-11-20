import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { useSeller } from "../lib/useSeller.js";
import { slugify, validSlug } from "../lib/slug.js";
import { BrandBar, Phone } from "../components/Brand.jsx";

const PLAN_NAME = { pase: "Una sola cosa", mensual: "Básico", pro: "Pro con IA", tienda: "Tienda" };
const PLAN_PRICE = { pase: "$5.000 único", mensual: "$10.000/mes", pro: "$30.000/mes", tienda: "$40.000/mes" };
const STATUS = { prueba: "Prueba gratis", activa: "Activa", gracia: "Pago pendiente", vencida: "Vencida", suspendida: "Suspendida", cancelada: "Cancelada" };
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));

export default function Panel() {
  const { session } = useAuth();
  const nav = useNavigate();
  const { loading, seller, account, error, reload } = useSeller();
  const salir = async () => { await supabase.auth.signOut(); nav("/", { replace: true }); };

  return (
    <Phone>
      <BrandBar right={<button onClick={salir} className="text-[13px] font-semibold text-zinc-500 underline">Cerrar sesión</button>} />
      <main className="px-5 pb-10 pt-6">
        {loading ? <p className="py-10 text-center text-sm text-zinc-500">Cargando tu cuenta…</p>
          : error || !seller ? <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">No pudimos cargar tu cuenta. Recargá la página; si sigue, escribinos.</p>
          : !seller.name ? <Onboarding seller={seller} account={account} onDone={reload} />
          : <Resumen seller={seller} account={account} email={session.user.email} onDemo={() => nav("/demo")} />}
      </main>
    </Phone>
  );
}

// Primer ingreso: nombre y link público.
function Onboarding({ seller, account, onDone }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isStore = account?.plan === "tienda";
  const finalSlug = edited ? slugify(slug) : slugify(name);
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";

  const save = async (e) => {
    e.preventDefault();
    setErr("");
    if (!validSlug(finalSlug)) return setErr("El link tiene que tener entre 3 y 40 letras o números.");
    setBusy(true);
    const { error } = await supabase.from("sellers").update({ name: name.trim(), slug: finalSlug }).eq("id", seller.id);
    setBusy(false);
    if (error) return setErr(error.code === "23505" ? "Ese link ya está en uso. Probá con otro." : "No pudimos guardar. Probá de nuevo.");
    onDone();
  };

  return (
    <form onSubmit={save}>
      <p className="text-sm font-semibold text-hpred">¡Bienvenido! Un paso y listo</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold">{isStore ? "¿Cómo se llama tu tienda?" : "¿Cómo te ven los compradores?"}</h1>
      <label className="mt-6 block text-sm font-semibold" htmlFor="name">{isStore ? "Nombre de la tienda" : "Tu nombre o el de tu emprendimiento"}</label>
      <input id="name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={isStore ? "Ej: Aura" : "Ej: Nico Ventas"} className={input} />
      <label className="mt-4 block text-sm font-semibold" htmlFor="slug">Tu link</label>
      <div className="mt-1 flex items-center rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3 text-sm">
        <span className="text-zinc-500">hacemeprecio.app/</span>
        <input id="slug" value={edited ? slug : finalSlug} onChange={(e) => { setEdited(true); setSlug(e.target.value); }} className="min-w-0 flex-1 bg-transparent font-semibold outline-none" />
      </div>
      <p className="mt-1 text-[12px] text-zinc-500">Es el link que vas a compartir en WhatsApp, Instagram o Marketplace.</p>
      {err && <p className="mt-2 text-sm font-semibold text-hpred">{err}</p>}
      <button disabled={busy || name.trim().length < 2} className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-hpred text-[15px] font-semibold text-white disabled:opacity-40">{busy ? "Guardando…" : "Guardar y seguir"}</button>
    </form>
  );
}

function Resumen({ seller, account, email, onDemo }) {
  const plan = account?.plan || "mensual";
  return (
    <>
      <p className="text-sm text-zinc-500">Hola 👋</p>
      <h1 className="font-display text-2xl font-extrabold">{seller.name}</h1>
      <p className="mt-1 font-mono text-[13px] text-zinc-600">hacemeprecio.app/{seller.slug}</p>

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

      <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200">
        <p className="font-semibold">Lo que viene</p>
        <p className="mt-1">Cargar productos con fotos y recibir ofertas (fase 2){seller.is_store ? ", y tu tienda con talles, carrito y pedidos (fase 3)" : ""}.</p>
        <button onClick={onDemo} className="mt-3 text-[13px] font-semibold text-hpred underline">Ver cómo va a quedar en la demo</button>
      </div>
      <p className="mt-6 text-center text-[11px] text-zinc-400">Entraste como {email}</p>
    </>
  );
}
