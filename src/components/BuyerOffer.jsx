import React, { useCallback, useEffect, useState } from "react";
import { X, Clock, CheckCircle2, XCircle, MessageCircle, Copy, ShieldCheck } from "lucide-react";
import { buyerToken, submitOffer, getMyOffers, answerCounter, offerError, savedBuyer, saveBuyer, useNow, left, hhmm, payOffer, syncOfferPayment } from "../lib/offers.js";
import { fmt, parseMoney, moneyInput } from "../lib/format.js";
import { ReviewBox } from "./Reviews.jsx";

// Todo lo del comprador en la página del producto: el botón, la hoja para ofertar y el estado de su oferta.
export default function BuyerOffer({ product, seller }) {
  const [offers, setOffers] = useState(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { try { setOffers(await getMyOffers(product.id)); } catch { setOffers([]); } }, [product.id]);
  useEffect(() => { load(); }, [load]);

  const last = offers?.[0];
  const waitingPay = last?.status === "aceptada" && last.can_pay_mp && last.payment_status === "pendiente";
  // Esperando el pago (o volviendo de MP): el servidor le pregunta a MP y recargamos.
  useEffect(() => {
    if (!waitingPay) return undefined;
    const tick = async () => { await syncOfferPayment(last.id); load(); };
    if (new URLSearchParams(window.location.search).get("mp")) tick();
    const t = setInterval(tick, 10000); return () => clearInterval(t);
  }, [waitingPay, last?.id, load]);
  const live = last && ["pendiente", "contraoferta"].includes(last.status);
  useEffect(() => { if (!live) return; const t = setInterval(load, 8000); return () => clearInterval(t); }, [live, load]);

  const attemptsLeft = Math.max(0, 2 - (offers?.length || 0));
  const canOffer = !last || (["rechazada_auto", "rechazada", "expirada", "cancelada"].includes(last.status) && attemptsLeft > 0);

  return (
    <>
      {last && <StatusCard o={last} product={product} seller={seller} attemptsLeft={attemptsLeft} onReload={load} onRetry={() => setOpen(true)} />}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-zinc-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:z-auto lg:mx-0 lg:mt-5 lg:max-w-none lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        {canOffer ? (
          <button onClick={() => setOpen(true)} className="flex min-h-[52px] w-full flex-col items-center justify-center rounded-2xl bg-hpred text-white">
            <span className="text-[16px] font-semibold">{last ? "Hacer otra oferta" : "Hacer mi oferta"}</span>
            <span className="text-[11px] text-white/80">{attemptsLeft === 2 ? "Tenés 2 intentos" : "Te queda 1 intento"}</span>
          </button>
        ) : (
          <a href="#mi-oferta" className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink text-[15px] font-semibold text-white">Ver mi oferta</a>
        )}
      </div>
      {open && <OfferSheet product={product} attemptsLeft={attemptsLeft} onClose={() => setOpen(false)} onDone={(o) => { setOpen(false); setOffers((x) => [o, ...(x || [])]); setTimeout(() => document.getElementById("mi-oferta")?.scrollIntoView({ behavior: "smooth" }), 50); }} />}
    </>
  );
}

function OfferSheet({ product, attemptsLeft, onClose, onDone }) {
  const saved = savedBuyer();
  const [amount, setAmount] = useState("");
  const [name, setName] = useState(saved.name || "");
  const [contact, setContact] = useState(saved.contact || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = parseMoney(amount);
  const quick = [5, 10, 15].map((p) => Math.round((product.list_price * (100 - p)) / 100 / 500) * 500);
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";

  const send = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      saveBuyer({ name: name.trim(), contact });
      const o = await submitOffer(product.id, { name, contact, amount: n });
      onDone(o);
    } catch (e2) { setErr(offerError(e2)); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50" onClick={onClose}>
      <form onSubmit={send} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">¿Cuánto ofrecés?</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full bg-zinc-100 p-1.5"><X size={18} /></button>
        </div>
        <p className="mt-1 text-[13px] text-zinc-600">Publicado a <b>{fmt(product.list_price)}</b>. {attemptsLeft === 2 ? "Tenés 2 intentos." : "Es tu último intento."}</p>

        <input inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(moneyInput(e.target.value))} placeholder="$ 0" aria-label="Tu oferta"
          className="mt-4 w-full rounded-2xl border-2 border-zinc-300 bg-white px-4 py-4 text-center font-display text-3xl font-black outline-none focus:border-hpred" />
        <div className="mt-2 flex gap-2">
          {quick.map((q, i) => (
            <button type="button" key={q} onClick={() => setAmount(moneyInput(q))} className={`flex-1 rounded-xl py-2 text-[13px] font-semibold ${n === q ? "bg-ink text-white" : "bg-zinc-100"}`}>
              {fmt(q)}<span className="block text-[10px] font-normal opacity-70">-{[5, 10, 15][i]}%</span>
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold" htmlFor="bn">Tu nombre</label>
        <input id="bn" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Lucía" className={input} />
        <label className="mt-3 block text-sm font-semibold" htmlFor="bc">Tu WhatsApp</label>
        <input id="bc" inputMode="tel" maxLength={20} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Ej: 11 5555 1234" className={input} />
        <p className="mt-1 text-[11px] text-zinc-500">El vendedor lo ve solo si acepta, para coordinar la entrega.</p>

        {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">{err}</p>}
        <button disabled={busy || !n || name.trim().length < 2 || contact.replace(/\D/g, "").length < 8}
          className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-hpred text-[16px] font-semibold text-white disabled:opacity-40">
          {busy ? "Enviando…" : n ? `Ofrecer ${fmt(n)}` : "Ofrecer"}
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-500">Si ofrecés cerca del precio, puede aceptarse al instante.</p>
      </form>
    </div>
  );
}

// Link personal: abre esta oferta desde cualquier celular o navegador (lleva el identificador del comprador).
function SaveLink({ product }) {
  const url = `${window.location.origin}${window.location.pathname}?o=${buyerToken()}`;
  const msg = `Mi oferta por «${product.title}» en Haceme Precio. Para ver si me respondieron, tocá acá: ${url}`;
  return (
    <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
      className="mt-3 flex min-h-[44px] items-center justify-center rounded-2xl bg-white text-[14px] font-semibold text-emerald-700 ring-1 ring-emerald-300">
      📲 Guardar mi oferta en WhatsApp
    </a>
  );
}

function PayButton({ o }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pay = async () => { setBusy(true); setErr(""); try { window.location.href = await payOffer(o.id); } catch { setErr("No pudimos abrir Mercado Pago. Probá de nuevo en un momento."); setBusy(false); } };
  return (
    <>
      <button disabled={busy} onClick={pay} className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#009EE3] text-[16px] font-semibold text-white disabled:opacity-50">
        {busy ? "Abriendo Mercado Pago…" : `Pagar ${fmt(o.amount)} con Mercado Pago`}
      </button>
      {err && <p className="mt-2 text-[13px] font-semibold text-rose-700">{err}</p>}
    </>
  );
}

function StatusCard({ o, product, seller, attemptsLeft, onReload, onRetry }) {
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const answer = async (accept) => { setBusy(true); setErr(""); try { await answerCounter(o.id, accept); } catch (e) { setErr(offerError(e)); } await onReload(); setBusy(false); };
  const summary = `✅ Trato acordado en Haceme Precio\nProducto: ${product.title}\nPrecio acordado: ${fmt(o.amount)}\nVendedor: ${seller.name}\nLink: ${window.location.href}\n\nRecordá verificar el dinero acreditado en tu cuenta antes de entregar el producto.`;
  const copy = async () => { try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sin portapapeles */ } };
  const box = "mx-0 mt-5 scroll-mt-20 rounded-2xl p-4 ring-1";
  const retry = attemptsLeft > 0 && <button onClick={onRetry} className="mt-3 text-[13px] font-semibold text-hpred underline">Hacer otra oferta (te queda {attemptsLeft})</button>;

  if (o.status === "pendiente") return (
    <section id="mi-oferta" className={box + " bg-amber-50 ring-amber-200"}>
      <p className="flex items-center gap-1.5 font-semibold text-amber-900"><Clock size={17} /> Ofreciste {fmt(o.amount)}</p>
      <p className="mt-1 text-[13px] text-amber-900">Esperando respuesta. El vendedor tiene <b className="font-mono">{left(o.expires_at, now)}</b> para contestar. Si no contesta, se vence sola y no pasa nada.</p>
      <SaveLink product={product} />
    </section>
  );
  if (o.status === "contraoferta") return (
    <section id="mi-oferta" className={box + " bg-sky-50 ring-sky-200"}>
      <p className="font-semibold text-sky-900">El vendedor te propone {fmt(o.counter_amount)}</p>
      <p className="mt-1 text-[13px] text-sky-900">Ofreciste {fmt(o.amount)}. Tenés <b className="font-mono">{left(o.expires_at, now)}</b> para responder.</p>
      <SaveLink product={product} />
      {err && <p className="mt-2 text-[13px] font-semibold text-rose-700">{err}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => answer(false)} className="min-h-[46px] rounded-2xl bg-white text-[14px] font-semibold ring-1 ring-zinc-300">No, gracias</button>
        <button disabled={busy} onClick={() => answer(true)} className="min-h-[46px] rounded-2xl bg-hpred text-[14px] font-semibold text-white">Acepto {fmt(o.counter_amount)}</button>
      </div>
    </section>
  );
  if (o.status === "aceptada") return (
    <section id="mi-oferta" className={box + " bg-emerald-50 ring-emerald-200"}>
      <p className="flex items-center gap-1.5 font-display text-lg font-extrabold text-emerald-900"><CheckCircle2 size={20} /> ¡Trato hecho por {fmt(o.amount)}!</p>
      {o.can_pay_mp ? (
        <>
          <p className="mt-1 text-[13px] text-emerald-900">Pagalo ahora con <b>Mercado Pago</b> para asegurarlo: la plata va directo a {seller.name}. El trato queda reservado hasta las <b>{hhmm(o.close_by)} h</b>.</p>
          <PayButton o={o} />
        </>
      ) : (
        <p className="mt-1 text-[13px] text-emerald-900">{seller.name} te va a escribir por <b>WhatsApp</b> al número que dejaste para coordinar la entrega y el pago. El trato queda reservado hasta las <b>{hhmm(o.close_by)} h</b>.</p>
      )}
      <button onClick={copy} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl bg-white text-[14px] font-semibold ring-1 ring-emerald-300"><Copy size={15} /> {copied ? "Resumen copiado ✓" : "Copiar resumen del trato"}</button>
      <p className="mt-3 flex gap-1.5 text-[12px] text-emerald-900"><ShieldCheck size={14} className="mt-px shrink-0" /> Encontrate en un lugar público y revisá el producto antes de pagar.</p>
    </section>
  );
  if (o.status === "vendida") return (
    <section id="mi-oferta" className={box + " bg-emerald-50 ring-emerald-200"}>
      <p className="flex items-center gap-1.5 font-semibold text-emerald-900"><CheckCircle2 size={17} /> {o.payment_status === "pagado" ? `¡Pago aprobado! Compraste por ${fmt(o.amount)}.` : `Compra cerrada por ${fmt(o.amount)}. ¡Que lo disfrutes!`}</p>
      {o.payment_status === "pagado" && <p className="mt-1 text-[13px] text-emerald-900">{seller.name} ya recibió tu pago. Coordiná la entrega por WhatsApp.</p>}
      <ReviewBox kind="oferta" id={o.id} />
    </section>
  );
  if (o.status === "rechazada_auto") return (
    <section id="mi-oferta" className={box + " bg-zinc-50 ring-zinc-200"}>
      <p className="flex items-center gap-1.5 font-semibold"><XCircle size={17} className="text-zinc-500" /> {fmt(o.amount)} es poco para este vendedor</p>
      {o.suggested_amount && <p className="mt-1 text-[13px] text-zinc-700">Las ofertas cerca de <b>{fmt(o.suggested_amount)}</b> tienen más chances.</p>}
      {retry || <p className="mt-2 text-[13px] text-zinc-600">Ya usaste tus 2 intentos.</p>}
    </section>
  );
  const text = { rechazada: "El vendedor no aceptó tu oferta.", expirada: "Tu oferta se venció sin respuesta.", cancelada: "El trato se canceló." }[o.status] || "Tu oferta cambió de estado.";
  return (
    <section id="mi-oferta" className={box + " bg-zinc-50 ring-zinc-200"}>
      <p className="font-semibold">{text}</p>
      <p className="text-[13px] text-zinc-600">Habías ofrecido {fmt(o.amount)}.</p>
      {retry || <p className="mt-2 text-[13px] text-zinc-600">Ya usaste tus 2 intentos. <MessageCircle size={12} className="inline" /> Mirá otras cosas del vendedor.</p>}
    </section>
  );
}
