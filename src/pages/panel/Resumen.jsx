import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Eye, ShoppingBag, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { fmt } from "../../lib/format.js";

const PERIODS = [["hoy", "Hoy"], ["7d", "7 días"], ["mes", "Este mes"]];
const PREV = { hoy: "ayer", "7d": "los 7 días anteriores", mes: "el mes pasado" };

// Resumen simple de la tienda: cuánto vendí, cuántos pedidos, ticket, visitas, lo más vendido y stock bajo.
export default function Resumen({ refreshKey }) {
  const [period, setPeriod] = useState("mes");
  const [m, setM] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.rpc("store_metrics", { p_period: period }).then(({ data }) => { if (alive && data) setM(data); });
    return () => { alive = false; };
  }, [period, refreshKey]);

  const delta = m && m.prev_sold > 0 ? Math.round(((m.sold - m.prev_sold) / m.prev_sold) * 100) : null;
  const conv = m && m.visits > 0 ? Math.round((m.orders / m.visits) * 100) : null;

  return (
    <section className="mt-4">
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
        {PERIODS.map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} className={`flex-1 rounded-lg py-1.5 text-[13px] font-semibold ${period === k ? "bg-white shadow-sm" : "text-zinc-500"}`}>{l}</button>
        ))}
      </div>
      {!m ? <div className="mt-3 h-40 animate-pulse rounded-2xl bg-zinc-100" /> : (
        <>
          <div className="mt-3 rounded-2xl bg-ink p-4 text-white">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-white/60"><Wallet size={13} /> Vendido</p>
            <p className="mt-1 font-display text-3xl font-black">{fmt(m.sold)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[12px] text-white/70">
              {delta === null ? `${m.sold_orders} ${m.sold_orders === 1 ? "pedido confirmado" : "pedidos confirmados"}`
                : <>{delta >= 0 ? <TrendingUp size={13} className="text-emerald-400" /> : <TrendingDown size={13} className="text-rose-400" />}
                    <b className={delta >= 0 ? "text-emerald-400" : "text-rose-400"}>{delta >= 0 ? "+" : ""}{delta}%</b> vs. {PREV[period]}</>}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Kpi Icon={ShoppingBag} label="Pedidos" value={m.orders} sub={m.pending ? `${m.pending} sin confirmar` : "todo al día"} warn={m.pending > 0} />
            <Kpi Icon={Wallet} label="Ticket prom." value={m.avg_ticket ? fmt(m.avg_ticket) : "—"} sub="por pedido" />
            <Kpi Icon={Eye} label="Visitas" value={m.visits} sub={conv !== null ? `${conv}% compró` : "a tu tienda"} />
          </div>
          {m.top.length > 0 && (
            <div className="mt-3 rounded-2xl p-3 ring-1 ring-zinc-200">
              <p className="text-[12px] font-bold uppercase tracking-wider text-zinc-400">Lo más vendido</p>
              <ol className="mt-1.5 space-y-1">
                {m.top.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 text-[14px]"><span className="w-4 font-bold text-zinc-400">{i + 1}</span><span className="min-w-0 flex-1 truncate">{t.title}</span><b>{t.units} u.</b></li>
                ))}
              </ol>
            </div>
          )}
          {m.low_stock.length > 0 && (
            <div className="mt-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-amber-800"><AlertTriangle size={13} /> Stock bajo</p>
              <ul className="mt-1.5 space-y-1">
                {m.low_stock.map((l, i) => (
                  <li key={i}>
                    <Link to={`/panel/producto/${l.id}`} className="flex items-center gap-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">{l.title}{(l.color || l.size) && <span className="text-amber-800/70"> · {[l.color, l.size].filter(Boolean).join(" ")}</span>}</span>
                      <b className={l.stock === 0 ? "text-hpred" : "text-amber-900"}>{l.stock === 0 ? "agotado" : `quedan ${l.stock}`}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Kpi({ Icon, label, value, sub, warn }) {
  return (
    <div className="rounded-2xl p-3 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500"><Icon size={12} /> {label}</p>
      <p className="mt-0.5 truncate text-[18px] font-extrabold">{value}</p>
      <p className={`truncate text-[11px] ${warn ? "font-semibold text-amber-700" : "text-zinc-400"}`}>{sub}</p>
    </div>
  );
}
