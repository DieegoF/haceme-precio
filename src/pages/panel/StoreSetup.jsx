import React, { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { BrandEditor, BRAND_COLORS } from "../../components/StoreBrand.jsx";
import { BrandBar } from "../../components/Brand.jsx";

// Alta de la tienda (plan Tienda), en 3 pasos: marca · local · entrega.
export default function StoreSetup({ seller, store, onDone }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({
    tagline: store?.tagline || "", logo_url: store?.logo_url || null, banner_url: store?.banner_url || null, banner_pos: store?.banner_pos || "center", color: store?.color || BRAND_COLORS[0],
    address: store?.address || "", hours: store?.hours || "Lun a Sáb de 10 a 19 h", whatsapp: store?.whatsapp || "",
    pickup: store?.pickup ?? true, shipping_enabled: store?.shipping_enabled ?? false, shipping_note: store?.shipping_note || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const wa = f.whatsapp.replace(/\D/g, "");
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";
  const label = "mt-4 block text-sm font-semibold";

  const save = async () => {
    setBusy(true); setErr("");
    const row = { ...f, whatsapp: wa, tagline: f.tagline.trim() || null, address: f.address.trim(), hours: f.hours.trim() || null, shipping_note: f.shipping_enabled ? f.shipping_note.trim() || "A coordinar" : null, ready: true };
    const q = store ? supabase.from("stores").update(row).eq("seller_id", seller.id) : supabase.from("stores").insert({ seller_id: seller.id, ...row });
    const { error } = await q;
    setBusy(false);
    if (error) return setErr("No pudimos guardar tu tienda. Probá de nuevo.");
    onDone();
  };

  return (
    <>
      <BrandBar />
      <div className="px-5 pb-10 pt-5">
        <div className="flex gap-1.5">{[1, 2, 3].map((n) => <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-hpred" : "bg-zinc-200"}`} />)}</div>
        {step === 1 && (
          <div className="mt-6">
            <h1 className="font-display text-2xl font-extrabold">Ponele tu cara a {seller.name}</h1>
            <p className="mt-1 text-sm text-zinc-600">Logo, portada y color. Así tus clientes te reconocen al toque.</p>
            <label className={label} htmlFor="tl">Una frase corta <span className="font-normal text-zinc-500">(opcional)</span></label>
            <input id="tl" maxLength={80} value={f.tagline} onChange={set("tagline")} placeholder="Ej: Ropa de mujer · Palermo" className={input} />
            <div className="mt-5"><BrandEditor userId={seller.id} name={seller.name} tagline={f.tagline} value={f} onChange={(v) => setF((x) => ({ ...x, ...v }))} /></div>
            <button onClick={() => setStep(2)} className="mt-6 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-hpred text-[16px] font-semibold text-white">{f.logo_url || f.banner_url ? "Siguiente" : "Lo hago después"}</button>
          </div>
        )}
        {step === 2 && (
          <div className="mt-6">
            <h1 className="font-display text-2xl font-extrabold">¿Dónde te encuentran?</h1>
            <label className={label} htmlFor="ad">Dirección del local</label>
            <input id="ad" maxLength={120} value={f.address} onChange={set("address")} placeholder="Ej: Honduras 4800, Palermo" className={input} />
            <label className={label} htmlFor="hs">Horario</label>
            <input id="hs" maxLength={80} value={f.hours} onChange={set("hours")} className={input} />
            <label className={label} htmlFor="wa">WhatsApp para consultas</label>
            <input id="wa" inputMode="tel" maxLength={20} value={f.whatsapp} onChange={set("whatsapp")} placeholder="Ej: 11 5555 0000" className={input} />
            <p className="mt-1 text-[12px] text-zinc-500">Tus clientes lo usan para preguntar por talles o envíos.</p>
            <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
              <button onClick={() => setStep(1)} className="min-h-[52px] rounded-2xl font-semibold ring-1 ring-zinc-300">Atrás</button>
              <button disabled={f.address.trim().length < 4 || wa.length < 8} onClick={() => setStep(3)} className="min-h-[52px] rounded-2xl bg-hpred font-semibold text-white disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="mt-6">
            <h1 className="font-display text-2xl font-extrabold">¿Cómo entregás?</h1>
            <div className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <label className="flex items-center justify-between gap-3 text-sm font-semibold">Retiro en el local <input type="checkbox" checked={f.pickup} onChange={set("pickup")} className="h-5 w-5 accent-hpred" /></label>
              <label className="flex items-center justify-between gap-3 text-sm font-semibold">Hago envíos <input type="checkbox" checked={f.shipping_enabled} onChange={set("shipping_enabled")} className="h-5 w-5 accent-hpred" /></label>
              {f.shipping_enabled && <input maxLength={120} value={f.shipping_note} onChange={set("shipping_note")} placeholder="Ej: Moto en CABA o correo a todo el país" className={input} />}
            </div>
            <div className="mt-4 rounded-2xl bg-kraft-50 p-4 text-[13px] ring-1 ring-kraft-200">
              <p className="font-semibold">Tu tienda va a quedar en:</p>
              <p className="mt-1 font-mono">{window.location.host}/{seller.slug}</p>
              <p className="mt-2 text-zinc-600">Después cargás tus productos con talles, colores y stock, y compartís el link en tu Instagram o WhatsApp.</p>
            </div>
            {err && <p className="mt-3 text-sm font-semibold text-hpred">{err}</p>}
            <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
              <button onClick={() => setStep(2)} className="min-h-[52px] rounded-2xl font-semibold ring-1 ring-zinc-300">Atrás</button>
              <button disabled={busy || (!f.pickup && !f.shipping_enabled)} onClick={save} className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-hpred font-semibold text-white disabled:opacity-40"><Check size={17} /> {busy ? "Guardando…" : "Crear mi tienda"}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
