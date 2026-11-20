import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { Lock, Link2, Pencil, Pause, Play, CheckCircle2, Trash2, Plus, Zap, Eye } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { removePhotos } from "../../lib/photos.js";
import { fmt } from "../../lib/format.js";
import { friendlyDbError } from "../../lib/errors.js";
import { BrandBar } from "../../components/Brand.jsx";

const STATUS = {
  activa: { t: "Publicado", c: "bg-emerald-100 text-emerald-800" },
  pausada: { t: "Pausado", c: "bg-zinc-200 text-zinc-700" },
  vendida: { t: "Vendido", c: "bg-ink text-white" },
  borrador: { t: "Borrador", c: "bg-amber-100 text-amber-800" },
};

export default function Productos() {
  const { seller } = useOutletContext();
  const loc = useLocation();
  const nav = useNavigate();
  const [items, setItems] = useState(null);
  const [flash, setFlash] = useState(loc.state?.flash || "");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("products")
      .select("id, slug, title, list_price, photos, status, moderation, stock, product_rules(floor_price, auto_accept_pct)")
      .eq("seller_id", seller.id).order("created_at", { ascending: false });
    if (error) setErr("No pudimos cargar tus productos.");
    setItems(data || []);
  }, [seller.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (loc.state?.flash) { nav(".", { replace: true, state: null }); const t = setTimeout(() => setFlash(""), 4000); return () => clearTimeout(t); } }, []); // eslint-disable-line

  const setStatus = async (p, status) => {
    setErr("");
    const { error } = await supabase.from("products").update({ status }).eq("id", p.id);
    if (error) return setErr(friendlyDbError(error));
    load();
  };
  const remove = async (p) => {
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return setErr("No pudimos borrarlo. Probá de nuevo.");
    removePhotos(p.photos);
    load();
  };
  const copyLink = async (p) => {
    const url = `${window.location.origin}/${seller.slug}/${p.slug}`;
    try { await navigator.clipboard.writeText(url); setFlash("Link copiado ✓ Pegalo en WhatsApp, Instagram o Marketplace."); }
    catch { setFlash(url); }
    setTimeout(() => setFlash(""), 4000);
  };

  return (
    <>
      <BrandBar />
      <main className="px-5 pt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-zinc-500">Hola, {seller.name} 👋</p>
            <h1 className="font-display text-2xl font-extrabold">Mis productos</h1>
          </div>
          {items?.length > 0 && <Link to="/panel/cargar" className="flex items-center gap-1 rounded-full bg-hpred px-3.5 py-2 text-[13px] font-semibold text-white"><Plus size={15} /> Cargar</Link>}
        </div>

        {flash && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">{flash}</p>}
        {err && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">{err}</p>}

        {items === null ? <p className="py-16 text-center text-sm text-zinc-500">Cargando…</p>
          : items.length === 0 ? (
            <div className="mt-8 rounded-3xl border-2 border-dashed border-zinc-300 p-8 text-center">
              <p className="text-4xl">📸</p>
              <p className="mt-2 font-display text-lg font-extrabold">Cargá tu primer producto</p>
              <p className="mt-1 text-sm text-zinc-600">Sacás una foto, ponés el precio y lo mínimo que aceptás. En un minuto tenés tu link.</p>
              <Link to="/panel/cargar" className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-hpred px-6 text-[15px] font-semibold text-white">Cargar producto</Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {items.map((p) => <Item key={p.id} p={p} sellerSlug={seller.slug} onStatus={setStatus} onRemove={remove} onCopy={copyLink} />)}
            </ul>
          )}
      </main>
    </>
  );
}

function Item({ p, sellerSlug, onStatus, onRemove, onCopy }) {
  const [confirm, setConfirm] = useState(false);
  const r = Array.isArray(p.product_rules) ? p.product_rules[0] : p.product_rules;
  const st = p.moderation === "pausada" ? { t: "Pausado por revisión", c: "bg-rose-100 text-rose-800" } : STATUS[p.status];
  const btn = "flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[12px] font-semibold ring-1 ring-zinc-200";
  return (
    <li className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
      <div className="flex gap-3 p-3">
        <img src={p.photos?.[0]} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-zinc-100 object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{p.title}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.c}`}>{st.t}</span>
          </div>
          <p className="mt-0.5 text-[16px] font-extrabold">{fmt(p.list_price)}</p>
          {r && <p className="flex items-center gap-1 text-[12px] text-zinc-500"><Lock size={11} /> Mínimo {fmt(r.floor_price)}{r.auto_accept_pct ? <> · <Zap size={11} /> sola desde {fmt(Math.round(p.list_price * r.auto_accept_pct / 100))}</> : null}</p>}
          {p.stock > 1 && <p className="text-[12px] text-zinc-500">{p.stock} unidades</p>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 border-t border-zinc-100 p-2">
        <button onClick={() => onCopy(p)} className={btn + " col-span-2 bg-hpred text-white ring-0"}><Link2 size={14} /> Copiar link</button>
        <a href={`/${sellerSlug}/${p.slug}`} target="_blank" rel="noreferrer" className={btn + " col-span-2"}><Eye size={13} /> Ver como comprador</a>
        <Link to={`/panel/producto/${p.id}`} className={btn}><Pencil size={13} /> Editar</Link>
        {p.status === "activa" ? <button onClick={() => onStatus(p, "pausada")} className={btn}><Pause size={13} /> Pausar</button>
          : <button onClick={() => onStatus(p, "activa")} className={btn}><Play size={13} /> Activar</button>}
        {p.status !== "vendida" && <button onClick={() => onStatus(p, "vendida")} className={btn + " col-span-2"}><CheckCircle2 size={13} /> Marcar vendido</button>}
        {!confirm ? <button onClick={() => setConfirm(true)} className={btn + " col-span-2 text-rose-700"}><Trash2 size={13} /> Borrar</button>
          : <button onClick={() => onRemove(p)} className={btn + " col-span-2 bg-rose-600 text-white ring-0"}>¿Seguro? Borrar</button>}
      </div>
    </li>
  );
}
