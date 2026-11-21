import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, MessageCircle, Store, Truck } from "lucide-react";
import { Phone } from "../../components/Brand.jsx";
import { StoreAvatar } from "../../components/StoreBrand.jsx";
import { getMyOrders, cancelMyOrder, orderError, ORDER_STATUS, payOrder, syncOrderPayment } from "../../lib/cart.js";
import { useNow, left, waLink } from "../../lib/offers.js";
import { fmt } from "../../lib/format.js";

// Seguimiento del pedido para el comprador (sin cuenta: lo reconoce por su navegador).
export default function OrderPage() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const now = useNow(30000);
  const [params] = useSearchParams();
  const [paying, setPaying] = useState(false);

  const load = async (sync) => {
    try {
      if (sync) await syncOrderPayment(id);
      let list = await getMyOrders();
      const cur = list.find((x) => x.id === id);
      // Esperando el pago de MP: le preguntamos al servidor (que consulta a MP) en cada vuelta.
      if (!sync && cur?.pay_mode === "mp" && cur.payment_status === "pendiente" && cur.status === "reservado") {
        await syncOrderPayment(id); list = await getMyOrders();
      }
      setState({ loading: false, order: list.find((o) => o.id === id) || null });
    } catch { setState({ loading: false, order: null, failed: true }); }
  };
  useEffect(() => { load(Boolean(params.get("mp"))); const t = setInterval(() => load(false), 15000); return () => clearInterval(t); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.loading) return <Phone><p className="py-24 text-center text-sm text-zinc-500">Cargando tu pedido…</p></Phone>;
  const o = state.order;
  if (!o) return (
    <Phone>
      <main className="px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-extrabold">No encontramos el pedido</h1>
        <p className="mt-2 text-sm text-zinc-600">{state.failed ? "Revisá tu conexión y recargá." : "Los pedidos se ven desde el mismo celular con el que se hicieron."}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-hpred underline">Ir al inicio</Link>
      </main>
    </Phone>
  );

  const s = o.seller;
  const st = ORDER_STATUS[o.status];
  const color = s.color || "#C8102E";
  const lines = o.items.map((i) => `• ${i.qty} × ${i.title}${i.color || i.size ? ` (${[i.color, i.size && `talle ${i.size}`].filter(Boolean).join(", ")})` : ""}`).join("\n");
  const msg = `¡Hola ${s.name}! Soy ${o.buyer_name}, te hice el pedido #${o.code}:\n${lines}\nTotal: ${fmt(o.total)}\n${o.delivery === "envio" ? `Envío a: ${o.address}` : "Lo retiro en el local"}.\n¿Cómo te pago?`;

  const waitingPay = o.pay_mode === "mp" && o.payment_status === "pendiente" && o.status === "reservado";
  const pay = async () => {
    setPaying(true); setErr("");
    try { window.location.href = await payOrder(o.id); } catch { setErr("No pudimos abrir Mercado Pago. Probá de nuevo en un momento."); setPaying(false); }
  };

  const cancel = async () => {
    setBusy(true); setErr("");
    try { await cancelMyOrder(o.id); await load(); setConfirmCancel(false); } catch (e) { setErr(orderError(e)); }
    setBusy(false);
  };

  return (
    <Phone className="pb-12">
      <header className="flex items-center gap-3 px-5 pt-5">
        <StoreAvatar name={s.name} logo={s.logo_url} color={color} size={44} />
        <div className="min-w-0">
          <p className="truncate font-bold">{s.name}</p>
          <Link to={`/${s.slug}`} className="text-[12px] font-semibold text-zinc-500 underline">Ver la tienda</Link>
        </div>
      </header>

      <main className="px-5">
        <section className="mt-5 rounded-3xl p-5 text-white" style={{ backgroundColor: color }}>
          <CheckCircle2 size={28} />
          <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight">{o.payment_status === "pagado" ? "¡Pago aprobado!" : waitingPay ? "Falta pagar" : o.status === "reservado" ? "¡Pedido enviado!" : st.label}</h1>
          <p className="mt-1 text-[14px] opacity-90">Pedido <b>#{o.code}</b></p>
          {waitingPay && <p className="mt-3 text-[14px] opacity-95">Te guardamos todo por <b>{left(o.expires_at, now)}</b> más. Pagá con Mercado Pago para confirmar el pedido.</p>}
          {o.status === "reservado" && !waitingPay && <p className="mt-3 text-[14px] opacity-95">Te guardamos todo por <b>{left(o.expires_at, now)}</b> más. {s.name} te va a escribir por WhatsApp para coordinar el pago y la entrega.</p>}
          {o.payment_status === "pagado" && <p className="mt-3 text-[14px] opacity-95">Recibimos tu pago de {fmt(o.total)}. {s.name} ya tiene tu pedido: coordiná la {o.delivery === "envio" ? "entrega" : "retirada"} por WhatsApp.</p>}
          {o.status === "confirmado" && o.payment_status !== "pagado" && <p className="mt-3 text-[14px] opacity-95">{s.name} confirmó tu pedido. Coordiná con el local el pago y la entrega.</p>}
          {o.status === "entregado" && <p className="mt-3 text-[14px] opacity-95">¡Que lo disfrutes!</p>}
          {o.status === "cancelado" && <p className="mt-3 text-[14px] opacity-95">{o.cancelled_by === "comprador" ? "Cancelaste este pedido." : "El local canceló este pedido."}</p>}
          {o.status === "vencido" && <p className="mt-3 text-[14px] opacity-95">Pasaron las 24 h sin confirmación y el stock se liberó. Podés volver a pedirlo.</p>}
        </section>

        {waitingPay && (
          <button disabled={paying} onClick={pay} className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#009EE3] text-[16px] font-semibold text-white disabled:opacity-50">
            {paying ? "Abriendo Mercado Pago…" : `Pagar ${fmt(o.total)} con Mercado Pago`}
          </button>
        )}
        {s.whatsapp && ["reservado", "confirmado"].includes(o.status) && !waitingPay && (
          <a href={waLink(s.whatsapp, msg)} target="_blank" rel="noreferrer" className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[16px] font-semibold text-white">
            <MessageCircle size={18} /> Escribirle a {s.name}
          </a>
        )}

        <h2 className="mt-7 text-sm font-bold">Tu pedido</h2>
        <ul className="mt-2 divide-y divide-zinc-100 rounded-2xl ring-1 ring-zinc-200">
          {o.items.map((i, n) => (
            <li key={n} className="flex items-center gap-3 p-3">
              {i.photo ? <img src={i.photo} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="h-12 w-12 rounded-lg bg-zinc-100" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{i.qty} × {i.title}</p>
                {(i.color || i.size) && <p className="text-[12px] text-zinc-500">{[i.color, i.size && `talle ${i.size}`].filter(Boolean).join(" · ")}</p>}
              </div>
              <span className="text-[14px] font-semibold">{fmt(i.unit_price * i.qty)}</span>
            </li>
          ))}
          <li className="flex justify-between p-3 text-[15px]"><span>Total</span><b>{fmt(o.total)}</b></li>
        </ul>
        <p className="mt-3 flex gap-2 text-[13px] text-zinc-600">
          {o.delivery === "envio" ? <><Truck size={16} className="shrink-0" /> Envío {o.free_shipping ? <b className="text-emerald-700">gratis</b> : ""} a {o.address}{!o.free_shipping && s.shipping_note ? ` · ${s.shipping_note}` : ""}</>
            : <><Store size={16} className="shrink-0" /> Retiro en {s.address || "el local"}{s.hours ? ` · ${s.hours}` : ""}</>}
        </p>
        {o.pay_mode !== "mp" && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-[12px] text-amber-900 ring-1 ring-amber-200">Pagale solo a la cuenta que te indique el local y guardá el comprobante.</p>}

        {o.status === "reservado" && (
          confirmCancel ? (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmCancel(false)} className="min-h-[44px] rounded-xl text-[14px] font-semibold ring-1 ring-zinc-300">No, dejarlo</button>
              <button disabled={busy} onClick={cancel} className="min-h-[44px] rounded-xl bg-rose-600 text-[14px] font-semibold text-white disabled:opacity-50">Sí, cancelar</button>
            </div>
          ) : <button onClick={() => setConfirmCancel(true)} className="mt-6 w-full text-center text-[13px] font-semibold text-zinc-500 underline">Cancelar el pedido</button>
        )}
        {err && <p className="mt-2 text-center text-sm font-semibold text-hpred">{err}</p>}
      </main>
    </Phone>
  );
}
