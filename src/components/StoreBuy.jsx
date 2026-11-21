import React, { useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import CartSheet from "./CartSheet.jsx";
import { useCart } from "../lib/cart.js";
import { Swatch, sortSizes } from "../lib/variants.jsx";
import { fmt } from "../lib/format.js";

// Compra en una tienda (precio fijo): color → talle → cantidad → al carrito.
export default function StoreBuy({ product: p, seller, store, price, color, onColor }) {
  const unit = price ?? p.list_price;
  const variants = p.product_variants || [];
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))], [variants]);
  const sizes = useMemo(() => sortSizes([...new Set(variants.map((v) => v.size).filter(Boolean))]), [variants]);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState(false);
  const cart = useCart(seller.id);
  const stockOf = (c, s) => variants.find((v) => v.color === (c || "") && v.size === (s || ""))?.stock ?? 0;
  const colorStock = (c) => variants.filter((v) => v.color === c).reduce((t, v) => t + v.stock, 0);

  const needColor = colors.length > 0, needSize = sizes.length > 0;
  const ready = p.has_variants ? (!needColor || color) && (!needSize || size) : true;
  const available = p.has_variants ? (ready ? stockOf(color, size) : null) : p.stock;
  const soldOut = p.stock <= 0;
  const max = Math.max(1, available || 1);

  const inCart = cart.items.filter((i) => i.product_id === p.id && (i.color || "") === (color || "") && (i.size || "") === (size || "")).reduce((t, i) => t + i.qty, 0);
  const addToCart = () => {
    const photo = (color && p.color_photos?.[color]?.[0]) || p.photos?.[0] || null;
    cart.add({ product_id: p.id, slug: p.slug, title: p.title, photo, color: color || "", size: size || "", qty, price: unit, max: available });
    setAdded(true); setQty(1); setTimeout(() => setAdded(false), 2200);
  };

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

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-zinc-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:z-auto lg:mx-0 lg:mt-5 lg:max-w-none lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        {soldOut ? (
          <p className="flex min-h-[52px] items-center justify-center rounded-2xl bg-zinc-100 font-semibold text-zinc-500">Sin stock por ahora</p>
        ) : ready && available > 0 ? (
          <div className="flex gap-2">
            {cart.count > 0 && (
              <button type="button" onClick={() => setOpen(true)} className="relative flex min-h-[52px] w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-zinc-300" aria-label={`Ver carrito (${cart.count})`}>
                <ShoppingBag size={20} /><span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">{cart.count}</span>
              </button>
            )}
            <button type="button" onClick={addToCart} disabled={inCart >= available} style={{ backgroundColor: store?.color || "#C8102E" }}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold text-white disabled:opacity-50">
              {added ? <><Check size={18} /> Agregado</> : inCart >= available ? "Ya tenés todo el stock" : <><ShoppingBag size={18} /> Agregar · {fmt(unit * qty)}</>}
            </button>
          </div>
        ) : (
          <p className="flex min-h-[52px] items-center justify-center rounded-2xl bg-zinc-100 text-[15px] font-semibold text-zinc-500">{needColor && !color ? "Elegí color" : "Elegí tu talle"}</p>
        )}
      </div>
      {open && <CartSheet seller={seller} store={store} onClose={() => setOpen(false)} />}
    </div>
  );
}
