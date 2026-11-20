import React, { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { COLLECTIONS } from "../lib/variants.jsx";
import { normText } from "../lib/promo.js";

// Elegir la categoría del producto: primero las que ya usa la tienda, después sugerencias, o crear una nueva.
export default function CategoryPicker({ sellerId, value, onChange }) {
  const [mine, setMine] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    supabase.from("products").select("collection").eq("seller_id", sellerId).then(({ data }) => {
      const m = new Map();
      (data || []).forEach((p) => { if (p.collection?.trim()) m.set(normText(p.collection), p.collection.trim()); });
      setMine([...m.values()].sort((a, b) => a.localeCompare(b)));
    });
  }, [sellerId]);

  const used = new Set(mine.map(normText));
  const suggested = COLLECTIONS.filter((c) => !used.has(normText(c)));
  const all = [...mine, ...(value && !used.has(normText(value)) && !suggested.some((c) => normText(c) === normText(value)) ? [value] : [])];
  const pick = (c) => onChange(normText(c) === normText(value) ? "" : c);
  const add = () => {
    const name = draft.trim().replace(/\s+/g, " ");
    if (name.length < 2) return;
    // Si ya existe con otra forma de escribirla, usa la que ya tenés.
    const existing = [...mine, ...COLLECTIONS].find((c) => normText(c) === normText(name));
    onChange(existing || name.charAt(0).toUpperCase() + name.slice(1));
    setDraft(""); setAdding(false);
  };
  const Chip = ({ c, muted }) => {
    const on = normText(c) === normText(value);
    return (
      <button type="button" onClick={() => pick(c)}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? "bg-ink text-white" : muted ? "bg-white text-zinc-600 ring-1 ring-dashed ring-zinc-300" : "bg-zinc-100 text-zinc-800"}`}>
        {on && <Check size={13} />}{c}
      </button>
    );
  };

  return (
    <div className="mt-2">
      {all.length > 0 && (
        <>
          <p className="text-[12px] font-semibold text-zinc-500">Tus categorías</p>
          <div className="mt-1.5 flex flex-wrap gap-2">{all.map((c) => <Chip key={c} c={c} />)}</div>
        </>
      )}
      <p className="mt-3 text-[12px] font-semibold text-zinc-500">{all.length ? "Otras ideas" : "Elegí una"}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {suggested.map((c) => <Chip key={c} c={c} muted />)}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-hpred ring-1 ring-hpred/40">
            <Plus size={13} /> Nueva
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex gap-2">
          <input autoFocus maxLength={30} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="Ej: Bikinis" className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-base outline-none focus:border-zinc-900" />
          <button type="button" onClick={add} className="shrink-0 rounded-xl bg-ink px-4 text-[14px] font-semibold text-white">Agregar</button>
        </div>
      )}
      {!value && <p className="mt-2 text-[12px] text-zinc-500">Sirve para los filtros de tu tienda y para las promos por categoría.</p>}
    </div>
  );
}
