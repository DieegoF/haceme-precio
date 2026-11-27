import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Eye, Handshake, Inbox, MessageCircle, Package, Radar, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { useNow } from "../../lib/offers.js";
import { ORDER_STATUS } from "../../lib/cart.js";

// Registro único de widgets del panel. Cada widget dice para quién es:
//   "vendedor" (Gratis / Básico) o "tienda" (modo Tienda).
// Para sumar uno nuevo: agregalo acá; los datos salen de un solo RPC por área.
export const WIDGETS = [
  { id: "ofertas", for: ["vendedor"], Component: OffersWidget },
  { id: "publicaciones", for: ["vendedor"], Component: ProductsWidget },
  { id: "visitas", for: ["vendedor"], Component: VisitsWidget },
  { id: "compartir", for: ["vendedor"], Component: ShareWidget },
  { id: "negociacion", for: ["tienda"], Component: NegotiationWidget },
  { id: "pedidos-estado", for: ["tienda"], Component: OrdersStatusWidget },
  { id: "mas-vistos", for: ["tienda"], Component: TopViewedWidget, wide: true },
  { id: "origen", for: ["tienda"], Component: SourcesWidget, wide: true },
];

// De dónde salen los números de cada área (un solo pedido al servidor por área).
const SOURCE = {
  vendedor: () => supabase.rpc("seller_home"),
  tienda: (period) => supabase.rpc("store_insights", { p_period: period }),
};
const GRID = {
  vendedor: "grid-cols-2 lg:grid-cols-4",
  tienda: "grid-cols-1 sm:grid-cols-2",
};

// refreshKey: cuando cambia (p. ej. la lista de ofertas se recargó), los números se vuelven a pedir.
// period: solo para la tienda ('hoy' | '7d' | 'mes').
export default function PanelWidgets({ seller, refreshKey, period = "mes" }) {
  const area = seller.is_store ? "tienda" : "vendedor";
  const list = WIDGETS.filter((w) => w.for.includes(area));
  const [data, setData] = useState(null);
  useEffect(() => {
    const fetcher = SOURCE[area];
    if (!fetcher || !list.length) return undefined;
    let alive = true;
    setData(null);
    fetcher(period).then(({ data: d }) => { if (alive && d) setData(d); });
    return () => { alive = false; };
  }, [area, list.length, refreshKey, period]);

  if (!list.length) return null;
  return (
    <section aria-label="Tu resumen" className={`mt-4 grid gap-2 ${GRID[area]}`}>
      {list.map(({ id, Component, wide }) => (
        <div key={id} className={wide ? "sm:col-span-2" : undefined}>
          {data ? <Component data={data} seller={seller} /> : <div className="h-[112px] animate-pulse rounded-2xl bg-zinc-100" />}
        </div>
      ))}
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

// ───────────── Widgets del modo Tienda ─────────────

function Box({ Icon, label, children }) {
  return (
    <div className="h-full rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500"><Icon size={14} /> {label}</p>
      {children}
    </div>
  );
}

function NegotiationWidget({ data }) {
  const { received, accepted, auto_stopped: stopped, avg_discount: disc } = data.negotiation;
  if (!received) {
    return <Card Icon={Handshake} label="Negociación" value="—"
      sub="No recibiste ofertas en este período. Activá «Acepta ofertas» en los productos que quieras negociar." />;
  }
  const extra = [`${accepted} de ${received} cerraron trato`, stopped && `${stopped} ${stopped === 1 ? "frenada" : "frenadas"} sola${stopped === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
  return <Card Icon={Handshake} label="Descuento promedio negociado" value={accepted ? `−${disc}%` : "—"} sub={extra} />;
}

function OrdersStatusWidget({ data }) {
  const entries = Object.keys(ORDER_STATUS).filter((k) => data.orders[k]);
  const total = entries.reduce((a, k) => a + data.orders[k], 0);
  return (
    <Box Icon={ShoppingBag} label="Pedidos por estado">
      <p className="mt-1 font-display text-[28px] font-black leading-none">{total}</p>
      {total ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {entries.map((k) => <span key={k} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ORDER_STATUS[k].tone}`}>{data.orders[k]} {ORDER_STATUS[k].label.toLowerCase()}</span>)}
        </div>
      ) : <p className="mt-1.5 text-[12px] text-zinc-500">Sin pedidos en este período.</p>}
    </Box>
  );
}

function TopViewedWidget({ data }) {
  const items = data.products;
  return (
    <Box Icon={Eye} label="Lo más visto y cuánto se vendió">
      {!items.length ? <p className="mt-2 text-[13px] text-zinc-500">Todavía no hay visitas a productos en este período. Se empiezan a contar desde hoy.</p> : (
        <ul className="mt-2 space-y-2">
          {items.map((p) => {
            const cold = p.views >= 5 && !p.sold;
            return (
              <li key={p.id} className="flex items-center gap-2.5">
                {p.photo ? <img src={p.photo} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100 object-cover" /> : <span className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100" />}
                <Link to={`/panel/producto/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{p.title}</p>
                  {cold
                    ? <p className="text-[12px] font-semibold text-amber-700">Lo miran y no lo compran: revisá precio o fotos</p>
                    : <p className="text-[12px] text-zinc-500">{p.sold ? `${p.sold} ${p.sold === 1 ? "vendido" : "vendidos"}` : "sin ventas todavía"}</p>}
                </Link>
                <span className="shrink-0 text-right text-[13px] font-bold">{p.views}<span className="block text-[10px] font-semibold text-zinc-400">visitas</span></span>
              </li>
            );
          })}
        </ul>
      )}
    </Box>
  );
}

const SOURCE_LABEL = { whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", directo: "Link directo", otro: "Otros sitios" };
const SOURCE_BAR = { whatsapp: "bg-[#25D366]", instagram: "bg-pink-500", facebook: "bg-blue-600", directo: "bg-ink", otro: "bg-zinc-400" };

function SourcesWidget({ data }) {
  const rows = Object.entries(data.sources).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, n]) => a + n, 0);
  return (
    <Box Icon={Radar} label="De dónde vienen tus visitas">
      {!total ? <p className="mt-2 text-[13px] text-zinc-500">Se empiezan a contar desde hoy. Compartí tu link en WhatsApp e Instagram y acá vas a ver cuál te trae más gente.</p> : (
        <ul className="mt-2 space-y-2">
          {rows.map(([k, n]) => {
            const pct = Math.round((n / total) * 100);
            return (
              <li key={k}>
                <div className="flex justify-between text-[13px]"><span className="font-medium">{SOURCE_LABEL[k] || k}</span><span className="font-bold">{pct}% <span className="font-normal text-zinc-400">({n})</span></span></div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100"><div className={`h-2 rounded-full ${SOURCE_BAR[k] || "bg-zinc-400"}`} style={{ width: `${Math.max(pct, 3)}%` }} /></div>
              </li>
            );
          })}
        </ul>
      )}
    </Box>
  );
}
