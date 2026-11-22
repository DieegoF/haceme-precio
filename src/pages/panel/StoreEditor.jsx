import React, { useEffect, useState } from "react";
import { ChevronDown, Plus, Store, Trash2, Zap } from "lucide-react";
import { moneyInput, parseMoney } from "../../lib/format.js";
import { normText } from "../../lib/promo.js";
import { supabase } from "../../lib/supabase.js";
import { BrandEditor, StoreAvatar } from "../../components/StoreBrand.jsx";

// «Mi cuenta» → datos y marca de la tienda.
export default function StoreEditor({ seller, store, onSaved }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => fromStore(store));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // Categorías reales de la tienda, para elegir dónde aplica la promo (y avisar qué está en liquidación).
  const [cats, setCats] = useState([]);
  useEffect(() => {
    if (!open) return;
    supabase.from("products").select("collection, liquidation").eq("seller_id", seller.id).neq("status", "vendida").then(({ data }) => {
      const m = new Map();
      (data || []).forEach((p) => {
        if (!p.collection) return;
        const k = normText(p.collection);
        const c = m.get(k) || { name: p.collection.trim(), total: 0, liq: 0 };
        c.total += 1; if (p.liquidation) c.liq += 1; m.set(k, c);
      });
      setCats([...m.values()].sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [open, seller.id]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setPromo = (k) => (e) => setF((x) => ({ ...x, promo: { ...x.promo, [k]: e.target.value } }));
  const setFaq = (i, k) => (e) => setF((x) => ({ ...x, faqList: x.faqList.map((q, j) => (j === i ? { ...q, [k]: e.target.value } : q)) }));
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-900";
  const save = async () => {
    setBusy(true); setMsg("");
    const promo = f.promoOn && f.promo.text.trim() ? {
      text: f.promo.text.trim(), pct: f.promo.pct ? Number(f.promo.pct) : null,
      scope: f.promo.scope.trim() || "Todo", ends_at: new Date(f.promo.ends).toISOString(),
    } : null;
    const faq = f.faqList.filter((x) => x.q.trim() && x.a.trim()).map((x) => ({ q: x.q.trim(), a: x.a.trim() }));
    const { error } = await supabase.from("stores").update({
      promo, faq, free_ship_from: f.shipping_enabled && parseMoney(f.freeFrom) > 0 ? parseMoney(f.freeFrom) : null,
      tagline: f.tagline?.trim() || null, logo_url: f.logo_url, banner_url: f.banner_url, banner_pos: f.banner_pos || "center", color: f.color,
      address: f.address?.trim(), hours: f.hours?.trim() || null, whatsapp: (f.whatsapp || "").replace(/\D/g, ""),
      pickup: f.pickup, shipping_enabled: f.shipping_enabled, shipping_note: f.shipping_enabled ? f.shipping_note?.trim() || "A coordinar" : null,
    }).eq("seller_id", seller.id);
    setBusy(false);
    setMsg(error ? (error.message.includes("DEMO:") ? "En la demo no se puede cambiar la tienda. Creá tu cuenta gratis para armar la tuya."
      : error.message.includes("PROMO") ? "Revisá la promo: texto de 3 a 60 letras, descuento entre 5% y 70% y una fecha de fin."
      : error.message.includes("FAQ") ? "Revisá las preguntas: cada una necesita pregunta y respuesta." : "No pudimos guardar. Revisá los datos.") : "Guardado ✓");
    if (!error) onSaved();
  };
  return (
    <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <button onClick={() => { setF(fromStore(store)); setOpen(!open); }} className="flex w-full items-center gap-3 text-left">
        <StoreAvatar name={seller.name} logo={store.logo_url} color={store.color} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Store size={13} /> Tu tienda</span>
          <span className="block text-[13px] text-zinc-600">Marca, local, promos, envío gratis y preguntas</span>
        </span>
        <ChevronDown size={18} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">Frase corta<input maxLength={80} value={f.tagline || ""} onChange={set("tagline")} className={input} /></label>
          <BrandEditor userId={seller.id} name={seller.name} tagline={f.tagline} value={f} onChange={(v) => setF((x) => ({ ...x, ...v }))} />
          <div className="border-t border-zinc-100" />
          <label className="block text-sm font-semibold">Dirección<input maxLength={120} value={f.address || ""} onChange={set("address")} className={input} /></label>
          <label className="block text-sm font-semibold">Horario<input maxLength={80} value={f.hours || ""} onChange={set("hours")} className={input} /></label>
          <label className="block text-sm font-semibold">WhatsApp<input inputMode="tel" maxLength={20} value={f.whatsapp || ""} onChange={set("whatsapp")} className={input} /></label>
          <label className="flex items-center justify-between text-sm font-semibold">Retiro en el local <input type="checkbox" checked={f.pickup} onChange={set("pickup")} className="h-5 w-5 accent-hpred" /></label>
          <label className="flex items-center justify-between text-sm font-semibold">Hago envíos <input type="checkbox" checked={f.shipping_enabled} onChange={set("shipping_enabled")} className="h-5 w-5 accent-hpred" /></label>
          {f.shipping_enabled && <input maxLength={120} value={f.shipping_note || ""} onChange={set("shipping_note")} placeholder="Ej: Moto en CABA" className={input} />}
          {f.shipping_enabled && (
            <label className="block text-sm font-semibold">Envío gratis desde <span className="font-normal text-zinc-500">(opcional)</span>
              <input inputMode="numeric" value={f.freeFrom} onChange={(e) => setF((x) => ({ ...x, freeFrom: moneyInput(e.target.value) }))} placeholder="$ 50.000" className={input} />
              <span className="mt-1 block text-[12px] font-normal text-zinc-500">Tus clientes ven cuánto les falta para llegar. Suele subir el ticket.</span>
            </label>
          )}

          <div className="border-t border-zinc-100" />
          <label className="flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-1.5"><Zap size={15} /> Promo con cuenta regresiva</span>
            <input type="checkbox" checked={f.promoOn} onChange={(e) => setF((x) => ({ ...x, promoOn: e.target.checked }))} className="h-5 w-5 accent-hpred" /></label>
          {f.promoOn && (
            <div className="space-y-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <label className="block text-sm font-semibold">Qué dice<input maxLength={60} value={f.promo.text} onChange={setPromo("text")} placeholder="Ej: 20% OFF en remeras" className={input} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-semibold">Descuento
                  <select value={f.promo.pct} onChange={setPromo("pct")} className={input}>
                    <option value="">Sin descuento</option>
                    {[5, 10, 15, 20, 25, 30, 40, 50, 60, 70].map((n) => <option key={n} value={n}>{n}% OFF</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">En
                  <select value={f.promo.scope} onChange={setPromo("scope")} className={input}>
                    <option value="Todo">Toda la tienda</option>
                    {cats.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.total})</option>)}
                    {f.promo.scope !== "Todo" && !cats.some((c) => normText(c.name) === normText(f.promo.scope)) && <option value={f.promo.scope}>{f.promo.scope} (sin productos)</option>}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-semibold">Termina<input type="datetime-local" value={f.promo.ends} onChange={setPromo("ends")} className={input} /></label>
              <PromoScopeNote cats={cats} promo={f.promo} />
              <p className="text-[12px] text-zinc-500">Con descuento, el precio baja solo en la tienda y en el pedido. Cuando termina, desaparece sola.</p>
            </div>
          )}

          <div className="border-t border-zinc-100" />
          <p className="text-sm font-semibold">Preguntas frecuentes <span className="font-normal text-zinc-500">({f.faqList.length}/10)</span></p>
          <p className="-mt-2 text-[12px] text-zinc-500">Se muestran al final de tu tienda. Ej: cambios, talles, medios de pago.</p>
          {f.faqList.map((x, i) => (
            <div key={i} className="space-y-2 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <div className="flex gap-2">
                <input maxLength={120} value={x.q} onChange={setFaq(i, "q")} placeholder="Pregunta" className={`${input} mt-0 flex-1`} />
                <button type="button" onClick={() => setF((s) => ({ ...s, faqList: s.faqList.filter((_, j) => j !== i) }))} className="px-2 text-zinc-400" aria-label="Borrar pregunta"><Trash2 size={17} /></button>
              </div>
              <textarea maxLength={500} rows={2} value={x.a} onChange={setFaq(i, "a")} placeholder="Respuesta" className={`${input} mt-0`} />
            </div>
          ))}
          {f.faqList.length < 10 && (
            <button type="button" onClick={() => setF((s) => ({ ...s, faqList: [...s.faqList, { q: "", a: "" }] }))} className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-semibold ring-1 ring-dashed ring-zinc-300">
              <Plus size={15} /> Agregar pregunta
            </button>
          )}
          {f.faqList.length === 0 && (
            <button type="button" onClick={() => setF((s) => ({ ...s, faqList: FAQ_IDEAS.map((q) => ({ q, a: "" })) }))} className="w-full text-center text-[12px] font-semibold text-zinc-500 underline">Usar preguntas típicas</button>
          )}
          <button disabled={busy} onClick={save} className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-hpred font-semibold text-white disabled:opacity-40">{busy ? "Guardando…" : "Guardar cambios"}</button>
          {msg && <p className="text-center text-[13px] font-semibold text-zinc-700">{msg}</p>}
        </div>
      )}
    </section>
  );
}

const FAQ_IDEAS = ["¿Hacen cambios?", "¿Cómo sé mi talle?", "¿Cómo puedo pagar?", "¿Cuánto tarda el envío?"];
// Fecha para <input type="datetime-local"> en la hora del celular.
const toLocal = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };
function fromStore(store) {
  const p = store.promo;
  const inThree = new Date(); inThree.setDate(inThree.getDate() + 3); inThree.setHours(23, 59, 0, 0);
  return {
    ...store,
    freeFrom: store.free_ship_from ? moneyInput(String(store.free_ship_from)) : "",
    promoOn: Boolean(p && new Date(p.ends_at) > new Date()),
    promo: { text: p?.text || "", pct: p?.pct ? String(p.pct) : "", scope: p?.scope || "Todo", ends: toLocal(p?.ends_at && new Date(p.ends_at) > new Date() ? new Date(p.ends_at) : inThree) },
    faqList: Array.isArray(store.faq) ? store.faq : [],
  };
}

// Avisa a qué productos aplica la promo y cuáles quedan afuera por estar en liquidación.
function PromoScopeNote({ cats, promo }) {
  const all = normText(promo.scope) === "todo";
  const list = all ? cats : cats.filter((c) => normText(c.name) === normText(promo.scope));
  const total = list.reduce((t, c) => t + c.total, 0), liq = list.reduce((t, c) => t + c.liq, 0);
  if (!all && total === 0) return <p className="rounded-xl bg-rose-50 p-2.5 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200">Esta categoría no tiene productos: la promo no le va a bajar el precio a nada. Elegí otra de la lista.</p>;
  if (!promo.pct) return null;
  return (
    <p className="rounded-xl bg-emerald-50 p-2.5 text-[12px] text-emerald-900 ring-1 ring-emerald-200">
      Baja el precio de <b>{total - liq} {total - liq === 1 ? "producto" : "productos"}</b>{all ? " de toda la tienda" : ` de ${list[0].name}`}.
      {liq > 0 && <> {liq === 1 ? "1 está" : `${liq} están`} en <b>liquidación</b> y {liq === 1 ? "mantiene" : "mantienen"} su precio de remate (no se suman los descuentos).</>}
    </p>
  );
}
