import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { MessageCircle, Store, Truck } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { sellerOrderAction, orderError, ORDER_STATUS } from "../../lib/cart.js";
import { useNow, left, waLink } from "../../lib/offers.js";
import { fmt } from "../../lib/format.js";
import Resumen from "./Resumen.jsx";

// Pedidos de la tienda: nuevos (stock reservado 24 h), confirmados y el historial.
export default function Pedidos() {
  const { seller } = useOutletContext();
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  const now = useNow(30000);

  const load = async () => {
    const { data, error } = await supabase.from("orders")
      .select("id, code, status, buyer_name, buyer_contact, delivery, address, note, total, free_shipping, expires_at, created_at, cancelled_by, order_items(title, photo, color, size, qty, unit_price)")
      .order("created_at", { ascending: false }).limit(100);
    if (error) setErr("No pudimos cargar tus pedidos. Recargá la página.");
    else { setErr(""); setOrders(data); setTick((t) => t + 1); }
  };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!orders) return <p className="py-20 text-center text-sm text-zinc-500">{err || "Cargando pedidos…"}</p>;
  const nuevos = orders.filter((o) => o.status === "reservado" && new Date(o.expires_at) > now);
  const confirmados = orders.filter((o) => o.status === "confirmado");
  const historial = orders.filter((o) => !nuevos.includes(o) && !confirmados.includes(o));

  return (
    <main className="px-5 pb-8 pt-5">
      <h1 className="font-display text-2xl font-extrabold">Tu tienda</h1>
      <Resumen refreshKey={Math.floor(tick / 4)} />
      <h2 className="mt-8 font-display text-xl font-extrabold">Pedidos</h2>
      {err && <p className="mt-2 text-sm font-semibold text-hpred">{err}</p>}
      {!orders.length && (
        <div className="mt-6 rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-600 ring-1 ring-zinc-200">
          Todavía no tenés pedidos. Compartí el link de tu tienda: <b>/{seller.slug}</b>. Cuando alguien compre, te llega un mail y aparece acá.
        </div>
      )}
      <Section title="Nuevos" hint="Les guardamos el stock 24 h. Confirmalos y escribiles para coordinar el pago." list={nuevos} seller={seller} now={now} onDone={load} />
      <Section title="Confirmados" hint="Coordiná el pago y la entrega. Cuando lo entregues, marcalo." list={confirmados} seller={seller} now={now} onDone={load} />
      <Section title="Historial" list={historial} seller={seller} now={now} onDone={load} compact />
    </main>
  );
}

function Section({ title, hint, list, ...rest }) {
  if (!list.length) return null;
  return (
    <section className="mt-6">
      <h2 className="text-sm font-bold">{title} <span className="text-zinc-400">({list.length})</span></h2>
      {hint && <p className="text-[12px] text-zinc-500">{hint}</p>}
      <ul className="mt-2 space-y-3">{list.map((o) => <OrderCard key={o.id} o={o} {...rest} />)}</ul>
    </section>
  );
}

function OrderCard({ o, seller, now, onDone, compact }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const status = o.status === "reservado" && new Date(o.expires_at) <= now ? "vencido" : o.status;
  const st = ORDER_STATUS[status];
  const units = o.order_items.reduce((t, i) => t + i.qty, 0);
  const lines = o.order_items.map((i) => `• ${i.qty} × ${i.title}${i.color || i.size ? ` (${[i.color, i.size && `talle ${i.size}`].filter(Boolean).join(", ")})` : ""}`).join("\n");
  const msg = `¡Hola ${o.buyer_name}! Te escribo de ${seller.name} por tu pedido #${o.code}:\n${lines}\nTotal: ${fmt(o.total)}.\n`;

  const run = async (action) => {
    setBusy(true); setErr("");
    try { await sellerOrderAction(o.id, action); await onDone(); } catch (e) { setErr(orderError(e)); }
    setBusy(false); setConfirm(false);
  };
  const open = ["reservado", "confirmado"].includes(status);

  return (
    <li className={`rounded-2xl bg-white p-4 ring-1 ${status === "reservado" ? "ring-2 ring-amber-300" : "ring-zinc-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold text-zinc-500">#{o.code} · {new Date(o.created_at).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          <p className="text-[16px] font-bold">{o.buyer_name} · {fmt(o.total)}</p>
          <p className="text-[12px] text-zinc-500">{units} {units === 1 ? "producto" : "productos"}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.tone}`}>{status === "reservado" ? `Vence en ${left(o.expires_at, now)}` : st.label}</span>
      </div>

      {!compact && (
        <>
          <ul className="mt-3 space-y-2">
            {o.order_items.map((i, n) => (
              <li key={n} className="flex items-center gap-2.5">
                {i.photo ? <img src={i.photo} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-zinc-100" />}
                <p className="min-w-0 flex-1 text-[13px]"><b>{i.qty} ×</b> {i.title}{(i.color || i.size) && <span className="text-zinc-500"> · {[i.color, i.size].filter(Boolean).join(" · ")}</span>}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex gap-1.5 text-[13px] text-zinc-600">{o.delivery === "envio" ? <><Truck size={15} className="mt-0.5 shrink-0" /> Envío{o.free_shipping ? <b className="text-emerald-700">&nbsp;gratis</b> : ""} a {o.address}</> : <><Store size={15} className="mt-0.5 shrink-0" /> Retira en el local</>}</p>
          {o.note && <p className="mt-1 text-[13px] text-zinc-600">💬 {o.note}</p>}
        </>
      )}

      {open && (
        <>
          <a href={waLink(o.buyer_contact, msg)} target="_blank" rel="noreferrer" className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[14px] font-semibold text-white">
            <MessageCircle size={16} /> Escribirle por WhatsApp
          </a>
          {confirm ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirm(false)} className="min-h-[42px] rounded-xl text-[13px] font-semibold ring-1 ring-zinc-300">No</button>
              <button disabled={busy} onClick={() => run("cancelar")} className="min-h-[42px] rounded-xl bg-rose-600 text-[13px] font-semibold text-white">Sí, cancelar y liberar stock</button>
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button disabled={busy} onClick={() => setConfirm(true)} className="min-h-[42px] rounded-xl text-[13px] font-semibold ring-1 ring-zinc-300">Cancelar</button>
              {status === "reservado"
                ? <button disabled={busy} onClick={() => run("confirmar")} className="min-h-[42px] rounded-xl bg-ink text-[13px] font-semibold text-white">Confirmar pedido</button>
                : <button disabled={busy} onClick={() => run("entregado")} className="min-h-[42px] rounded-xl bg-ink text-[13px] font-semibold text-white">Ya lo entregué</button>}
            </div>
          )}
        </>
      )}
      {compact && status === "cancelado" && <p className="mt-1 text-[12px] text-zinc-500">Lo canceló {o.cancelled_by === "comprador" ? "el cliente" : o.cancelled_by === "sistema" ? "el sistema" : "vos"}.</p>}
      {err && <p className="mt-2 text-[13px] font-semibold text-hpred">{err}</p>}
    </li>
  );
}
