import React, { useMemo, useState } from "react";
import { MessageCircle, Minus, Plus } from "lucide-react";
import { Swatch, sortSizes } from "../lib/variants.jsx";
import { fmt } from "../lib/format.js";
import { waLink } from "../lib/offers.js";

// Compra en una tienda (precio fijo): color → talle → cantidad. Por ahora «Lo quiero» abre WhatsApp;
// en la parte 3 de la fase 3 lo reemplaza el carrito.
export default function StoreBuy({ product: p, seller, store, color, onColor }) {
  const variants = p.product_variants || [];
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))], [variants]);
  const sizes = useMemo(() => sortSizes([...new Set(variants.map((v) => v.size).filter(Boolean))]), [variants]);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const stockOf = (c, s) => variants.find((v) => v.color === (c || "") && v.size === (s || ""))?.stock ?? 0;
  const colorStock = (c) => variants.filter((v) => v.color === c).reduce((t, v) => t + v.stock, 0);

  const needColor = colors.length > 0, needSize = sizes.length > 0;
  const ready = p.has_variants ? (!needColor || color) && (!needSize || size) : true;
  const available = p.has_variants ? (ready ? stockOf(color, size) : null) : p.stock;
  const soldOut = p.stock <= 0;
  const max = Math.max(1, available || 1);

  const label = [color, size && `talle ${size}`].filter(Boolean).join(", ");
  const msg = `¡Hola ${seller.name}! Quiero ${qty > 1 ? `${qty} × ` : ""}«${p.title}»${label ? ` (${label})` : ""} a ${fmt(p.list_price)} que vi en tu tienda: ${window.location.href}`;

  return (
    <div className="mt-4 space-y-4">
      {needColor && (
        <div>
          <p className="text-[13px] font-semibold">Color: <span className="font-normal text-zinc-600">{color || "elegí uno"}</span></p>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {colors.map((c) => <Swatch key={c} name={c} size={34} selected={color === c} disabled={colorStock(c) === 0} onClick={() => { onColor(c); setSize(null); setQty(1); }} />)}
          </div>
        </div>
      )}
      {needSize && (
        <div>
          <p className="text-[13px] font-semibold">Talle</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const st = needColor ? (color ? stockOf(color, s) : null) : stockOf("", s);
              const off = st === 0;
              return (
                <button key={s} type="button" disabled={off || (needColor && !color)} onClick={() => { setSize(s); setQty(1); }}
                  className={`min-w-[48px] rounded-xl px-3 py-2.5 text-[14px] font-semibold ring-1 ${size === s ? "bg-ink text-white ring-ink" : "bg-white ring-zinc-300"} ${off ? "text-zinc-300 line-through" : ""} disabled:cursor-not-allowed`}>
                  {s}
                </button>
              );
            })}
          </div>
          {needColor && !color && <p className="mt-1 text-[12px] text-zinc-500">Elegí primero el color.</p>}
        </div>
      )}
      {ready && available !== null && !soldOut && (
        <p className={`text-[13px] font-semibold ${available <= 3 ? "text-hpred" : "text-emerald-700"}`}>
          {available === 0 ? "Sin stock en esta combinación" : available === 1 ? "¡Queda 1!" : available <= 3 ? `¡Quedan ${available}!` : "Hay stock"}
        </p>
      )}
      {ready && available > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold">Cantidad</span>
          <div className="flex items-center rounded-xl ring-1 ring-zinc-300">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2" aria-label="Menos"><Minus size={15} /></button>
            <span className="w-8 text-center font-semibold">{qty}</span>
            <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} className="px-3 py-2" aria-label="Más"><Plus size={15} /></button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-zinc-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        {soldOut ? (
          <p className="flex min-h-[52px] items-center justify-center rounded-2xl bg-zinc-100 font-semibold text-zinc-500">Sin stock por ahora</p>
        ) : ready && available > 0 ? (
          <a href={waLink(store?.whatsapp, msg)} target="_blank" rel="noreferrer" style={{ backgroundColor: store?.color || "#C8102E" }}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold text-white">
            <MessageCircle size={18} /> Lo quiero · {fmt(p.list_price * qty)}
          </a>
        ) : (
          <p className="flex min-h-[52px] items-center justify-center rounded-2xl bg-zinc-100 text-[15px] font-semibold text-zinc-500">{needColor && !color ? "Elegí color" : "Elegí tu talle"}</p>
        )}
      </div>
    </div>
  );
}
