import React, { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Clock, Lock, MessageCircle, CheckCircle2, Undo2, Inbox } from "lucide-react";
import { getSellerOffers, sellerAction, offerError, useNow, left, hhmm, waLink } from "../../lib/offers.js";
import { fmt, parseMoney, moneyInput } from "../../lib/format.js";
import { BrandBar } from "../../components/Brand.jsx";
import PanelWidgets from "../../components/widgets/PanelWidgets.jsx";

const HIST = {
  vendida: ["Vendido", "bg-ink text-white"], rechazada_auto: ["Frenada sola", "bg-zinc-200 text-zinc-700"], rechazada: ["Rechazada", "bg-zinc-200 text-zinc-700"],
  expirada: ["Vencida", "bg-zinc-200 text-zinc-700"], cancelada: ["Se cayó", "bg-zinc-200 text-zinc-700"],
};

export default function Ofertas() {
  const { seller } = useOutletContext();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => { try { setItems(await getSellerOffers()); } catch { setErr("No pudimos cargar tus ofertas."); setItems([]); } }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const act = async (o, action, counter) => {
    setErr("");
    try { await sellerAction(o.id, action, counter); } catch (e) { setErr(offerError(e)); }
    load();
  };

  const deals = items?.filter((o) => o.status === "aceptada") || [];
  const pending = items?.filter((o) => o.status === "pendiente") || [];
  const waiting = items?.filter((o) => o.status === "contraoferta") || [];
  const history = (items || []).filter((o) => HIST[o.status]).slice(0, 20);
  const autoStopped = (items || []).filter((o) => o.status === "rechazada_auto" && Date.now() - new Date(o.created_at) < 7 * 86400000).length;

  return (
    <>
      <BrandBar />
      <main className="px-5 pt-5">
        <p className="text-sm text-zinc-500">Hola, {seller.name} 👋</p>
        <h1 className="font-display text-2xl font-extrabold">Ofertas</h1>
        {!seller.is_store && <PanelWidgets seller={seller} refreshKey={items} />}
        {autoStopped > 0 && <p className="mt-2 rounded-xl bg-zinc-50 p-3 text-[13px] text-zinc-700 ring-1 ring-zinc-200">🛡️ Esta semana se frenaron solas <b>{autoStopped}</b> ofertas bajas. No tuviste que contestar ninguna.</p>}
        {err && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">{err}</p>}

        {items === null ? <p className="py-16 text-center text-sm text-zinc-500">Cargando…</p>
          : !deals.length && !pending.length && !waiting.length && !history.length ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-zinc-300 p-8 text-center">
              <Inbox className="mx-auto text-zinc-400" size={36} />
              <p className="mt-2 font-display text-lg font-extrabold">Todavía no hay ofertas</p>
              <p className="mt-1 text-sm text-zinc-600">Compartí el link de tus productos en WhatsApp, Instagram o Marketplace. Las ofertas te llegan acá.</p>
              <Link to="/panel/productos" className="mt-4 inline-flex min-h-[46px] items-center rounded-2xl bg-hpred px-6 font-semibold text-white">Ir a mis productos</Link>
            </div>
          ) : (
            <>
              <Section id="trato-hecho" title="Trato hecho · coordiná la entrega" items={deals} render={(o) => <Deal key={o.id} o={o} seller={seller} onAct={act} />} />
              <Section id="para-responder" title="Para responder" items={pending} render={(o) => <Pending key={o.id} o={o} onAct={act} />} />
              <Section title="Esperando al comprador" items={waiting} render={(o) => <Waiting key={o.id} o={o} seller={seller} />} />
              {history.length > 0 && (
                <section className="mt-6">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Historial</h2>
                  <ul className="mt-2 divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200">
                    {history.map((o) => (
                      <li key={o.id} className="flex items-center gap-3 px-3 py-2.5">
                        <img src={o.product_photo} alt="" className="h-9 w-9 rounded-lg bg-zinc-100 object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{o.product_title}</p>
                          <p className="text-[12px] text-zinc-500">{o.buyer_name} · {fmt(o.amount)}</p>
                        </div>
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${HIST[o.status][1]}`}>{HIST[o.status][0]}</span>
                          {o.payment_status === "pagado" && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${o.status === "vendida" ? "bg-emerald-600" : "bg-rose-600"}`}>{o.status === "vendida" ? "Pagado ✓" : "Pagó tarde: resolvé"}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
      </main>
    </>
  );
}

function Section({ id, title, items, render }) {
  if (!items.length) return null;
  return (
    <section id={id} className="mt-5 scroll-mt-20">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title} · {items.length}</h2>
      <ul className="mt-2 space-y-3">{items.map(render)}</ul>
    </section>
  );
}

function Head({ o }) {
  const pct = Math.round((1 - o.amount / o.list_price) * 100);
  return (
    <div className="flex gap-3">
      <img src={o.product_photo} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-zinc-100 object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-zinc-500">{o.product_title}</p>
        <p className="text-[15px]"><b>{o.buyer_name}</b> ofrece <b className="text-[18px]">{fmt(o.amount)}</b></p>
        <p className="text-[12px] text-zinc-500">Publicado {fmt(o.list_price)}{pct > 0 ? ` · ${pct}% menos` : ""}{o.floor_price ? <> · <Lock size={10} className="inline" /> tu mínimo {fmt(o.floor_price)}</> : null}</p>
      </div>
    </div>
  );
}

function Pending({ o, onAct }) {
  const now = useNow();
  const [counter, setCounter] = useState(null);
  const [busy, setBusy] = useState(false);
  // Contraoferta sugerida: a mitad de camino entre la oferta y el precio, redondeada según el precio.
  const step = o.list_price >= 20000 ? 1000 : o.list_price >= 2000 ? 100 : o.list_price >= 200 ? 10 : 1;
  const mid = Math.round(((o.amount + o.list_price) / 2) / step) * step;
  const suggested = Math.min(o.list_price, Math.max(mid, Math.ceil((o.amount + 1) / step) * step));
  const run = async (...a) => { setBusy(true); await onAct(o, ...a); setBusy(false); };
  const c = parseMoney(counter);
  return (
    <li className="rounded-2xl bg-white p-3 ring-2 ring-amber-300">
      <Head o={o} />
      <p className="mt-2 flex items-center gap-1 text-[12px] font-semibold text-amber-700"><Clock size={13} /> Te quedan {left(o.expires_at, now)} para responder</p>
      {counter === null ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <button disabled={busy} onClick={() => run("rechazar")} className="min-h-[44px] rounded-xl text-[13px] font-semibold ring-1 ring-zinc-300">Rechazar</button>
          <button disabled={busy} onClick={() => setCounter(moneyInput(suggested))} className="min-h-[44px] rounded-xl text-[13px] font-semibold ring-1 ring-zinc-300">Contraofertar</button>
          <button disabled={busy} onClick={() => run("aceptar")} className="min-h-[44px] rounded-xl bg-hpred text-[13px] font-semibold text-white">Aceptar</button>
        </div>
      ) : (
        <div className="mt-2">
          <label className="text-[12px] font-semibold" htmlFor={`c-${o.id}`}>¿Cuánto le proponés? (entre {fmt(o.amount + 1)} y {fmt(o.list_price)})</label>
          <div className="mt-1 flex gap-1.5">
            <input id={`c-${o.id}`} inputMode="numeric" value={counter} onChange={(e) => setCounter(moneyInput(e.target.value))} className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-base font-semibold" />
            <button disabled={busy || c <= o.amount || c > o.list_price} onClick={() => run("contraofertar", c)} className="rounded-xl bg-ink px-4 text-[13px] font-semibold text-white disabled:opacity-40">Enviar</button>
          </div>
          <button onClick={() => setCounter(null)} className="mt-1 text-[12px] text-zinc-500 underline">Cancelar</button>
        </div>
      )}
    </li>
  );
}

function Waiting({ o, seller }) {
  const now = useNow();
  const link = `${window.location.origin}/${seller.slug}/${o.product_slug}`;
  const msg = `¡Hola ${o.buyer_name}! Soy ${seller.name}. Por «${o.product_title}» te propongo ${fmt(o.counter_amount)}. Tenés 12 horas para aceptar o no desde acá: ${link}`;
  return (
    <li className="rounded-2xl bg-white p-3 ring-1 ring-sky-200">
      <Head o={o} />
      <p className="mt-2 text-[13px] text-sky-800">Le propusiste <b>{fmt(o.counter_amount)}</b>. Tiene {left(o.expires_at, now)} para contestar.</p>
      {o.buyer_contact && (
        <a href={waLink(o.buyer_contact, msg)} target="_blank" rel="noreferrer" className="mt-2 flex min-h-[42px] items-center justify-center rounded-xl bg-[#25D366] text-[13px] font-semibold text-white">Avisarle por WhatsApp</a>
      )}
    </li>
  );
}

function Deal({ o, seller, onAct }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const run = async (a) => { setBusy(true); await onAct(o, a); setBusy(false); setConfirm(null); };
  const msg = `¡Hola ${o.buyer_name}! Soy ${seller.name}. Aceptamos tu oferta de ${fmt(o.amount)} por «${o.product_title}» en Haceme Precio 🙌 ¿Cómo coordinamos la entrega y el pago?`;
  return (
    <li className="rounded-2xl bg-white p-3 ring-2 ring-emerald-300">
      <Head o={o} />
      <p className="mt-2 text-[12px] text-emerald-800">✅ Trato por <b>{fmt(o.amount)}</b> · reservado hasta las {hhmm(o.close_by)} h</p>
      {o.can_pay_mp && <p className="mt-1 inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">Esperando el pago con Mercado Pago</p>}
      <a href={waLink(o.buyer_contact, msg)} target="_blank" rel="noreferrer" className="mt-2 flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-[14px] font-semibold text-white">
        <MessageCircle size={16} /> Escribirle por WhatsApp
      </a>
      <p className="mt-2 text-[11px] text-zinc-500">Verificá que el dinero esté acreditado en tu cuenta antes de entregar. No te guíes solo por capturas.</p>
      {confirm ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button onClick={() => setConfirm(null)} className="min-h-[42px] rounded-xl text-[13px] font-semibold ring-1 ring-zinc-300">Volver</button>
          <button disabled={busy} onClick={() => run(confirm)} className={`min-h-[42px] rounded-xl text-[13px] font-semibold text-white ${confirm === "vendido" ? "bg-ink" : "bg-rose-600"}`}>{confirm === "vendido" ? "Sí, se vendió" : "Sí, se cayó"}</button>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button onClick={() => setConfirm("liberar")} className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl text-[13px] font-semibold ring-1 ring-zinc-300"><Undo2 size={14} /> Se cayó</button>
          <button onClick={() => setConfirm("vendido")} className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-ink text-[13px] font-semibold text-white"><CheckCircle2 size={14} /> Ya se vendió</button>
        </div>
      )}
    </li>
  );
}
