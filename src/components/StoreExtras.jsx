import React, { useState } from "react";
import { ChevronDown, Truck, Zap } from "lucide-react";
import { activePromo, countdown } from "../lib/promo.js";
import { useNow } from "../lib/offers.js";
import { fmt } from "../lib/format.js";

// Franja de promo con cuenta regresiva (se oculta sola cuando vence).
export function PromoBanner({ store, className = "" }) {
  const now = useNow(1000);
  const promo = activePromo(store, now);
  if (!promo) return null;
  return (
    <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-white ${className}`} style={{ backgroundColor: store.color }}>
      <Zap size={18} className="shrink-0" />
      <p className="min-w-0 flex-1 text-[14px] font-bold leading-tight">{promo.text}
        {promo.scope !== "Todo" && <span className="block text-[11px] font-medium opacity-90">en {promo.scope}</span>}</p>
      <span className="shrink-0 rounded-lg bg-black/20 px-2 py-1 font-mono text-[13px] font-bold tabular-nums">{countdown(promo.ends_at, now)}</span>
    </div>
  );
}

export function FreeShipNote({ store, className = "" }) {
  if (!store?.shipping_enabled || !store.free_ship_from) return null;
  return <p className={`flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700 ${className}`}><Truck size={14} /> Envío gratis desde {fmt(store.free_ship_from)}</p>;
}

// Preguntas frecuentes de la tienda (acordeón).
export function StoreFaq({ store }) {
  const [open, setOpen] = useState(null);
  const faq = store?.faq || [];
  if (!faq.length) return null;
  return (
    <section className="mt-8 px-4">
      <h2 className="px-1 font-display text-lg font-extrabold">Preguntas frecuentes</h2>
      <ul className="mt-2 divide-y divide-zinc-100 rounded-2xl ring-1 ring-zinc-200">
        {faq.map((f, i) => (
          <li key={i}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left text-[14px] font-semibold">
              {f.q} <ChevronDown size={16} className={`shrink-0 transition ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="whitespace-pre-line px-4 pb-4 text-[14px] text-zinc-600">{f.a}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
