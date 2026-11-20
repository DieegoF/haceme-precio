import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MapPin, Truck, Share2, ShieldCheck, BadgeCheck, Store, Package } from "lucide-react";
import { getProduct, getSellerBySlug } from "../../lib/publicData.js";
import { fmt } from "../../lib/format.js";
import Gallery from "../../components/Gallery.jsx";
import { Phone } from "../../components/Brand.jsx";
import { LOGO_HORIZ } from "../../prototype/brand.js";

export default function ProductPage() {
  const { sellerSlug, productSlug } = useParams();
  const [state, setState] = useState({ loading: true });
  const [shared, setShared] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const seller = await getSellerBySlug(sellerSlug.toLowerCase());
      const product = seller ? await getProduct(seller.id, productSlug.toLowerCase()) : null;
      if (!alive) return;
      setState({ loading: false, seller, product });
      if (product) document.title = `${product.title} · ${fmt(product.list_price)}`;
    })();
    return () => { alive = false; };
  }, [sellerSlug, productSlug]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: state.product.title, url });
      else { await navigator.clipboard.writeText(url); setShared("Link copiado ✓"); setTimeout(() => setShared(""), 2500); }
    } catch { /* el usuario canceló */ }
  };

  if (state.loading) return <Phone><p className="py-24 text-center text-sm text-zinc-500">Cargando…</p></Phone>;
  const { seller, product: p } = state;
  if (!p) return (
    <Phone>
      <TopBar />
      <main className="px-5 py-16 text-center">
        <p className="text-4xl">🔎</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Esta publicación ya no está disponible</h1>
        <p className="mt-2 text-sm text-zinc-600">Puede que el vendedor la haya pausado o borrado.</p>
        {seller && <Link to={`/${seller.slug}`} className="mt-6 inline-flex min-h-[48px] items-center rounded-2xl bg-ink px-6 font-semibold text-white">Ver lo que vende {seller.name}</Link>}
      </main>
    </Phone>
  );

  const sold = p.status === "vendida";
  return (
    <Phone className="relative pb-28">
      <TopBar right={<button onClick={share} className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold"><Share2 size={13} /> {shared || "Compartir"}</button>} />
      <div className="relative">
        <Gallery photos={p.photos} alt={p.title} />
        {sold && <div className="absolute inset-0 flex items-center justify-center bg-white/60"><span className="rotate-[-8deg] rounded-xl bg-ink px-5 py-2 font-display text-2xl font-black text-white">VENDIDO</span></div>}
      </div>

      <main className="px-5 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {p.condition && <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">{p.condition}</span>}
          {p.category && <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">{p.category}</span>}
        </div>
        <h1 className="mt-2 font-display text-[22px] font-extrabold leading-tight">{p.title}</h1>
        <p className="mt-1 text-3xl font-black">{fmt(p.list_price)}</p>
        {!sold && <p className="text-[13px] text-zinc-600">Precio publicado · podés hacer tu oferta</p>}

        <ul className="mt-4 space-y-2 text-[14px] text-zinc-700">
          {p.location && <li className="flex gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-zinc-500" /> Entrega en {p.location}</li>}
          <li className="flex gap-2"><Truck size={17} className="mt-0.5 shrink-0 text-zinc-500" /> {p.shipping_enabled ? `Hace envíos: ${p.shipping_note || "a coordinar"}` : "Sin envío: se retira en persona"}</li>
          {p.stock > 1 && !sold && <li className="flex gap-2"><Package size={17} className="mt-0.5 shrink-0 text-zinc-500" /> Hay {p.stock} disponibles</li>}
        </ul>

        {p.description && (
          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Descripción</h2>
            <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-zinc-800">{p.description}</p>
          </section>
        )}

        <Link to={`/${seller.slug}`} className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-lg font-black text-white">{seller.name.charAt(0).toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-semibold">{seller.name} {seller.phone_verified && <BadgeCheck size={15} className="text-sky-600" aria-label="Teléfono verificado" />}</span>
            <span className="block text-[12px] text-zinc-500">Vende en Haceme Precio desde {new Date(seller.created_at).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</span>
          </span>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-hpred"><Store size={13} /> Ver todo</span>
        </Link>

        <section className="mt-4 rounded-2xl bg-ink p-4 text-white">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-kraft"><ShieldCheck size={14} /> Comprá seguro</p>
          <ul className="mt-2 space-y-1 text-[13px] text-zinc-200">
            <li>• Si pagás por Mercado Pago dentro de la app, se confirma solo cuando el pago está verificado.</li>
            <li>• Si es en persona: lugar público, de día, y revisá el producto antes de pagar.</li>
            <li>• Nunca pagues por adelantado a alguien que te escribe por fuera.</li>
          </ul>
        </section>
        <p className="mt-6 text-center text-[10px] leading-relaxed text-zinc-400">Haceme Precio es una herramienta para gestionar ofertas entre partes. No actúa como intermediario financiero ni garantiza entregas.</p>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-zinc-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        {sold ? (
          <Link to={`/${seller.slug}`} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-white">Ver otras cosas de {seller.name}</Link>
        ) : (
          <button disabled className="flex min-h-[52px] w-full flex-col items-center justify-center rounded-2xl bg-hpred text-white opacity-60">
            <span className="text-[16px] font-semibold">Hacer mi oferta</span>
            <span className="text-[11px]">Se activa en la próxima actualización</span>
          </button>
        )}
      </div>
    </Phone>
  );
}

function TopBar({ right }) {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <Link to="/" aria-label="Haceme Precio"><img src={LOGO_HORIZ} alt="Haceme Precio" className="h-6 w-auto" /></Link>
      {right}
    </header>
  );
}
