import React, { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { uploadBrandImage } from "../lib/brandImages.js";

export const BRAND_COLORS = ["#111111", "#C8102E", "#B5654A", "#2F6B4F", "#2B4C9B", "#7A3FA0", "#D17A00", "#D14D8A"];

export function StoreAvatar({ name = "?", logo, color = "#111111", size = 64 }) {
  const ring = size >= 48 ? "ring-4 ring-white shadow-sm" : "ring-1 ring-zinc-200";
  return logo
    ? <img src={logo} alt={`Logo de ${name}`} style={{ width: size, height: size }} className={`shrink-0 rounded-2xl bg-white object-cover ${ring}`} />
    : <span style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }} className={`flex shrink-0 items-center justify-center rounded-2xl font-display font-black text-white ${ring}`}>{name.trim().charAt(0).toUpperCase()}</span>;
}

export function StoreBanner({ banner, color = "#111111", className = "h-32" }) {
  return banner
    ? <img src={banner} alt="" className={`${className} w-full object-cover`} />
    : <div className={`${className} w-full`} style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 55%, #00000055 100%)` }} />;
}

// Editor de marca: logo, portada y color, con vista previa en vivo.
export function BrandEditor({ userId, name, tagline, value, onChange }) {
  const logoRef = useRef(null);
  const bannerRef = useRef(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const pick = async (e, kind) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(""); setBusy(kind);
    try { onChange({ ...value, [kind === "logo" ? "logo_url" : "banner_url"]: await uploadBrandImage(f, userId, kind) }); }
    catch { setErr("No se pudo subir la imagen. Probá con otra."); }
    setBusy(null);
  };
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <button type="button" onClick={() => bannerRef.current?.click()} className="relative block w-full" aria-label="Cambiar portada">
          <StoreBanner banner={value.banner_url} color={value.color} className="h-24" />
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
            {busy === "banner" ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} {value.banner_url ? "Cambiar portada" : "Subir portada"}
          </span>
        </button>
        <div className="flex items-end gap-3 px-3 pb-3">
          <button type="button" onClick={() => logoRef.current?.click()} className="relative -mt-8" aria-label="Cambiar logo">
            <StoreAvatar name={name || "T"} logo={value.logo_url} color={value.color} size={64} />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white ring-2 ring-white">
              {busy === "logo" ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </span>
          </button>
          <div className="min-w-0 pb-0.5">
            <p className="truncate font-display text-base font-extrabold">{name || "Tu tienda"}</p>
            {tagline && <p className="truncate text-[12px] text-zinc-500">{tagline}</p>}
          </div>
        </div>
      </div>
      <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e, "logo")} aria-label="Elegir logo" />
      <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e, "banner")} aria-label="Elegir portada" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => logoRef.current?.click()} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold ring-1 ring-zinc-300"><ImageIcon size={14} /> {value.logo_url ? "Cambiar logo" : "Subir logo"}</button>
        <button type="button" onClick={() => bannerRef.current?.click()} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-[13px] font-semibold ring-1 ring-zinc-300"><ImageIcon size={14} /> {value.banner_url ? "Cambiar portada" : "Subir portada"}</button>
      </div>
      <p className="text-[11px] text-zinc-500">Logo cuadrado, como el de tu Instagram. Portada horizontal: una foto del local o de tu ropa. Las recortamos solas.</p>
      {(value.logo_url || value.banner_url) && (
        <div className="flex gap-3 text-[12px]">
          {value.logo_url && <button type="button" onClick={() => onChange({ ...value, logo_url: null })} className="font-semibold text-zinc-500 underline">Quitar logo</button>}
          {value.banner_url && <button type="button" onClick={() => onChange({ ...value, banner_url: null })} className="font-semibold text-zinc-500 underline">Quitar portada</button>}
        </div>
      )}
      {err && <p className="text-[12px] font-semibold text-hpred">{err}</p>}
      <div>
        <p className="text-[13px] font-semibold">Color de tu marca</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {BRAND_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => onChange({ ...value, color: c })} aria-label={`Color ${c}`}
              style={{ backgroundColor: c }} className={`h-9 w-9 rounded-full ring-offset-2 ${value.color === c ? "ring-2 ring-ink" : ""}`} />
          ))}
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">Se usa en los botones de tu tienda.</p>
      </div>
    </div>
  );
}
