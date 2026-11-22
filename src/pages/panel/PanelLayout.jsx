import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Inbox, Package, Plus, ShoppingBag, User } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { useSeller } from "../../lib/useSeller.js";
import { slugify, validSlug } from "../../lib/slug.js";
import { BrandBar, Phone } from "../../components/Brand.jsx";
import { LOGO_HORIZ } from "../../prototype/brand.js";
import StoreSetup from "./StoreSetup.jsx";
import PlanBanner from "../../components/PlanBanner.jsx";
import { PushBanner } from "../../components/PushToggle.jsx";

// Marco del panel del vendedor: carga la cuenta, pide nombre/link la primera vez y muestra la barra de abajo.
export default function PanelLayout() {
  const ctx = useSeller();
  const { loading, seller, error } = ctx;
  // Si entró con Google eligiendo un plan, se aplica ahora (solo en cuentas recién creadas).
  React.useEffect(() => {
    let plan = null;
    try { plan = localStorage.getItem("hp_plan_elegido"); localStorage.removeItem("hp_plan_elegido"); } catch { /* nada */ }
    if (plan) supabase.rpc("claim_initial_plan", { p_plan: plan }).then(() => ctx.reload());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Phone wide="full" className="relative flex flex-col lg:min-h-screen">
      {loading ? <p className="py-20 text-center text-sm text-zinc-500">Cargando tu cuenta…</p>
        : error || !seller ? <p className="m-5 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">No pudimos cargar tu cuenta. Recargá la página; si sigue, escribinos.</p>
        : !seller.name ? <><BrandBar /><Onboarding seller={seller} account={ctx.account} onDone={ctx.reload} /></>
        : seller.is_store && !ctx.store?.ready ? <StoreSetup seller={seller} store={ctx.store} onDone={ctx.reload} />
        : (
          <div className="flex-1 lg:flex">
            <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-zinc-200 lg:px-3 lg:py-5">
              <NavLink to="/panel" end aria-label="Haceme Precio, mi panel" className="px-3"><img src={LOGO_HORIZ} alt="Haceme Precio" className="h-7 w-auto" /></NavLink>
              <p className="truncate px-3 text-[12px] font-semibold text-zinc-500">{seller.name}</p>
              <nav className="mt-5 flex flex-col gap-1">
                {seller.is_store ? <SideTab to="/panel" end Icon={ShoppingBag} label="Pedidos" /> : <SideTab to="/panel" end Icon={Inbox} label="Ofertas" />}
                <SideTab to="/panel/productos" Icon={Package} label="Productos" />
                <SideTab to="/panel/cargar" Icon={Plus} label="Cargar producto" />
                <SideTab to="/panel/cuenta" Icon={User} label="Mi cuenta" />
              </nav>
              <a href="/ayuda" target="_blank" rel="noreferrer" className="mt-auto rounded-xl px-3 py-2 text-[13px] font-semibold text-zinc-500 hover:bg-zinc-50">Ayuda</a>
              <a href={`/${seller.slug}`} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2 text-[13px] font-semibold text-hpred hover:bg-zinc-50">Ver mi {seller.is_store ? "tienda" : "vidriera"} ↗</a>
            </aside>
            <div className="min-w-0 flex-1 pb-24 lg:pb-10"><div className="lg:mx-auto lg:max-w-5xl lg:px-6"><PlanBanner account={ctx.account} />{!seller.is_demo && <PushBanner />}<Outlet context={ctx} /></div></div>
            <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto grid max-w-md grid-cols-4 lg:hidden border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
              {seller.is_store ? <Tab to="/panel" end Icon={ShoppingBag} label="Pedidos" /> : <Tab to="/panel" end Icon={Inbox} label="Ofertas" />}
              <Tab to="/panel/productos" Icon={Package} label="Productos" />
              <Tab to="/panel/cargar" Icon={Plus} label="Cargar" strong />
              <Tab to="/panel/cuenta" Icon={User} label="Mi cuenta" />
            </nav>
          </div>
        )}
    </Phone>
  );
}

function SideTab({ to, end, Icon, label }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold ${isActive ? "bg-ink text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
      <Icon size={18} /> {label}
    </NavLink>
  );
}

function Tab({ to, end, Icon, label, strong }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? "text-hpred" : "text-zinc-500"}`}>
      {strong ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-hpred text-white"><Icon size={18} /></span> : <Icon size={20} />}
      {label}
    </NavLink>
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
    if (!validSlug(finalSlug)) return setErr("Ese link no se puede usar. Probá con otro (entre 3 y 40 letras o números).");
    setBusy(true);
    const { error } = await supabase.from("sellers").update({ name: name.trim(), slug: finalSlug }).eq("id", seller.id);
    setBusy(false);
    if (error) return setErr(error.code === "23505" ? "Ese link ya está en uso. Probá con otro." : "No pudimos guardar. Probá de nuevo.");
    onDone();
  };

  return (
    <form onSubmit={save} className="px-5 pb-10 pt-6">
      <p className="text-sm font-semibold text-hpred">¡Bienvenido! Un paso y listo</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold">{isStore ? "¿Cómo se llama tu tienda?" : "¿Cómo te ven los compradores?"}</h1>
      <label className="mt-6 block text-sm font-semibold" htmlFor="name">{isStore ? "Nombre de la tienda" : "Tu nombre o el de tu emprendimiento"}</label>
      <input id="name" required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={isStore ? "Ej: Aura" : "Ej: Nico Ventas"} className={input} />
      <label className="mt-4 block text-sm font-semibold" htmlFor="slug">Tu link</label>
      <div className="mt-1 flex items-center rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3 text-sm">
        <span className="text-zinc-500">{window.location.host}/</span>
        <input id="slug" value={edited ? slug : finalSlug} onChange={(e) => { setEdited(true); setSlug(e.target.value); }} className="min-w-0 flex-1 bg-transparent font-semibold outline-none" />
      </div>
      <p className="mt-1 text-[12px] text-zinc-500">Es el link que vas a compartir en WhatsApp, Instagram o Marketplace.</p>
      {err && <p className="mt-2 text-sm font-semibold text-hpred">{err}</p>}
      <button disabled={busy || name.trim().length < 2} className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-hpred text-[15px] font-semibold text-white disabled:opacity-40">{busy ? "Guardando…" : "Guardar y seguir"}</button>
    </form>
  );
}
