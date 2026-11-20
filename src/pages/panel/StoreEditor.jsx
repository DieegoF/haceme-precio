import React, { useState } from "react";
import { ChevronDown, Store } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { BrandEditor, StoreAvatar } from "../../components/StoreBrand.jsx";

// «Mi cuenta» → datos y marca de la tienda.
export default function StoreEditor({ seller, store, onSaved }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(store);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-zinc-900";
  const save = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("stores").update({
      tagline: f.tagline?.trim() || null, logo_url: f.logo_url, banner_url: f.banner_url, color: f.color,
      address: f.address?.trim(), hours: f.hours?.trim() || null, whatsapp: (f.whatsapp || "").replace(/\D/g, ""),
      pickup: f.pickup, shipping_enabled: f.shipping_enabled, shipping_note: f.shipping_enabled ? f.shipping_note?.trim() || "A coordinar" : null,
    }).eq("seller_id", seller.id);
    setBusy(false);
    setMsg(error ? "No pudimos guardar. Revisá los datos." : "Guardado ✓");
    if (!error) onSaved();
  };
  return (
    <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <button onClick={() => { setF(store); setOpen(!open); }} className="flex w-full items-center gap-3 text-left">
        <StoreAvatar name={seller.name} logo={store.logo_url} color={store.color} size={44} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Store size={13} /> Tu tienda</span>
          <span className="block text-[13px] text-zinc-600">Logo, portada, color y datos del local</span>
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
          <button disabled={busy} onClick={save} className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-hpred font-semibold text-white disabled:opacity-40">{busy ? "Guardando…" : "Guardar cambios"}</button>
          {msg && <p className="text-center text-[13px] font-semibold text-zinc-700">{msg}</p>}
        </div>
      )}
    </section>
  );
}
