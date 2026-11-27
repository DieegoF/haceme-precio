import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Eye, Inbox, MessageCircle, Package, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { useNow } from "../../lib/offers.js";

// Registro único de widgets del panel. Cada widget dice para quién es:
//   "vendedor" (Gratis / Básico) o "tienda" (modo Tienda).
// Para sumar uno nuevo: agregalo acá; los datos salen de un solo RPC por área.
export const WIDGETS = [
  { id: "ofertas", for: ["vendedor"], Component: OffersWidget },
  { id: "publicaciones", for: ["vendedor"], Component: ProductsWidget },
  { id: "visitas", for: ["vendedor"], Component: VisitsWidget },
  { id: "compartir", for: ["vendedor"], Component: ShareWidget },
];

const SOURCE = { vendedor: "seller_home" };

// refreshKey: cuando cambia (p. ej. la lista de ofertas se recargó), los números se vuelven a pedir.
export default function PanelWidgets({ seller, refreshKey }) {
  const area = seller.is_store ? "tienda" : "vendedor";
  const list = WIDGETS.filter((w) => w.for.includes(area));
  const [data, setData] = useState(null);
  useEffect(() => {
    const rpc = SOURCE[area];
    if (!rpc || !list.length) return undefined;
    let alive = true;
    const load = () => supabase.rpc(rpc).then(({ data: d }) => { if (alive && d) setData(d); });
    load();
    return () => { alive = false; };
  }, [area, list.length, refreshKey]);

  if (!list.length) return null;
  return (
    <section aria-label="Tu resumen" className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {list.map(({ id, Component }) => data
        ? <Component key={id} data={data} seller={seller} />
        : <div key={id} className="h-[112px] animate-pulse rounded-2xl bg-zinc-100" />)}
    </section>
  );
}

// Tarjeta base: grande, con un número y una línea que dice qué hacer.
function Card({ to, href, onClick, tone = "plain", Icon, label, value, sub, subTone }) {
  const tones = {
    plain: "bg-white ring-1 ring-zinc-200 text-ink",
    alert: "bg-hpred text-white",
    whatsapp: "bg-[#25D366] text-white",
  };
  const inner = (
    <>
      <p className={`flex items-center gap-1.5 text-[12px] font-semibold ${tone === "plain" ? "text-zinc-500" : "text-white/85"}`}><Icon size={14} /> {label}</p>
      <p className={`mt-1 font-display font-black leading-none ${String(value).length > 5 ? "text-[22px]" : "text-[28px]"}`}>{value}</p>
      {sub && <p className={`mt-1.5 text-[12px] leading-snug ${subTone || (tone === "plain" ? "text-zinc-500" : "text-white/85")}`}>{sub}</p>}
    </>
  );
  const cls = `block min-h-[112px] rounded-2xl p-3.5 text-left transition active:scale-[0.98] ${tones[tone]}`;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

function OffersWidget({ data }) {
  const now = useNow(30000);
  const { pending, deals, next_expiry: next } = data.offers;
  const hours = next ? Math.max(0, Math.floor((new Date(next) - now) / 3600000)) : null;
  const go = () => document.getElementById("para-responder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (!pending) {
    return <Card onClick={deals ? () => document.getElementById("trato-hecho")?.scrollIntoView({ behavior: "smooth" }) : undefined}
      Icon={Inbox} label="Para responder" value="0"
      sub={deals ? `${deals} ${deals === 1 ? "trato para coordinar" : "tratos para coordinar"}` : "Te avisamos cuando llegue una oferta."} />;
  }
  return (
    <Card tone="alert" onClick={go} Icon={Clock} label="Para responder" value={pending}
      sub={hours === null ? "Respondé antes de que venzan." : hours < 1 ? "¡La primera vence en menos de 1 hora!" : `La primera vence en ${hours} h`} />
  );
}

function ProductsWidget({ data }) {
  const { active, sold, paused } = data.products;
  const extra = [sold && `${sold} ${sold === 1 ? "vendido" : "vendidos"}`, paused && `${paused} ${paused === 1 ? "pausado" : "pausados"}`].filter(Boolean).join(" · ");
  return <Card to="/panel/productos" Icon={Package} label="Publicados" value={active}
    sub={extra || (active ? "Tocá para verlos" : "Cargá tu primer producto")} />;
}

function VisitsWidget({ data }) {
  const { visits, prev_visits: prev } = data;
  let sub = "Compartí tu link para sumar visitas.", subTone;
  if (prev > 0) {
    const d = Math.round(((visits - prev) / prev) * 100);
    sub = <span className="inline-flex items-center gap-1">{d >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{d >= 0 ? "+" : ""}{d}% vs. la semana pasada</span>;
    subTone = d >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700";
  } else if (visits > 0) sub = "en los últimos 7 días";
  return <Card Icon={Eye} label="Visitas (7 días)" value={visits} sub={sub} subTone={subTone} />;
}

function ShareWidget({ seller }) {
  const url = `${window.location.origin}/${seller.slug}?ref=wa`;
  const text = `Mirá lo que tengo a la venta y haceme precio 👉 ${url}`;
  return <Card tone="whatsapp" href={`https://wa.me/?text=${encodeURIComponent(text)}`} Icon={MessageCircle}
    label="WhatsApp" value="Compartir" sub="Mandá tu vidriera a tus contactos o a tu estado." />;
}
