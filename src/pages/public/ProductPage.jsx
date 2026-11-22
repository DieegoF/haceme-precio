import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, MapPin, Truck, Share2, ShieldCheck, BadgeCheck, Store, Package } from "lucide-react";
import { getProduct, getSellerBySlug } from "../../lib/publicData.js";
import { fmt } from "../../lib/format.js";
import Gallery from "../../components/Gallery.jsx";
import BuyerOffer from "../../components/BuyerOffer.jsx";
import StoreBuy from "../../components/StoreBuy.jsx";
import { PromoBanner, FreeShipNote } from "../../components/StoreExtras.jsx";
import { priceFor, offPct, trackVisit, activePromo, inScope } from "../../lib/promo.js";
import { StoreAvatar } from "../../components/StoreBrand.jsx";
import { Phone } from "../../components/Brand.jsx";
import { Stars, useSellerReviews } from "../../components/Reviews.jsx";
import { avgText } from "../../lib/reviews.js";
import ReportButton from "../../components/ReportButton.jsx";
import { LOGO_HORIZ } from "../../prototype/brand.js";

export default function ProductPage() {
  const { sellerSlug, productSlug } = useParams();
  const [state, setState] = useState({ loading: true });
  const [shared, setShared] = useState("");
  const [color, setColor] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const seller = await getSellerBySlug(sellerSlug.toLowerCase());
      const product = seller ? await getProduct(seller.id, productSlug.toLowerCase()) : null;
      if (!alive) return;
      setState({ loading: false, seller, product });
      if (product) document.title = `${product.title} · ${fmt(product.list_price)}`;
      if (seller?.store) trackVisit(seller.id);
    })();
    return () => { alive = false; };
  }, [sellerSlug, productSlug]);
  const reviews = useSellerReviews(state.seller?.id);

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
      <TopBar seller={seller} />
      <main className="px-5 py-16 text-center">
        <p className="text-4xl">🔎</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Esta publicación ya no está disponible</h1>
        <p className="mt-2 text-sm text-zinc-600">Puede que el vendedor la haya pausado o borrado.</p>
        {seller && <Link to={`/${seller.slug}`} className="mt-6 inline-flex min-h-[48px] items-center rounded-2xl bg-ink px-6 font-semibold text-white">Ver lo que vende {seller.name}</Link>}
      </main>
    </Phone>
  );

  const sold = p.status === "vendida";
  const fixed = p.mode === "fijo"; // en la tienda cada producto es precio fijo o «acepto ofertas»
  const store = seller.store;
  const gallery = color && p.color_photos?.[color]?.length ? p.color_photos[color] : p.photos;
  const pr = fixed ? priceFor(p, store) : { price: p.list_price, was: null, promo: false };
  const off = offPct(pr.price, pr.was);
  return (
    <Phone wide className="relative pb-28 lg:pb-12">
      <TopBar seller={seller} right={<button onClick={share} className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold"><Share2 size={13} /> {shared || "Compartir"}</button>} />
      <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:px-8 lg:pt-4">
      <div className="relative lg:sticky lg:top-4 lg:self-start lg:overflow-hidden lg:rounded-3xl">
        <Gallery key={gallery.join("|")} photos={gallery} alt={p.title} />
        {sold && <div className="absolute inset-0 flex items-center justify-center bg-white/60"><span className="rotate-[-8deg] rounded-xl bg-ink px-5 py-2 font-display text-2xl font-black text-white">VENDIDO</span></div>}
      </div>

      <main className="px-5 pt-4 lg:px-0 lg:pt-0">
        <div className="flex flex-wrap gap-1.5">
          {p.liquidation && <span className="rounded-full bg-hpred px-2.5 py-0.5 text-[11px] font-bold text-white">🔥 Liquidación</span>}
          {fixed && p.collection && <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">{p.collection}</span>}
          {!fixed && p.condition && <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">{p.condition}</span>}
          {!fixed && p.category && !store && <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">{p.category}</span>}
        </div>
        <h1 className="mt-2 font-display text-[22px] font-extrabold leading-tight">{p.title}</h1>
        <p className="mt-1 text-3xl font-black">{fmt(pr.price)} {off > 0 && <span className="align-middle text-base font-semibold text-zinc-400 line-through">{fmt(pr.was)}</span>} {off > 0 && <span className="align-middle rounded-full bg-hpred px-2 py-0.5 text-[12px] font-bold text-white">-{off}%</span>}</p>
        {!sold && <p className="text-[13px] text-zinc-600">{p.liquidation ? "Remate de stock · hasta agotar" : fixed ? "Precio fijo · nuevo con etiqueta" : "Precio publicado · podés hacer tu oferta"}</p>}
        {fixed && store && !sold && <>{(() => { const pm = activePromo(store); return pm && !p.liquidation && inScope(p, pm) ? <PromoBanner store={store} className="mt-3" /> : null; })()}<FreeShipNote store={store} className="mt-2" /></>}
        {!sold && (fixed ? <StoreBuy product={p} seller={seller} store={store} price={pr.price} color={color} onColor={setColor} /> : <BuyerOffer product={p} seller={seller} />)}

        <ul className="mt-4 space-y-2 text-[14px] text-zinc-700">
          {store ? (
            <>
              {store.pickup && <li className="flex gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-zinc-500" /> Retiro en {store.address}{store.hours ? ` · ${store.hours}` : ""}</li>}
              {store.shipping_enabled && <li className="flex gap-2"><Truck size={17} className="mt-0.5 shrink-0 text-zinc-500" /> Envíos: {store.shipping_note || "a coordinar"}</li>}
            </>
          ) : (
            <>
              {p.location && <li className="flex gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-zinc-500" /> Entrega en {p.location}</li>}
              <li className="flex gap-2"><Truck size={17} className="mt-0.5 shrink-0 text-zinc-500" /> {p.shipping_enabled ? `Hace envíos: ${p.shipping_note || "a coordinar"}` : "Sin envío: se retira en persona"}</li>
            </>
          )}
          {p.stock > 1 && !sold && !fixed && <li className="flex gap-2"><Package size={17} className="mt-0.5 shrink-0 text-zinc-500" /> Hay {p.stock} disponibles</li>}
        </ul>

        {p.description && (
          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Descripción</h2>
            <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-zinc-800">{p.description}</p>
          </section>
        )}

        <Link to={`/${seller.slug}`} className="mt-5 flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
          {store ? <StoreAvatar name={seller.name} logo={store.logo_url} color={store.color} size={44} /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-lg font-black text-white">{seller.name.charAt(0).toUpperCase()}</span>}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 font-semibold">{seller.name} {seller.phone_verified && <BadgeCheck size={15} className="text-sky-600" aria-label="Teléfono verificado" />}</span>
            {reviews?.count > 0 && <span className="flex items-center gap-1 text-[12px] font-semibold text-zinc-700"><Stars value={reviews.avg} size={12} /> {avgText(reviews.avg)} ({reviews.count})</span>}
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
        <div className="mt-4 flex justify-center"><ReportButton kind="producto" target={p.id} /></div>
        <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-400">Haceme Precio es una herramienta para gestionar ofertas entre partes. No actúa como intermediario financiero ni garantiza entregas.</p>
      </main>
      </div>

      {sold ? (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-zinc-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:mx-8 lg:mt-6 lg:max-w-sm lg:border-0 lg:bg-transparent lg:p-0">
          <Link to={`/${seller.slug}`} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink text-[16px] font-semibold text-white">Ver otras cosas de {seller.name}</Link>
        </div>
      ) : null}
    </Phone>
  );
}

// Arriba: «Volver» a la tienda del vendedor (va directo, aunque el link haya llegado por WhatsApp).
function TopBar({ right, seller }) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
      {seller ? (
        <Link to={`/${seller.slug}`} className="flex min-h-[40px] min-w-0 items-center gap-1.5 rounded-full bg-zinc-100 py-2 pl-2.5 pr-4 text-[14px] font-semibold">
          <ChevronLeft size={18} className="shrink-0" /> <span className="truncate">Volver a {seller.name}</span>
        </Link>
      ) : <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-6 w-auto" />}
      {right}
    </header>
  );
}
