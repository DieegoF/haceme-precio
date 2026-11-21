import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Camera, Images, X, Lock, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { uploadPhoto, removePhotos } from "../../lib/photos.js";
import { fmt, parseMoney, moneyInput } from "../../lib/format.js";
import { friendlyDbError } from "../../lib/errors.js";
import VariantBuilder, { toVariants, fromVariants } from "../../components/VariantBuilder.jsx";
import CategoryPicker from "../../components/CategoryPicker.jsx";

const CATEGORIES = ["Tecnología", "Hogar y muebles", "Ropa y accesorios", "Vehículos", "Deportes", "Bebés y niños", "Herramientas", "Otros"];
const CONDITIONS = ["Nuevo", "Como nuevo", "Usado"];
const MAX_PHOTOS = 6;

// Cargar o editar un producto. Las reglas (mínimo y venta automática) se guardan aparte, en la tabla privada.
export default function ProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { seller, account } = useOutletContext();
  const isStore = Boolean(seller.is_store);
  const nav = useNavigate();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const [loading, setLoading] = useState(editing);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [f, setF] = useState({ title: "", price: "", floor: "", autoOn: true, autoPct: 95, condition: isStore ? "Nuevo" : "Usado", category: "", description: "", location: "", shipping: false, shippingNote: "", stock: 1,
    mode: isStore ? "fijo" : "oferta", compareAt: "", collection: "", liquidation: false });
  const [variants, setVariants] = useState({ colors: [], sizes: [], stock: {} });
  const [photoColor, setPhotoColor] = useState({}); // url -> color (vacío = todos los colores)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));

  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data, error } = await supabase.from("products").select("*, product_rules(floor_price, auto_accept_pct), product_variants(color, size, stock)").eq("id", id).maybeSingle();
      if (error || !data) { setErr("No encontramos ese producto."); setLoading(false); return; }
      const r = Array.isArray(data.product_rules) ? data.product_rules[0] : data.product_rules;
      setPhotos(data.photos || []);
      setF({
        title: data.title, price: moneyInput(data.list_price), floor: r ? moneyInput(r.floor_price) : "",
        autoOn: Boolean(r?.auto_accept_pct), autoPct: r?.auto_accept_pct || 95, condition: data.condition || "Usado",
        category: data.category || "", description: data.description || "", location: data.location || "",
        shipping: data.shipping_enabled, shippingNote: data.shipping_note || "", stock: data.stock,
        mode: data.mode, compareAt: data.compare_at ? moneyInput(data.compare_at) : "", collection: data.collection || "", liquidation: Boolean(data.liquidation),
      });
      if (data.has_variants) setVariants(fromVariants(data.product_variants || []));
      const pc = {};
      Object.entries(data.color_photos || {}).forEach(([c, urls]) => urls.forEach((u) => { pc[u] = c; }));
      setPhotoColor(pc);
      setLoading(false);
    })();
  }, [editing, id]);

  const price = parseMoney(f.price);
  const floor = parseMoney(f.floor);
  const autoFrom = Math.round((price * f.autoPct) / 100);
  const isPase = account?.plan === "pase";
  const fixed = f.mode === "fijo";
  const compareAt = parseMoney(f.compareAt);
  const varList = isStore && f.mode === "fijo" ? toVariants(variants) : null;

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = "";
    if (!files.length) return;
    setErr(""); setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const url = await uploadPhoto(file, seller.id);
        setPhotos((p) => [...p, url]);
      } catch {
        setErr("Una foto no se pudo subir. Probá de nuevo o con otra foto.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const dropPhoto = (url) => { setPhotos((p) => p.filter((x) => x !== url)); removePhotos([url]); };
  const makeCover = (url) => setPhotos((p) => [url, ...p.filter((x) => x !== url)]);

  const problems = [];
  if (!photos.length) problems.push("Subí al menos una foto");
  if (f.title.trim().length < 3) problems.push("Escribí qué vendés");
  if (!price) problems.push("Poné el precio");
  if (!fixed && !floor) problems.push("Poné lo mínimo que aceptás");
  if (!fixed && floor > price) problems.push("Lo mínimo no puede ser más que el precio");
  if (fixed && compareAt && compareAt <= price) problems.push("El precio anterior tiene que ser mayor al actual");
  if (isStore && f.liquidation && !compareAt) problems.push("En liquidación poné el precio de antes, así se ve cuánto bajó");

  const save = async (e) => {
    e.preventDefault();
    if (problems.length || uploading) return;
    setBusy(true); setErr("");
    const colorPhotos = {};
    photos.forEach((u) => { const c = photoColor[u]; if (c && variants.colors.includes(c)) (colorPhotos[c] ||= []).push(u); });
    const p = {
      title: f.title.trim(), description: f.description.trim() || null, category: isStore ? "Ropa y accesorios" : f.category || null, condition: f.condition,
      list_price: price, photos, stock: isPase ? 1 : Math.max(isStore ? 0 : 1, Number(f.stock) || 0), location: isStore ? null : f.location.trim() || null,
      shipping_enabled: isStore ? false : f.shipping, shipping_note: !isStore && f.shipping ? f.shippingNote.trim() || "A coordinar" : null,
      mode: f.mode, compare_at: fixed && compareAt ? compareAt : "", collection: isStore ? f.collection.trim() || null : null,
      liquidation: isStore && fixed && f.liquidation, color_photos: colorPhotos,
    };
    const r = fixed ? null : { floor_price: floor, auto_accept_pct: f.autoOn ? f.autoPct : "" };
    const { error } = await supabase.rpc("save_product", { p_id: editing ? id : null, p, r, v: varList });
    setBusy(false);
    if (error) return setErr(friendlyDbError(error));
    nav("/panel/productos", { replace: true, state: { flash: editing ? "Cambios guardados ✓" : "¡Publicado! Ya podés compartir tu link." } });
  };

  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";
  const label = "mt-5 block text-sm font-semibold";
  if (loading) return <p className="py-20 text-center text-sm text-zinc-500">Cargando…</p>;

  return (
    <form onSubmit={save} className="px-5 pb-8 pt-5">
      <button type="button" onClick={() => nav("/panel/productos")} className="flex items-center gap-1 text-[13px] font-semibold text-zinc-500"><ArrowLeft size={15} /> Mis productos</button>
      <h1 className="mt-2 font-display text-2xl font-extrabold">{editing ? "Editar producto" : "Cargar un producto"}</h1>
      {seller.is_demo && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-950 ring-1 ring-amber-200">
          {editing ? "En la demo podés cambiar el precio, el mínimo y el stock. Los textos y las fotos quedan fijos." : "Mirá el formulario tranquilo: en la demo no se guardan productos nuevos. Con tu cuenta cargás una foto, ponés el precio y listo."}
        </p>
      )}

      <p className={label}>Fotos <span className="font-normal text-zinc-500">({photos.length}/{MAX_PHOTOS}) · la primera es la portada</span></p>
      {photos.length === 0 && <p className="mt-0.5 text-[12px] text-zinc-500">Sacá la foto con buena luz, de frente y sobre un fondo liso.</p>}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {photos.map((url, i) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-zinc-200">
            <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => dropPhoto(url)} aria-label="Sacar foto" className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><X size={14} /></button>
            {i === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-hpred px-2 py-0.5 text-[10px] font-bold text-white">Portada</span>
              : <button type="button" onClick={() => makeCover(url)} className="absolute bottom-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold">Hacer portada</button>}
            {isStore && fixed && variants.colors.length > 0 && (
              <select value={photoColor[url] || ""} onChange={(e) => setPhotoColor((m) => ({ ...m, [url]: e.target.value }))} aria-label="Color de esta foto"
                className="absolute left-1 top-1 max-w-[70%] rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">
                <option value="">Todos</option>
                {variants.colors.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={"u" + i} className="flex aspect-square items-center justify-center rounded-xl bg-zinc-100 ring-1 ring-zinc-200"><Loader2 className="animate-spin text-zinc-400" /></div>
        ))}
        {photos.length + uploading < MAX_PHOTOS && (
          <div className="grid aspect-square grid-rows-2 gap-1.5">
            <button type="button" onClick={() => cameraRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-xl bg-hpred text-[12px] font-semibold text-white">
              <Camera size={17} /> Sacar foto
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 text-[12px] font-semibold text-zinc-600">
              <Images size={17} /> Galería
            </button>
          </div>
        )}
      </div>
      {/* capture="environment" abre la cámara trasera directo; la galería permite elegir varias a la vez */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={addPhotos} aria-label="Sacar foto con la cámara" />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} aria-label="Elegir fotos de la galería" />
      {isStore && fixed && variants.colors.length > 0 && photos.length > 0 && <p className="mt-1.5 text-[11px] text-zinc-500">Arriba de cada foto elegí de qué color es: al elegir un color, tu cliente ve esas fotos.</p>}

      <label className={label} htmlFor="title">¿Qué vendés?</label>
      <input id="title" maxLength={80} value={f.title} onChange={set("title")} placeholder={isStore ? "Ej: Remera oversize algodón" : "Ej: Bici rodado 26 con cambios"} className={input} />

      {isStore && (
        <>
          <p className={label}>¿Cómo lo vendés?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[["fijo", "🏷️ Precio fijo", "Lo compran directo al precio que pusiste."], ["oferta", "🤝 Acepto ofertas", "Te pueden ofertar (ideal para usados o feria americana)."]].map(([m, t, d]) => (
              <button type="button" key={m} onClick={() => setF((x) => ({ ...x, mode: m, condition: m === "oferta" && x.condition === "Nuevo" ? "Usado" : x.condition }))}
                className={`rounded-2xl p-3 text-left ring-2 ${f.mode === m ? "bg-ink/5 ring-ink" : "ring-zinc-200"}`}>
                <span className="block text-[14px] font-bold">{t}</span><span className="mt-0.5 block text-[12px] text-zinc-500">{d}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {fixed ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="price">Precio</label>
            <input id="price" inputMode="numeric" value={f.price} onChange={(e) => setF((x) => ({ ...x, price: moneyInput(e.target.value) }))} placeholder="$ 18.000" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="cmp">Precio anterior <span className="font-normal text-zinc-500">(opcional)</span></label>
            <input id="cmp" inputMode="numeric" value={f.compareAt} onChange={(e) => setF((x) => ({ ...x, compareAt: moneyInput(e.target.value) }))} placeholder="$ 22.000" className={input} />
          </div>
          {compareAt > price && price > 0 && <p className="col-span-2 -mt-1 text-[12px] text-zinc-600">Se muestra tachado: <s>{fmt(compareAt)}</s> → <b>{fmt(price)}</b> (−{Math.round((1 - price / compareAt) * 100)}%)</p>}
          {isStore && (
            <label className={`col-span-2 flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-2 ${f.liquidation ? "bg-hpred/5 ring-hpred" : "ring-zinc-200"}`}>
              <input type="checkbox" checked={f.liquidation} onChange={(e) => setF((x) => ({ ...x, liquidation: e.target.checked }))} className="mt-0.5 h-5 w-5 accent-[#C8102E]" />
              <span><span className="block text-[14px] font-bold">🔥 Es liquidación</span>
                <span className="block text-[12px] text-zinc-500">Para rematar stock que no salió. Va a precio fijo con el precio de antes tachado y aparece en la sección «Liquidación» de tu tienda.</span></span>
            </label>
          )}
        </div>
      ) : (<>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="price">Precio publicado</label>
          <input id="price" inputMode="numeric" value={f.price} onChange={(e) => setF((x) => ({ ...x, price: moneyInput(e.target.value) }))} placeholder="$ 150.000" className={input} />
        </div>
        <div>
          <label className={label + " flex items-center gap-1"} htmlFor="floor"><Lock size={13} /> Lo mínimo</label>
          <input id="floor" inputMode="numeric" value={f.floor} onChange={(e) => setF((x) => ({ ...x, floor: moneyInput(e.target.value) }))} placeholder="$ 120.000" className={input} />
        </div>
      </div>
      <p className="mt-1.5 text-[12px] text-zinc-500">🔒 <b>Lo mínimo no lo ve nadie.</b> Las ofertas más bajas se frenan solas{price ? <> · <button type="button" className="font-semibold text-hpred underline" onClick={() => setF((x) => ({ ...x, floor: moneyInput(Math.round(price * 0.85 / 100) * 100) }))}>usar {fmt(Math.round(price * 0.85 / 100) * 100)} (85%)</button></> : null}</p>

      <div className="mt-5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Aceptar sola si ofrecen cerca del precio</span>
          <input type="checkbox" checked={f.autoOn} onChange={set("autoOn")} className="h-5 w-5 accent-hpred" />
        </label>
        {f.autoOn && (
          <>
            <div className="mt-3 flex gap-2">
              {[90, 95, 100].map((n) => (
                <button type="button" key={n} onClick={() => setF((x) => ({ ...x, autoPct: n }))} className={`flex-1 rounded-xl py-2 text-sm font-bold ${f.autoPct === n ? "bg-hpred text-white" : "bg-white ring-1 ring-zinc-300"}`}>{n}%</button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-zinc-600">{price ? <>Si ofrecen <b>{fmt(autoFrom)} o más</b>, se acepta sola y te avisamos.</> : "Poné el precio para ver desde cuánto."}</p>
          </>
        )}
      </div>
      </>)}

      {isStore && (
        <>
          <p className={label}>Categoría del producto</p>
          <CategoryPicker sellerId={seller.id} value={f.collection} onChange={(c) => setF((x) => ({ ...x, collection: c }))} />
          {fixed ? (
            <>
              <p className={label}>Talles, colores y stock</p>
              <div className="mt-2"><VariantBuilder value={variants} onChange={setVariants} /></div>
              {!varList && <p className="mt-1 text-[12px] text-zinc-500">Si no tiene talles ni colores, dejá todo vacío y poné la cantidad abajo.</p>}
            </>
          ) : (
            <>
              <p className={label}>Estado</p>
              <div className="mt-1 flex gap-2">
                {CONDITIONS.map((c) => (
                  <button type="button" key={c} onClick={() => setF((x) => ({ ...x, condition: c }))} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${f.condition === c ? "bg-ink text-white" : "bg-zinc-100"}`}>{c}</button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!isStore && <>
      <p className={label}>Estado</p>
      <div className="mt-1 flex gap-2">
        {CONDITIONS.map((c) => (
          <button type="button" key={c} onClick={() => setF((x) => ({ ...x, condition: c }))} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${f.condition === c ? "bg-ink text-white" : "bg-zinc-100"}`}>{c}</button>
        ))}
      </div>

      <label className={label} htmlFor="cat">Categoría</label>
      <select id="cat" value={f.category} onChange={set("category")} className={input}>
        <option value="">Elegí una</option>
        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
      </select>
      </>}

      <label className={label} htmlFor="desc">Descripción <span className="font-normal text-zinc-500">(opcional)</span></label>
      <textarea id="desc" rows={3} maxLength={2000} value={f.description} onChange={set("description")} placeholder={isStore ? "Tela, calce, medidas, cuidados…" : "Medidas, detalles, por qué lo vendés…"} className={input} />

      {!isStore && <>
      <label className={label} htmlFor="loc">Zona de entrega</label>
      <input id="loc" maxLength={80} value={f.location} onChange={set("location")} placeholder="Ej: Caballito, CABA" className={input} />

      <label className="mt-5 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Hago envíos</span>
        <input type="checkbox" checked={f.shipping} onChange={set("shipping")} className="h-5 w-5 accent-hpred" />
      </label>
      {f.shipping && <input maxLength={120} value={f.shippingNote} onChange={set("shippingNote")} placeholder="Ej: Moto en CABA, correo al resto" className={input} />}
      </>}

      {!isPase && !varList && (
        <>
          <label className={label} htmlFor="stock">¿Cuántos tenés?</label>
          <input id="stock" type="number" min={1} max={999} value={f.stock} onChange={set("stock")} className={input + " w-28"} />
        </>
      )}

      {err && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">{err}</p>}
      {problems.length > 0 && !err && <p className="mt-4 text-[12px] text-zinc-500">Falta: {problems.join(" · ")}</p>}
      <button disabled={busy || uploading > 0 || problems.length > 0} className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-hpred text-[16px] font-semibold text-white disabled:opacity-40">
        {busy ? "Guardando…" : uploading ? "Subiendo fotos…" : editing ? "Guardar cambios" : "Publicar ahora"}
      </button>
    </form>
  );
}
