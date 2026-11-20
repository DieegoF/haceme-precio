import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { QUICK_COLORS, SIZE_SETS, Swatch, sortSizes } from "../lib/variants.jsx";

// Talles × colores con stock por combinación. value = { colors: [], sizes: [], stock: { "Negro|M": 3 } }
export default function VariantBuilder({ value, onChange }) {
  const { colors, sizes, stock } = value;
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");
  const set = (patch) => onChange({ ...value, ...patch });
  const toggleColor = (c) => set({ colors: colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c] });
  const toggleSize = (s) => set({ sizes: sortSizes(sizes.includes(s) ? sizes.filter((x) => x !== s) : [...sizes, s]) });
  const addColor = () => { const c = newColor.trim(); if (c && !colors.includes(c)) set({ colors: [...colors, c.charAt(0).toUpperCase() + c.slice(1)] }); setNewColor(""); };
  const addSize = () => { const s = newSize.trim().toUpperCase(); if (s && !sizes.includes(s)) set({ sizes: sortSizes([...sizes, s]) }); setNewSize(""); };
  const rowKeys = colors.length ? colors : [""];
  const colKeys = sizes.length ? sizes : [""];
  const k = (c, s) => `${c}|${s}`;
  const setStock = (c, s, n) => set({ stock: { ...stock, [k(c, s)]: Math.max(0, Math.min(999, Number(n) || 0)) } });
  const total = rowKeys.reduce((t, c) => t + colKeys.reduce((u, s) => u + (stock[k(c, s)] || 0), 0), 0);
  const chip = (on) => `rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? "bg-ink text-white" : "bg-zinc-100 text-zinc-700"}`;

  return (
    <div className="space-y-4 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
      <div>
        <p className="text-sm font-semibold">Colores</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...new Set([...QUICK_COLORS, ...colors])].map((c) => (
            <button type="button" key={c} onClick={() => toggleColor(c)} className={chip(colors.includes(c)) + " flex items-center gap-1.5"}><Swatch name={c} size={14} /> {c}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <input value={newColor} onChange={(e) => setNewColor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColor())} maxLength={20} placeholder="Otro color (ej: Verde agua)" className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[14px]" />
          <button type="button" onClick={addColor} className="rounded-xl bg-white px-3 ring-1 ring-zinc-300" aria-label="Agregar color"><Plus size={16} /></button>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">Talles</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(SIZE_SETS).map(([name, set_]) => (
            <button type="button" key={name} onClick={() => set({ sizes: sortSizes([...new Set([...sizes, ...set_])]) })} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold ring-1 ring-zinc-300">+ {name}</button>
          ))}
        </div>
        {sizes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sizes.map((s) => <button type="button" key={s} onClick={() => toggleSize(s)} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-white">{s} <X size={12} /></button>)}
          </div>
        )}
        <div className="mt-2 flex gap-1.5">
          <input value={newSize} onChange={(e) => setNewSize(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSize())} maxLength={8} placeholder="Otro talle (ej: 3XL)" className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-[14px]" />
          <button type="button" onClick={addSize} className="rounded-xl bg-white px-3 ring-1 ring-zinc-300" aria-label="Agregar talle"><Plus size={16} /></button>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">¿Cuántos tenés de cada uno? <span className="font-normal text-zinc-500">· total {total}</span></p>
        <div className="mt-2 overflow-x-auto">
          <table className="text-[13px]">
            <thead>
              <tr>
                <th />
                {colKeys.map((s) => <th key={s} className="px-1 pb-1 text-center font-semibold text-zinc-500">{s || "Cant."}</th>)}
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((c) => (
                <tr key={c}>
                  <td className="whitespace-nowrap py-1 pr-2 font-semibold">{c ? <span className="flex items-center gap-1.5"><Swatch name={c} size={14} /> {c}</span> : <span className="text-zinc-500">Stock</span>}</td>
                  {colKeys.map((s) => (
                    <td key={s} className="px-1 py-1">
                      <input type="number" inputMode="numeric" min={0} max={999} value={stock[k(c, s)] ?? 0} onChange={(e) => setStock(c, s, e.target.value)}
                        aria-label={`Stock ${c} ${s}`} className="w-14 rounded-lg border border-zinc-300 bg-white px-1.5 py-1.5 text-center" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">Lo que pongas en 0 se muestra como «sin stock».</p>
      </div>
    </div>
  );
}

// Convierte el estado del editor a la lista de variantes que guarda la base (y al revés).
export function toVariants({ colors, sizes, stock }) {
  if (!colors.length && !sizes.length) return null;
  const rows = colors.length ? colors : [""];
  const cols = sizes.length ? sizes : [""];
  return rows.flatMap((c) => cols.map((s) => ({ color: c, size: s, stock: stock[`${c}|${s}`] || 0 })));
}
export function fromVariants(list) {
  const colors = [...new Set(list.map((v) => v.color).filter(Boolean))];
  const sizes = sortSizes([...new Set(list.map((v) => v.size).filter(Boolean))]);
  const stock = Object.fromEntries(list.map((v) => [`${v.color}|${v.size}`, v.stock]));
  return { colors, sizes, stock };
}
