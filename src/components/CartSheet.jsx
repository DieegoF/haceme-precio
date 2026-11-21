import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingBag, Store, Trash2, Truck } from "lucide-react";
import { useCart, lineKey, placeOrder, orderError, payOrder } from "../lib/cart.js";
import { savedBuyer, saveBuyer } from "../lib/offers.js";
import { fmt } from "../lib/format.js";

// Barra flotante «Ver carrito» para la vidriera.
export function CartBar({ seller, store }) {
  const cart = useCart(seller.id);
  const [open, setOpen] = useState(false);
  if (!cart.count && !open) return null;
  return (
    <>
      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button onClick={() => setOpen(true)} style={{ backgroundColor: store?.color || "#C8102E" }}
            className="flex min-h-[52px] w-full items-center justify-between rounded-2xl px-4 text-[15px] font-semibold text-white shadow-lg">
            <span className="flex items-center gap-2"><ShoppingBag size={18} /> Ver carrito ({cart.count})</span><span>{fmt(cart.total)}</span>
          </button>
        </div>
      )}
      {open && <CartSheet seller={seller} store={store} onClose={() => setOpen(false)} />}
    </>
  );
}

// Carrito + datos para el pedido, en pantalla completa.
export default function CartSheet({ seller, store, onClose }) {
  const cart = useCart(seller.id);
  const nav = useNavigate();
  const saved = savedBuyer();
  const options = [store?.pickup && "retiro", store?.shipping_enabled && "envio"].filter(Boolean);
  const [f, setF] = useState({ name: saved.name || "", contact: saved.contact || "", delivery: options[0] || "retiro", address: saved.address || "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const color = store?.color || "#C8102E";
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      saveBuyer({ ...savedBuyer(), name: f.name.trim(), contact: f.contact.trim(), address: f.address.trim() });
      const order = await placeOrder(seller.id, f, cart.items);
      cart.clear();
      if (order.pay_mode === "mp") {
        try { window.location.href = await payOrder(order.id); return; } catch { /* si MP falla, desde el pedido puede reintentar */ }
      }
      nav(`/pedido/${order.id}`);
    } catch (ex) { setErr(orderError(ex)); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white">
      <div className="mx-auto max-w-md px-5 pb-32 pt-4">
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-[13px] font-semibold text-zinc-500"><ArrowLeft size={15} /> Seguir mirando</button>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Tu carrito</h1>
        <p className="text-[13px] text-zinc-500">en {seller.name}</p>

        {cart.items.length === 0 ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Todavía no agregaste nada.</p>
        ) : (
          <form onSubmit={submit}>
            <ul className="mt-4 divide-y divide-zinc-100">
              {cart.items.map((i) => {
                const k = lineKey(i);
                return (
                  <li key={k} className="flex gap-3 py-3">
                    {i.photo ? <img src={i.photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <span className="h-16 w-16 shrink-0 rounded-xl bg-zinc-100" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{i.title}</p>
                      {(i.color || i.size) && <p className="text-[12px] text-zinc-500">{[i.color, i.size && `talle ${i.size}`].filter(Boolean).join(" · ")}</p>}
                      <div className="mt-1.5 flex items-center justify-between">
                        <div className="flex items-center rounded-lg ring-1 ring-zinc-300">
                          <button type="button" onClick={() => (i.qty > 1 ? cart.setQty(k, i.qty - 1) : cart.remove(k))} className="px-2.5 py-1.5" aria-label="Menos">{i.qty > 1 ? <Minus size={14} /> : <Trash2 size={14} />}</button>
                          <span className="w-6 text-center text-[14px] font-semibold">{i.qty}</span>
                          <button type="button" onClick={() => cart.setQty(k, i.qty + 1)} disabled={i.qty >= (i.max || 20)} className="px-2.5 py-1.5 disabled:opacity-30" aria-label="Más"><Plus size={14} /></button>
                        </div>
                        <span className="text-[15px] font-bold">{fmt(i.price * i.qty)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {store?.shipping_enabled && store.free_ship_from > 0 && (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <p className="text-[13px] font-semibold text-emerald-800">{cart.total >= store.free_ship_from ? "🎉 ¡Tenés envío gratis!" : `Te faltan ${fmt(store.free_ship_from - cart.total)} para el envío gratis`}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (cart.total / store.free_ship_from) * 100)}%` }} /></div>
              </div>
            )}

            <p className="mt-6 text-sm font-semibold">¿Cómo lo recibís?</p>
            <div className="mt-2 space-y-2">
              {options.includes("retiro") && (
                <label className={`flex cursor-pointer gap-3 rounded-2xl p-3 ring-2 ${f.delivery === "retiro" ? "ring-ink" : "ring-zinc-200"}`}>
                  <input type="radio" name="delivery" checked={f.delivery === "retiro"} onChange={() => setF((x) => ({ ...x, delivery: "retiro" }))} className="mt-1" />
                  <span><span className="flex items-center gap-1.5 text-[14px] font-bold"><Store size={15} /> Retiro en el local</span>
                    <span className="block text-[12px] text-zinc-500">{[store.address, store.hours].filter(Boolean).join(" · ")}</span></span>
                </label>
              )}
              {options.includes("envio") && (
                <label className={`flex cursor-pointer gap-3 rounded-2xl p-3 ring-2 ${f.delivery === "envio" ? "ring-ink" : "ring-zinc-200"}`}>
                  <input type="radio" name="delivery" checked={f.delivery === "envio"} onChange={() => setF((x) => ({ ...x, delivery: "envio" }))} className="mt-1" />
                  <span><span className="flex items-center gap-1.5 text-[14px] font-bold"><Truck size={15} /> Envío</span>
                    <span className="block text-[12px] text-zinc-500">{store.free_ship_from > 0 && cart.total >= store.free_ship_from ? "Gratis" : store.shipping_note || "Costo a coordinar con el local"}</span></span>
                </label>
              )}
            </div>
            {f.delivery === "envio" && (
              <>
                <label className="mt-4 block text-sm font-semibold" htmlFor="addr">Dirección</label>
                <input id="addr" maxLength={160} value={f.address} onChange={set("address")} placeholder="Calle, número, piso, barrio" className={input} />
              </>
            )}

            <label className="mt-4 block text-sm font-semibold" htmlFor="bname">Tu nombre</label>
            <input id="bname" maxLength={40} autoComplete="given-name" value={f.name} onChange={set("name")} placeholder="Ej: Sofía" className={input} />
            <label className="mt-4 block text-sm font-semibold" htmlFor="bwa">Tu WhatsApp</label>
            <input id="bwa" inputMode="tel" autoComplete="tel" value={f.contact} onChange={set("contact")} placeholder="11 5555 1234" className={input} />
            <label className="mt-4 block text-sm font-semibold" htmlFor="bnote">Nota para el local <span className="font-normal text-zinc-500">(opcional)</span></label>
            <textarea id="bnote" maxLength={300} rows={2} value={f.note} onChange={set("note")} placeholder="Ej: paso el sábado a la mañana" className={input} />

            <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-[13px] text-zinc-600 ring-1 ring-zinc-200">
              {store?.accepts_mp
                ? <>Pagás ahora con <b>Mercado Pago</b> (tarjeta, dinero en cuenta o transferencia). Te guardamos todo por <b>30 minutos</b> mientras pagás.</>
                : <>Te guardamos todo por <b>24 horas</b>. El local te escribe por WhatsApp para coordinar el pago y la entrega.</>}
            </div>
            {err && <p className="mt-3 text-sm font-semibold text-hpred">{err}</p>}

            <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-zinc-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
              <div className="mb-2 flex justify-between px-1 text-[15px]"><span className="text-zinc-600">Total</span><b>{fmt(cart.total)}</b></div>
              <button disabled={busy} style={{ backgroundColor: color }} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl text-[16px] font-semibold text-white disabled:opacity-50">
                {busy ? (store?.accepts_mp ? "Abriendo Mercado Pago…" : "Enviando…") : store?.accepts_mp ? "Pagar con Mercado Pago" : "Hacer el pedido"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
