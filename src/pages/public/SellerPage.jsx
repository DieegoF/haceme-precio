import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, Share2, MapPin, MessageCircle, Truck } from "lucide-react";
import { StoreAvatar, StoreBanner } from "../../components/StoreBrand.jsx";
import { waLink } from "../../lib/offers.js";
import { getSellerBySlug, getSellerProducts } from "../../lib/publicData.js";
import { fmt } from "../../lib/format.js";
import { Phone } from "../../components/Brand.jsx";
import { LOGO_HORIZ } from "../../prototype/brand.js";
import NotFound from "../NotFound.jsx";

// Vidriera del vendedor: todo lo que tiene publicado, en un solo link.
export default function SellerPage() {
  const { sellerSlug } = useParams();
  const [state, setState] = useState({ loading: true });
  const [shared, setShared] = useState("");
  const [col, setCol] = useState("Todo");

  useEffect(() => {
    let alive = true;
    (async () => {
      const seller = await getSellerBySlug(sellerSlug.toLowerCase());
      const products = seller ? await getSellerProducts(seller.id) : [];
      if (!alive) return;
      setState({ loading: false, seller, products });
      if (seller) document.title = `${seller.name} · Haceme Precio`;
    })();
    return () => { alive = false; };
  }, [sellerSlug]);

  if (state.loading) return <Phone><p className="py-24 text-center text-sm text-zinc-500">Cargando…</p></Phone>;
  if (!state.seller) return <NotFound />;
  const { seller, products } = state;
  const active = products.filter((p) => p.status === "activa");
  const collections = ["Todo", ...new Set(products.map((p) => p.collection).filter(Boolean))];
  const shown = col === "Todo" ? products : products.filter((p) => p.collection === col);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: seller.name, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setShared("Link copiado ✓"); setTimeout(() => setShared(""), 2500); }
    } catch { /* canceló */ }
  };

  return (
    <Phone className="pb-10">
      <header className="flex items-center justify-between px-4 py-3">
        <Link to="/" aria-label="Haceme Precio"><img src={LOGO_HORIZ} alt="Haceme Precio" className="h-6 w-auto" /></Link>
        <button onClick={share} className="flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold"><Share2 size={13} /> {shared || "Compartir"}</button>
      </header>
      {seller.store ? <StoreHeader seller={seller} store={seller.store} /> : (
      <section className="px-5 pt-2">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-2xl font-black text-white">{seller.name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="flex items-center gap-1 font-display text-2xl font-extrabold leading-tight">{seller.name} {seller.phone_verified && <BadgeCheck size={18} className="text-sky-600" aria-label="Teléfono verificado" />}</h1>
            <p className="text-[13px] text-zinc-500">{active.length} {active.length === 1 ? "publicación" : "publicaciones"} · hacé tu oferta en cada una</p>
          </div>
        </div>
      </section>
      )}

      {products.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-zinc-500">Todavía no hay publicaciones. ¡Volvé pronto!</p>
      ) : (
        <>
        {seller.store && collections.length > 2 && (
          <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {collections.map((c) => (
              <button key={c} onClick={() => setCol(c)} style={col === c ? { backgroundColor: seller.store.color } : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${col === c ? "text-white" : "bg-zinc-100 text-zinc-700"}`}>{c}</button>
            ))}
          </div>
        )}
        <ul className="mt-4 grid grid-cols-2 gap-3 px-4">
          {shown.map((p) => (
            <li key={p.id}>
              <Link to={`/${seller.slug}/${p.slug}`} className="block overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
                <div className="relative aspect-square bg-zinc-100">
                  <img src={p.photos?.[0]} alt={p.title} loading="lazy" className={`h-full w-full object-cover ${p.status === "vendida" ? "opacity-50 grayscale" : ""}`} />
                  {p.status === "vendida" ? <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">Vendido</span>
                    : p.mode === "fijo" && p.stock <= 0 ? <span className="absolute left-2 top-2 rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-bold text-white">Sin stock</span>
                    : p.liquidation ? <span className="absolute left-2 top-2 rounded-full bg-hpred px-2 py-0.5 text-[10px] font-bold text-white">🔥 Haceme precio</span>
                    : p.compare_at > p.list_price ? <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">-{Math.round((1 - p.list_price / p.compare_at) * 100)}%</span> : null}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug">{p.title}</p>
                  <p className="mt-1 text-[15px] font-extrabold">{fmt(p.list_price)} {p.compare_at > p.list_price && <span className="text-[12px] font-medium text-zinc-400 line-through">{fmt(p.compare_at)}</span>}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        </>
      )}
    </Phone>
  );
}

function StoreHeader({ seller, store }) {
  return (
    <>
      <StoreBanner banner={store.banner_url} color={store.color} className="h-32 sm:h-40" />
      <section className="px-5 pb-2">
        <div className="-mt-11 flex items-end justify-between">
          <StoreAvatar name={seller.name} logo={store.logo_url} color={store.color} size={88} />
          {seller.phone_verified && <span className="mb-1 flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700"><BadgeCheck size={13} /> Verificada</span>}
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight">{seller.name}</h1>
        {store.tagline && <p className="text-[14px] text-zinc-600">{store.tagline}</p>}
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-zinc-500"><MapPin size={14} className="mt-0.5 shrink-0" /> {store.address}{store.hours ? ` · ${store.hours}` : ""}</p>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] text-zinc-500"><Truck size={14} className="mt-0.5 shrink-0" /> {[store.pickup && "Retiro en el local", store.shipping_enabled && `Envíos: ${store.shipping_note || "a coordinar"}`].filter(Boolean).join(" · ")}</p>
        {store.whatsapp && (
          <a href={waLink(store.whatsapp, `¡Hola ${seller.name}! Vi tu tienda en Haceme Precio 🙂`)} target="_blank" rel="noreferrer"
            style={{ backgroundColor: store.color }} className="mt-3 flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold text-white">
            <MessageCircle size={16} /> Consultar por WhatsApp
          </a>
        )}
      </section>
    </>
  );
}
