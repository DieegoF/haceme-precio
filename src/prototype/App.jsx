import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Smartphone, Sofa, Shirt, Box, ChevronLeft, ChevronRight, ChevronDown, ShoppingBag, HandCoins,
  Store, User, Check, X, Clock, Tag, Percent, Image as ImageIcon, Copy, Plus, MapPin, Truck, ShieldCheck, Zap, MessageSquareOff,
  TrendingUp, Eye, Inbox, Download, Sparkles, ArrowLeftRight, FastForward, CreditCard, Ban,
  RotateCcw, Info, Link2, Activity, Lock, Star, Package, Filter, Pencil, BadgeCheck, Wallet,
  LogOut, Users, Mail, KeyRound, PauseCircle, CalendarClock, Receipt, Bike, Shield, UserPlus, LogIn,
  CalendarPlus, AlertTriangle, PlayCircle, CircleDollarSign, Server,
  Camera, ImagePlus, Trash2, Bell, BellRing, MessageCircle, Settings2, Mic, Square, Wand2, Globe, LifeBuoy, Phone,
} from "lucide-react";
import { LOGO_PERFIL, LOGO_ISOTIPO, LOGO_HORIZDARK, LOGO_HORIZ } from "./brand.js";
import { DEMO_PHOTOS, STORE_PHOTOS, COLOR_HEX, AURA_BRAND } from "./demoPhotos.js";

/* ============================================================
   CONSTANTES & HELPERS
   ============================================================ */
const MIN = 60 * 1000;
const T_PENDING = 15 * MIN; // el vendedor tiene 15 min para responder
const T_COUNTER = 10 * MIN; // el comprador tiene 10 min para responder la contraoferta
const T_CLOSE = 12 * 60 * MIN; // ventana de cierre: 12 h para pagar o coordinar tras la aceptación
const T_PAY = T_CLOSE;
const MAX_ATTEMPTS = 2;
const ACTIVE = ["PENDIENTE", "CONTRAOFERTA_VENDEDOR", "ACEPTADA_PENDIENTE_CIERRE"];
const CLOSED = ["CERRADA_PAGADA", "ACUERDO_CERRADO_EXTERNO"];
const ME = { id: "buyer-me", name: "Lucía (vos)" };

const STATUS = {
  PENDIENTE: { label: "Esperando respuesta", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  ACEPTADA_PENDIENTE_CIERRE: { label: "Aceptada · falta cobrar", cls: "bg-kraft-50 text-hpred-dark ring-kraft-200" },
  RECHAZADA_AUTO: { label: "Muy baja · frenada", cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  RECHAZADA: { label: "No aceptada", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  CONTRAOFERTA_VENDEDOR: { label: "Otro precio propuesto", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  EXPIRADA: { label: "Venció", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
  ACUERDO_CERRADO_EXTERNO: { label: "Cobrada en persona", cls: "bg-ink text-white ring-ink" },
  CERRADA_PAGADA: { label: "Cobrada ✓", cls: "bg-hpred text-white ring-hpred" },
};

/* --- Suscripción de vendedores (lo que cobrás vos) --- */
const DAY = 24 * 60 * MIN;
const SUB_PRICE = 10000; // plan "Vendo seguido": mensual
const TIENDA_PRICE = 40000; // plan "Tienda" para locales
const RESERVE_HOURS = 24; // reserva de un pedido "pago en el local"
const PRO_PRICE = 30000; // plan "Pro": Vendo seguido + IA que publica desde las fotos (a evaluar)
const PASS_PRICE = 5000; // plan "Vendo una sola cosa": pago único
const PASS_DAYS = 30;
const PLANS = {
  mensual: { name: "Vendo seguido", price: SUB_PRICE, per: "/mes", desc: "Publicaciones ilimitadas, vidriera y stock" },
  pase: { name: "Vendo una sola cosa", price: PASS_PRICE, per: " único", desc: `1 publicación por ${PASS_DAYS} días` },
  pro: { name: "Pro", price: PRO_PRICE, per: "/mes", desc: "Todo lo de Vendo seguido + la IA arma tus publicaciones desde las fotos" },
  tienda: { name: "Tienda", price: TIENDA_PRICE, per: "/mes", desc: "Para locales: precio fijo, talles y colores, carrito y pedidos" },
};
/* --- Modo Tienda: variantes (talle + color) con stock --- */
const hasVariants = (p) => Array.isArray(p?.variants) && p.variants.length > 0;
const totalStock = (p) => (hasVariants(p) ? p.variants.reduce((s, v) => s + v.stock, 0) : p?.stock ?? 1);
const variantLabel = (v) => [v.color, v.size].filter((x) => x && x !== "Único").join(" · ") || "Talle único";
const photosFor = (p, color) => {
  const set = STORE_PHOTOS[p.id]?.[color];
  return set ? set.map((src, i) => ({ src, label: `${color} ${i ? "espalda" : "frente"}`, sub: "" })) : p.photos;
};
const SIZE_SETS = { Ropa: ["XS", "S", "M", "L", "XL"], Pantalones: ["36", "38", "40", "42", "44"], Único: ["Único"] };
const planOf = (sl) => PLANS[sl?.plan || "mensual"];
const isMonthly = (sl) => (sl?.plan || "mensual") !== "pase";
const TRIAL_DAYS = 7;
const GRACE_DAYS = 3;

// Regla única de acceso: la misma que en producción iría en la base (RLS) y en el backend.
function subAccess(s, now) {
  if (!s) return { key: "vencida", allowed: false };
  if (s.status === "suspendida") return { key: "suspendida", allowed: false };
  const left = s.periodEnd - now;
  if (s.cancelAt && left <= 0) return { key: "cancelada", allowed: false, daysLeft: 0 }; // canceló: sin días de gracia
  if (left > 0) return { key: s.status === "prueba" ? "prueba" : "activa", allowed: true, daysLeft: Math.ceil(left / DAY) };
  if (left > -GRACE_DAYS * DAY) return { key: "gracia", allowed: true, daysLeft: Math.ceil((left + GRACE_DAYS * DAY) / DAY) };
  return { key: "vencida", allowed: false, daysLeft: 0 };
}
const SUB_STYLE = {
  activa: { label: "Activa", cls: "bg-kraft-50 text-hpred-dark ring-kraft-200" },
  prueba: { label: "Prueba gratis", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  gracia: { label: "Pago vencido", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  vencida: { label: "Bloqueada", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  suspendida: { label: "Suspendida", cls: "bg-zinc-900 text-white ring-zinc-900" },
  cancelada: { label: "Plan cancelado", cls: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
};
/* Reputación: promedio + distribución de estrellas (solo reseñas visibles) */
const REVIEW_TAGS = ["Igual a las fotos", "Llegó puntual", "Respondió rápido", "Buena onda", "Buen embalaje"];
function repOf(reviews, sellerId) {
  const list = reviews.filter((r) => r.sellerId === sellerId && !r.hidden);
  const count = list.length;
  const avg = count ? list.reduce((s, r) => s + r.stars, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => list.filter((r) => r.stars === n).length);
  const tagCount = {};
  list.forEach((r) => r.tags.forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { count, avg, dist, topTags, list: list.sort((a, b) => b.at - a.at) };
}
const fmtStars = (avg) => avg.toFixed(1).replace(".", ",");
const daysLeft = (ms) => Math.max(0, Math.ceil(ms / DAY));
const fmtDate = (t) => new Date(t).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
const initials = (n) => n.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

const CATEGORY_ICON = { "Tecnología": Smartphone, Hogar: Sofa, Ropa: Shirt, Deportes: Bike, Otros: Box };
const CONDITIONS = ["Nuevo - Sin uso", "Usado - Como nuevo", "Usado - Muy buen estado", "Usado - Con detalles"];
const PALETTES = [
  "from-zinc-200 via-zinc-100 to-white",
  "from-slate-300 via-slate-100 to-white",
  "from-stone-200 via-stone-100 to-white",
  "from-kraft-100 via-zinc-100 to-white",
  "from-sky-100 via-slate-100 to-white",
];

const fmt = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const round1k = (n) => Math.round(n / 1000) * 1000;
const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 8);
const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
};
const clockTime = (t) =>
  new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const slugify = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "").slice(0, 40) || "producto";

/* ============================================================
   SUB-AGENTE 1 · MOTOR DE CONTRAOFERTAS (función pura)
   ------------------------------------------------------------
   ⚠️ SEGURIDAD — PROTOTIPO vs PRODUCCIÓN
   Este motor recibe las REGLAS PRIVADAS DEL VENDEDOR (floorPrice, autoAcceptPct),
   que viven separadas de los DATOS PÚBLICOS DEL PRODUCTO (ver splitProduct).
   En producción, evaluateOffer corre EXCLUSIVAMENTE en el servidor (Edge Function
   de Supabase): el navegador del comprador nunca recibe el precio piso ni el % de
   auto-aceptación; solo recibe el resultado (estado + monto sugerido si corresponde).
   ============================================================ */
function evaluateOffer(rules, listPrice, amount, { locked = false } = {}) {
  const autoThreshold = Math.ceil((listPrice * rules.autoAcceptPct) / 100);
  if (amount < rules.floorPrice) return { status: "RECHAZADA_AUTO", reason: "floor", suggestedAmount: rules.floorPrice };
  // Anti doble venta: si ya hay un acuerdo pendiente de cierre (stock 1), nunca se auto-acepta otra oferta.
  if (amount >= autoThreshold && !locked) return { status: "ACEPTADA_PENDIENTE_CIERRE", reason: "auto" };
  return { status: "PENDIENTE", reason: locked ? "en_espera" : "manual" };
}

/* Separa una publicación en { público, privado }. Lo privado nunca se pasa a componentes del comprador. */
const PRIVATE_KEYS = ["floorPrice", "autoAcceptPct"];
function splitProduct(full) {
  const pub = { stock: 1, ...full };
  const priv = {};
  PRIVATE_KEYS.forEach((k) => { priv[k] = pub[k]; delete pub[k]; });
  return { pub, priv };
}
function splitAll(list) {
  const rules = {};
  const products = list.map((full) => { const { pub, priv } = splitProduct(full); rules[pub.id] = priv; return pub; });
  return { products, rules };
}

function buildFaqs(p) {
  return [
    { q: "¿Sigue disponible?", a: "Sí. Si ves este link, está disponible. Cuando se vende, la página lo muestra al instante." },
    { q: "¿Permutás?", a: p.acceptsSwap ? "Sí, podés proponer una permuta en tu oferta." : "No. Solo venta." },
    {
      q: "¿Hacés envíos?",
      a: p.shipping.enabled ? `Sí, a cargo del comprador (${p.shipping.note}).` : `No. ${p.shipping.note || "Solo retiro."}`,
    },
    { q: "¿Dónde se retira?", a: p.pickupPoints.length ? p.pickupPoints.join(" · ") : "A coordinar después del pago." },
    { q: "¿Cuál es tu último precio?", a: "Hacé tu oferta formal con el botón. Si entra en lo que acepto, se aprueba al instante. Sin chat." },
  ];
}

/* --- Promos con fecha real, envío gratis y preguntas frecuentes (solo plan Tienda) --- */
function promoOf(store, now) {
  const pr = store?.store?.promo; // store = el vendedor (seller); los datos de la tienda viven en seller.store
  if (!store?.isStore || !pr?.active || !pr.endsAt || now >= pr.endsAt || !(pr.pct > 0)) return null;
  return pr;
}
function promoApplies(p, pr) {
  return !!pr && !p.liquidation && (pr.scope === "Todo" || !pr.scope || p.collection === pr.scope);
}
// Precio que paga el comprador ahora mismo (la promo se aplica sola y se termina sola)
function priceNow(p, store, now) {
  const pr = promoOf(store, now);
  if (!promoApplies(p, pr)) return p.listPrice;
  return Math.round((p.listPrice * (1 - pr.pct / 100)) / 100) * 100;
}
// Precio "antes" para tachar: el de lista si hay promo, o el compareAt del vendedor
function priceBefore(p, store, now) {
  const n = priceNow(p, store, now);
  const ref = n < p.listPrice ? p.listPrice : p.compareAt; // con promo se tacha el precio de lista (no se infla el descuento)
  return ref && ref > n ? ref : null;
}
const countdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p2 = (x) => String(x).padStart(2, "0");
  return (d ? `${d}d ` : "") + `${p2(h)}:${p2(m)}:${p2(r)}`;
};
function defaultStoreFaq(store) {
  const st = store?.store || {};
  return [
    ["¿Puedo cambiar el talle?", "Sí. Tenés 30 días para cambiarlo en el local, con la etiqueta puesta y el ticket o el número de pedido."],
    ["¿Cómo sé mi talle?", `Escribinos por WhatsApp con tu altura y cómo te queda otra prenda, y te ayudamos a elegir.`],
    ["¿Cuánto tarda el envío?", "En CABA, de 24 a 48 h hábiles. Al resto del país, de 3 a 6 días hábiles por correo."],
    ["¿Dónde y cuándo retiro?", `${st.address || "En el local"}${st.hours ? ` · ${st.hours}` : ""}. Mostrá tu número de pedido.`],
  ];
}
// Preguntas fijas sobre cómo funciona Haceme Precio (iguales para todos los vendedores; no se editan)
const PLATFORM_FAQ = {
  oferta: [
    ["¿Cómo funciona ofertar?", "Tocás «Hacer mi oferta», ponés cuánto querés pagar y listo. Tenés 2 intentos. Si el vendedor acepta, te avisamos y tenés 12 h para pagar."],
    ["¿Es seguro pagar?", "Si pagás con Mercado Pago dentro de la app, la compra se confirma solo cuando el pago está verificado. Si arreglás en persona, encontrate en un lugar público y revisá el producto antes de pagar."],
    ["¿Qué pasa si el vendedor no responde?", "Tu oferta vence sola a los 15 minutos y no pagás nada. Podés volver a ofertar si te queda un intento."],
    ["¿Necesito crear una cuenta?", "No. Todo funciona desde este link, sin descargar nada ni poner contraseña."],
  ],
  tienda: [
    ["¿Es seguro pagar?", "Si pagás con Mercado Pago, el pedido se confirma solo cuando el pago está verificado. Si pagás en el local, pagás al retirar y ves la prenda antes."],
    ["¿Qué pasa si reservo y no retiro?", `La reserva dura ${RESERVE_HOURS} h. Si no retirás, se cancela sola y no pagás nada.`],
    ["¿Me puedo arrepentir de la compra?", "Sí. Por ley tenés 10 días corridos desde que recibís el producto para arrepentirte. Escribile a la tienda por WhatsApp."],
    ["¿Necesito crear una cuenta?", "No. Comprás desde este link, sin descargar nada ni poner contraseña."],
  ],
};
function FaqList({ items, title, Icon = Info, dark = false }) {
  const [open, setOpen] = useState(-1);
  return (
    <section className={`mx-4 mt-4 rounded-2xl ring-1 ${dark ? "bg-zinc-50 ring-zinc-200" : "bg-white ring-zinc-200"}`}>
      <p className="flex items-center gap-2 px-4 pt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Icon size={14} /> {title}</p>
      <div className="mt-1 divide-y divide-zinc-100">
        {items.map(([q, a], i) => (
          <button key={q + i} onClick={() => setOpen(open === i ? -1 : i)} className="block w-full px-4 py-3 text-left">
            <span className="flex items-center justify-between gap-2 text-sm font-medium">{q}<ChevronDown size={16} className={`shrink-0 text-zinc-400 transition ${open === i ? "rotate-180" : ""}`} /></span>
            {open === i && <span className="mt-1.5 block text-sm leading-relaxed text-zinc-600">{a}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   SUB-AGENTE 3 · COPYWRITING ANTI-FRICCIÓN
   ============================================================ */
function buildFbCopy(p, tone, showPrice) {
  const url = `hacemeprecio.app/p/${p.slug}`;
  const emoji = p.category === "Tecnología" ? "📱" : p.category === "Hogar" ? "🛋️" : p.category === "Ropa" ? "👕" : "📦";
  const hl = p.highlights.slice(0, 4).map((h) => `✅ ${h}`).join("\n");
  const delivery = [
    p.shipping.enabled ? "🚚 Envíos a cargo del comprador" : "🚫 Sin envíos",
    p.pickupPoints.length ? `📍 Retiro: ${p.pickupPoints[0]}` : null,
  ].filter(Boolean).join("\n");
  const price = showPrice ? `💲 ${fmt(p.listPrice)} · acepto ofertas formales\n` : "💲 Acepto ofertas formales\n";
  const swap = p.acceptsSwap ? "🔁 Escucho permutas (por el link)" : "🔁 No permuto";

  if (tone === "amigable") {
    return `${emoji} ${p.title} — ${p.condition}
${price}
${hl}

${delivery}
${swap}

¡Hola! Para no tenerte esperando en el chat, armé una página con todas las fotos y respuestas. Si ves esta publicación, está disponible 🙌

👉 Hacé tu oferta en 10 segundos acá: ${url}

(Por mensaje no negocio, por el link te respondo al toque 😉)`;
  }
  if (tone === "urgente") {
    return `🔥 ${p.title.toUpperCase()} 🔥
${p.condition}
${price}
${hl}

⏳ Las ofertas formales tienen respuesta en menos de 15 minutos. La primera que se paga se lo lleva.

${delivery}
${swap}

👉 Ofertá ahora: ${url}

⚠️ No respondo "¿sigue disponible?" ni "¿último precio?". Todo está en el link.`;
  }
  return `${emoji} ${p.title} — ${p.condition}
${price}
⚠️ NO RESPONDO "¿SIGUE DISPONIBLE?". Si lo ves publicado, está disponible.

${hl}

${delivery}
${swap}

👉 Mirá más fotos, detalles y hacé tu oferta formal sin vueltas acá:
${url}

Ofertas por chat no se responden. Ofertas por el link, sí.`;
}

/* ============================================================
   DATOS SEMILLA
   ============================================================ */
function seed() {
  const t = Date.now();
  const products = [
    {
      id: "p1",
      sellerId: "s1",
      slug: "iphone-13-128gb",
      title: "iPhone 13 128 GB — Azul medianoche",
      category: "Tecnología",
      condition: "Usado - Como nuevo",
      listPrice: 650000,
      floorPrice: 560000,
      autoAcceptPct: 92,
      shipping: { enabled: true, note: "Andreani o Uber Flash" },
      pickupPoints: ["Palermo · Plaza Serrano", "Belgrano · Estación Belgrano C"],
      acceptsSwap: false,
      highlights: ["Batería al 88%", "Liberado de fábrica", "Caja y cable original", "Sin marcas: siempre con funda y vidrio"],
      description:
        "Lo vendo porque me pasé a Android por trabajo. Funciona perfecto: Face ID, cámaras y parlantes impecables. Se entrega reseteado, listo para usar. Factura de compra disponible.",
      photos: [
        { label: "Frente", sub: "Pantalla sin rayas" },
        { label: "Dorso", sub: "Vidrio trasero impecable" },
        { label: "Batería", sub: "Condición máxima 88%" },
        { label: "Caja", sub: "Caja + cable USB-C a Lightning" },
      ],
      views: 128,
      status: "activo",
      createdAt: t - 26 * 60 * MIN,
    },
    {
      id: "p2",
      sellerId: "s1",
      slug: "sillon-escandinavo-2-cuerpos",
      title: "Sillón escandinavo 2 cuerpos",
      category: "Hogar",
      condition: "Usado - Muy buen estado",
      listPrice: 280000,
      floorPrice: 215000,
      autoAcceptPct: 90,
      shipping: { enabled: false, note: "Solo retiro. Si necesitás flete, lo coordinás vos" },
      pickupPoints: ["Caballito · a 3 cuadras de Parque Rivadavia"],
      acceptsSwap: false,
      highlights: ["180 × 85 × 80 cm", "Tela antimanchas gris topo", "Patas de paraíso macizo", "Sin mascotas ni fumadores"],
      description:
        "Sillón de 2 años, muy cómodo y firme. Me mudo a un depto más chico y no entra. Se desarma el respaldo para pasar por puertas angostas.",
      photos: [
        { label: "Vista general", sub: "En living con luz natural" },
        { label: "Tela", sub: "Antimanchas, sin roturas" },
        { label: "Medidas", sub: "180 × 85 × 80 cm" },
        { label: "Patas", sub: "Madera maciza" },
      ],
      views: 64,
      status: "activo",
      createdAt: t - 50 * 60 * MIN,
    },
    {
      id: "p3",
      sellerId: "s3",
      slug: "bici-mtb-rodado-29",
      title: "Bici MTB rodado 29 — Talle M",
      category: "Deportes",
      condition: "Usado - Muy buen estado",
      listPrice: 420000,
      floorPrice: 340000,
      autoAcceptPct: 92,
      shipping: { enabled: false, note: "Solo retiro" },
      pickupPoints: ["Vicente López · Estación Florida"],
      acceptsSwap: true,
      highlights: ["Frenos hidráulicos", "Cambios 1×12", "Service hecho hace 1 mes"],
      description: "Bici de uso recreativo, nunca competí con ella. Se entrega con service completo.",
      photos: [
        { label: "Vista lateral", sub: "Cuadro de aluminio" },
        { label: "Transmisión", sub: "1×12 velocidades" },
        { label: "Frenos", sub: "Hidráulicos" },
      ],
      views: 31,
      status: "activo",
      createdAt: t - 9 * DAY,
    },
    {
      id: "p4",
      sellerId: "s1",
      slug: "campera-de-jean-oversize",
      title: "Campera de jean oversize",
      category: "Ropa",
      condition: "Nuevo - Sin uso",
      stock: 3,
      listPrice: 38000,
      floorPrice: 30000,
      autoAcceptPct: 95,
      shipping: { enabled: true, note: "Moto o correo" },
      pickupPoints: ["Palermo · Plaza Serrano"],
      acceptsSwap: false,
      highlights: ["Talles S, M y L", "Jean rígido lavado", "Nueva con etiqueta"],
      description: "Traje varias para revender. Mismo modelo, quedan 3. Si querés talle, avisá al ofertar.",
      photos: [
        { label: "Frente", sub: "Azul clásico" },
        { label: "Espalda", sub: "Corte oversize" },
      ],
      views: 54,
      status: "activo",
      createdAt: t - 3 * DAY,
    },
  ];
  // Tienda de ejemplo: AURA (precio fijo, talles y colores; un vestido en liquidación acepta ofertas)
  const V = (sizes, colors, stockFn) => colors.flatMap((c) => sizes.map((sz) => ({ id: `${c}-${sz}`, color: c, size: sz, stock: stockFn(c, sz) })));
  const auraBase = { sellerId: "s6", category: "Ropa", condition: "Nuevo - Sin uso", shipping: { enabled: true, note: "Moto en CABA o correo a todo el país" }, pickupPoints: ["Local Aura · Honduras 4800, Palermo"], acceptsSwap: false, status: "activo" };
  products.push(
    { ...auraBase, id: "a1", slug: "aura-remera-oversize", title: "Remera oversize algodón", collection: "Remeras", fixedPrice: true, listPrice: 18000,
      variants: V(["S", "M", "L"], ["Negro", "Blanco"], (c, sz) => (c === "Negro" && sz === "M" ? 0 : c === "Blanco" && sz === "L" ? 1 : 4)),
      highlights: ["100% algodón peinado", "Calce oversize", "Estampa aura"], description: "Nuestra remera de todos los días. Algodón grueso que no se deforma con los lavados.",
      photos: [], views: 212, createdAt: t - 12 * DAY },
    { ...auraBase, id: "a2", slug: "aura-jean-mom", title: "Jean mom fit tiro alto", collection: "Jeans", fixedPrice: true, listPrice: 42000, compareAt: 48000,
      variants: V(["36", "38", "40", "42"], ["Azul"], (c, sz) => (sz === "42" ? 0 : 3)),
      highlights: ["Rígido, no se estira", "Tiro alto", "Lavado clásico"], description: "El mom que combina con todo. Si dudás entre dos talles, escribinos por WhatsApp.",
      photos: [], views: 178, createdAt: t - 20 * DAY },
    { ...auraBase, id: "a3", slug: "aura-buzo-canguro", title: "Buzo canguro de frisa", collection: "Buzos", fixedPrice: true, listPrice: 36000,
      variants: V(["S", "M", "L"], ["Gris", "Rosa"], (c, sz) => (c === "Rosa" && sz === "S" ? 1 : 3)),
      highlights: ["Frisa invisible", "Bolsillo canguro", "Capucha con cordón"], description: "Abrigado y suave. Ideal para media estación.",
      photos: [], views: 96, createdAt: t - 6 * DAY },
    { ...auraBase, id: "a4", slug: "aura-vestido-lino-liquidacion", title: "Vestido de lino · última unidad", collection: "Liquidación", liquidation: true, listPrice: 45000, floorPrice: 32000, autoAcceptPct: 85, stock: 1,
      highlights: ["Lino natural", "Talle único (S/M)", "Fin de temporada"], description: "Última unidad de la temporada pasada. Hacé tu oferta: si entra en lo que aceptamos, es tuyo.",
      photos: [], views: 63, createdAt: t - 40 * DAY },
  );
  products.forEach((p) => {
    if (STORE_PHOTOS[p.id]) {
      const first = hasVariants(p) ? p.variants[0].color : Object.keys(STORE_PHOTOS[p.id])[0];
      p.photos = photosFor(p, first);
    }
  });
  // Ilustraciones conceptuales de ejemplo
  products.forEach((p) => {
    const ph = DEMO_PHOTOS[p.id];
    if (ph) p.photos = p.photos.map((x, k) => ({ ...x, src: ph[k] }));
  });
  const sellers = [
    { id: "s1", name: "Nico R.", email: "nico.ventas@gmail.com", phoneVerified: true, baseDeals: 37, status: "activa", periodEnd: t + 18 * DAY, joinedAt: t - 72 * DAY,
      payments: [{ at: t - 72 * DAY, amount: SUB_PRICE, via: "Mercado Pago" }, { at: t - 42 * DAY, amount: SUB_PRICE, via: "Mercado Pago" }, { at: t - 12 * DAY, amount: SUB_PRICE, via: "Mercado Pago" }] },
    { id: "s2", name: "Vale M.", email: "vale.deco@gmail.com", plan: "pro", status: "prueba", periodEnd: t + 5 * DAY, joinedAt: t - 2 * DAY, payments: [] },
    { id: "s3", name: "Juan P.", phoneVerified: false, baseDeals: 2, email: "juanp.bikes@gmail.com", status: "activa", periodEnd: t - 5 * DAY, joinedAt: t - 35 * DAY,
      payments: [{ at: t - 35 * DAY, amount: SUB_PRICE, via: "Mercado Pago" }] },
    { id: "s4", name: "Rami T.", email: "rami.tech@gmail.com", plan: "pase", status: "activa", periodEnd: t - 1 * DAY, joinedAt: t - 121 * DAY,
      payments: [{ at: t - 31 * DAY, amount: SUB_PRICE, via: "Mercado Pago" }] },
    { id: "s6", name: "Aura", email: "hola@aura.ar", plan: "tienda", isStore: true, phoneVerified: true, baseDeals: 0, status: "activa", periodEnd: t + 20 * DAY, joinedAt: t - 150 * DAY,
      store: { tagline: "Ropa de mujer · Palermo", address: "Honduras 4800, Palermo", hours: "Lun a Sáb de 11 a 20 h", whatsapp: "5491155550000", ...AURA_BRAND,
        promo: { active: true, pct: 15, scope: "Remeras", label: "Semana de remeras", endsAt: t + 2 * DAY + 7 * 60 * MIN },
        freeShipFrom: 60000 },
      payments: [{ at: t - 10 * DAY, amount: TIENDA_PRICE, via: "Mercado Pago" }] },
    { id: "s5", name: "Sofi K.", email: "sofi.k@hotmail.com", status: "suspendida", periodEnd: t + 10 * DAY, joinedAt: t - 60 * DAY,
      note: "Publicaciones falsas denunciadas", payments: [{ at: t - 20 * DAY, amount: SUB_PRICE, via: "Transferencia" }] },
  ];
  const offers = [
    {
      id: "o-seed-1",
      kind: "oferta",
      productId: "p1",
      buyerId: "b-martin",
      buyerName: "Martín G.",
      amount: 590000,
      status: "PENDIENTE",
      attempt: 1,
      createdAt: t - 3 * MIN,
      expiresAt: t + 12 * MIN,
      seenBySeller: false,
      seenByBuyer: true,
      log: [{ at: t - 3 * MIN, text: "Ofertó $590.000 (91% del precio de lista)" }],
    },
    {
      id: "o-seed-2",
      kind: "oferta",
      productId: "p2",
      buyerId: "b-caro",
      buyerName: "Caro P.",
      amount: 150000,
      status: "RECHAZADA_AUTO",
      attempt: 1,
      createdAt: t - 42 * MIN,
      expiresAt: null,
      seenBySeller: true,
      seenByBuyer: true,
      log: [
        { at: t - 42 * MIN, text: "Ofertó $150.000" },
        { at: t - 42 * MIN, text: "Rechazo automático: debajo del piso. Se le sugirió $215.000" },
      ],
    },
  ];
  const events = [
    { id: uid("e"), at: t - 3 * MIN, actor: "Comprador", text: "Martín G. ofertó $590.000 por iPhone 13 → queda PENDIENTE (entre piso y auto-aceptación)" },
    { id: uid("e"), at: t - 42 * MIN, actor: "Sistema", text: "Caro P. ofertó $150.000 por Sillón → RECHAZADA_AUTO. El vendedor no fue molestado" },
  ];
  // Reseñas de ejemplo (en producción: solo existen si hay una compra cerrada detrás)
  const R = (sellerId, productTitle, buyerName, stars, tags, text, daysAgo, reply) =>
    ({ id: uid("rv"), sellerId, productTitle, buyerName, stars, tags, text, at: t - daysAgo * DAY, verified: true, ...(reply ? { reply: { text: reply, at: t - daysAgo * DAY + 3 * 60 * MIN } } : {}) });
  const reviews = [
    R("s1", "Auriculares inalámbricos", "Flor M.", 5, ["Igual a las fotos", "Llegó puntual"], "Todo perfecto, nos encontramos en Plaza Serrano y estaba impecable.", 3),
    R("s1", "Monitor 24\"", "Gonza R.", 5, ["Respondió rápido", "Buena onda"], "Hice la oferta y en 5 minutos estaba aceptada. Así da gusto.", 8, "¡Gracias Gonza! Que lo disfrutes."),
    R("s1", "Silla de escritorio", "Caro D.", 4, ["Igual a las fotos"], "Muy bien, solo tardamos un poco en coordinar el horario.", 15),
    R("s1", "PlayStation 4", "Mati L.", 5, ["Llegó puntual", "Igual a las fotos", "Buena onda"], "Excelente vendedor, súper confiable.", 22),
    R("s1", "Lámpara de pie", "Sole P.", 5, ["Buena onda"], "", 30),
    R("s1", "Bici fija", "Tomi A.", 3, ["Respondió rápido"], "La bici tenía más uso de lo que parecía en las fotos, pero me hizo un descuento.", 41, "Tenés razón Tomi, por eso te bajé el precio en el momento. ¡Gracias por la buena onda!"),
    R("s1", "Mesa ratona", "Juli V.", 5, ["Igual a las fotos", "Llegó puntual"], "Recomendadísimo.", 55),
    R("s3", "Casco de bici", "Nacho F.", 3, [], "Llegó tarde al encuentro, pero el producto estaba bien.", 20),
  ];
  reviews.push(
    R("s6", "Jean mom fit tiro alto", "Meli S.", 5, ["Igual a las fotos", "Buen embalaje"], "Pedí por el link y lo retiré al otro día. Calce perfecto.", 4, "¡Gracias Meli! Te esperamos de nuevo 💛"),
    R("s6", "Remera oversize algodón", "Pau G.", 5, ["Respondió rápido"], "Les pregunté el talle por WhatsApp y me contestaron enseguida.", 9),
  );
  const orders = [
    { id: "PED-4821", storeId: "s6", buyerId: "b-romi", buyerName: "Romi T.", at: t - 40 * MIN, items: [{ productId: "a3", variantId: "Gris-M", qty: 1, price: 36000 }],
      total: 36000, delivery: "Retiro en el local", pay: "local", paid: false, status: "nuevo", reservedUntil: t + (RESERVE_HOURS * 60 - 40) * MIN, seenBySeller: false },
  ];
  return { products, offers, events, sellers, reviews, orders };
}

/* ============================================================
   UI PRIMITIVOS (Sub-Agente 2)
   ============================================================ */
function StatusPill({ status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Btn({ variant = "primary", className = "", children, ...rest }) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const v = {
    primary: "bg-hpred text-white hover:bg-hpred-dark shadow-sm",
    dark: "bg-zinc-900 text-white hover:bg-zinc-800",
    outline: "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
    ghost: "text-zinc-600 hover:bg-zinc-100",
    danger: "border border-zinc-200 bg-white text-rose-700 hover:bg-rose-50",
  }[variant];
  return (
    <button className={`${base} ${v} ${className}`} {...rest}>
      {children}
    </button>
  );
}

function ProductThumb({ product, size = "h-12 w-12", iconSize = 20 }) {
  const Icon = CATEGORY_ICON[product.category] || Box;
  const src = product.photos?.[0]?.src;
  if (src) return <img src={src} alt="" className={`${size} shrink-0 rounded-xl object-cover ring-1 ring-zinc-200`} />;
  return (
    <div className={`${size} shrink-0 rounded-xl bg-gradient-to-br ${PALETTES[0]} ring-1 ring-zinc-200 flex items-center justify-center text-zinc-500`}>
      <Icon size={iconSize} strokeWidth={1.5} />
    </div>
  );
}

function Sheet({ onClose, title, children }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-2xl hp-slide-up">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-200" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   APP (Agente Orquestador · estado global)
   ============================================================ */
export default function App() {
  const initial = useMemo(seed, []);
  const initialSplit = useMemo(() => splitAll(initial.products), [initial]);
  const [products, setProducts] = useState(initialSplit.products); // DATOS PÚBLICOS
  const [rules, setRules] = useState(initialSplit.rules); // REGLAS PRIVADAS DEL VENDEDOR (servidor en producción)
  const [reports, setReports] = useState([
    { id: "r-seed-1", productId: "p3", reason: "Precio irreal", detail: "", at: Date.now() - 5 * 60 * MIN, by: "anon-3f2a", status: "abierto" },
    { id: "r-seed-2", productId: "p3", reason: "Datos falsos", detail: "Las fotos parecen sacadas de una página de una bicicletería.", at: Date.now() - 2 * 60 * MIN, by: "anon-91bc", status: "abierto" },
  ]);
  const [offers, setOffers] = useState(initial.offers);
  const [events, setEvents] = useState(initial.events);
  const [sellers, setSellers] = useState(initial.sellers);
  const [reviews, setReviews] = useState(initial.reviews);
  const [logins, setLogins] = useState([
    { id: "l-seed-1", at: Date.now() - 2 * 60 * MIN, sellerId: "s1", ok: true, text: "Ingresó con código por email" },
    { id: "l-seed-2", at: Date.now() - 50 * MIN, sellerId: "s5", ok: false, text: "Login rechazado: cuenta suspendida" },
  ]);
  const [session, setSession] = useState({ sellerId: "s1", at: Date.now() });
  const [splash, setSplash] = useState(true);
  const [pushes, setPushes] = useState([]);
  const [orders, setOrders] = useState(initial.orders);
  const [cart, setCart] = useState([]); // [{productId, variantId, qty}]
  const [role, setRole] = useState("home");
  const [signupIntent, setSignupIntent] = useState(null); // plan elegido en la página de inicio
  const [tickets, setTickets] = useState([
    { id: "AYU-102", sellerId: "s3", topic: "Pagos", text: "No me deja pagar con la tarjeta, ¿hay otra forma?", at: Date.now() - 5 * 60 * MIN, status: "abierto" },
  ]);
  const [buyerProductId, setBuyerProductIdRaw] = useState("p1");
  const [buyerBack, setBuyerBack] = useState(null); // a dónde vuelve el botón «Volver» del comprador
  const setBuyerProductId = (id) => { setBuyerBack(null); setBuyerProductIdRaw(id); };
  const goBuyer = (id) => { setBuyerBack(buyerProductId); setBuyerProductIdRaw(id); };
  const [toasts, setToasts] = useState([]);
  const [installed, setInstalled] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [sellerTab, setSellerTab] = useState("inbox");
  const [focusProductId, setFocusProductId] = useState(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());

  const clock = () => Date.now() + offsetRef.current;

  /* --- reloj global para timers de expiración --- */
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now() + offsetRef.current), 1000);
    return () => clearInterval(i);
  }, []);

  const fastForward = (mins) => {
    offsetRef.current += mins * MIN;
    setOffset(offsetRef.current);
    setNow(Date.now() + offsetRef.current);
    addEvent("Sistema", `⏩ Reloj simulado adelantado ${mins >= 1440 ? mins / 1440 + " día(s)" : mins + " min"}`);
  };

  /* --- toasts & eventos --- */
  const toast = (type, title, msg) => {
    const id = uid("t");
    setToasts((p) => [...p.slice(-2), { id, type, title, msg }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4200);
  };
  /* --- notificaciones push (en producción: Web Push de la PWA + WhatsApp/email de respaldo) --- */
  const notify = ({ to, sellerId, title, body, go }) => {
    let channels = ["push"];
    if (to === "seller") {
      const sl = sellers.find((x) => x.id === sellerId);
      const pref = sl?.notif || { push: true, whatsapp: true, email: false };
      channels = Object.keys(pref).filter((k) => pref[k]);
      if (!channels.length) return;
      if (!pref.push) {
        addEvent("Sistema", `Aviso a ${sl?.name} por ${channels.join(" + ")}: ${title}`);
        return;
      }
    }
    const id = uid("n");
    const target = to === "seller" ? sellers.find((x) => x.id === sellerId)?.name : "Lucía";
    setPushes((p) => [...p.slice(-1), { id, to, title, body, go, target, channels }]);
    setTimeout(() => setPushes((p) => p.filter((n) => n.id !== id)), 7000);
  };
  const openPush = (n) => {
    setPushes((p) => p.filter((x) => x.id !== n.id));
    if (n.to === "seller") {
      if (n.go?.sellerId && session?.sellerId !== n.go.sellerId) return;
      setRole("seller");
      setSellerTab(n.go?.tab || "inbox");
    } else {
      setRole("buyer");
      if (n.go?.productId) setBuyerProductId(n.go.productId);
    }
    setSheet(null);
  };

  const addEvent = (actor, text) => setEvents((p) => [{ id: uid("e"), at: clock(), actor, text }, ...p].slice(0, 80));

  const productById = (id) => products.find((p) => p.id === id);
  const sellerById = (id) => sellers.find((x) => x.id === id);

  useEffect(() => {
    const tm = setTimeout(() => setSplash(false), 1300);
    return () => clearTimeout(tm);
  }, []);

  /* --- control de acceso: si la suscripción deja de permitir acceso, se cierra la sesión --- */
  useEffect(() => {
    if (!session) return;
    const acc = subAccess(sellerById(session.sellerId), now);
    if (!acc.allowed) {
      const sl = sellerById(session.sellerId);
      setSession(null);
      addLogin(session.sellerId, false, `Sesión cerrada automáticamente: ${SUB_STYLE[acc.key].label.toLowerCase()}`);
      toast("error", "Sesión cerrada", `${sl?.name}: la cuenta quedó ${SUB_STYLE[acc.key].label.toLowerCase()}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, sellers, session]);

  /* ================= SUSCRIPCIONES & LOGIN ================= */
  const addLogin = (sellerId, ok, text) =>
    setLogins((p) => [{ id: uid("l"), at: clock(), sellerId, ok, text }, ...p].slice(0, 60));
  const patchSeller = (id, fn) => setSellers((prev) => prev.map((x) => (x.id === id ? fn(x) : x)));

  const loginSeller = (sellerId, override) => {
    const sl = override || sellerById(sellerId);
    const acc = subAccess(sl, clock());
    if (!acc.allowed) {
      addLogin(sellerId, false, `Login rechazado: ${SUB_STYLE[acc.key].label.toLowerCase()}`);
      return acc;
    }
    setSession({ sellerId, at: clock() });
    patchSeller(sellerId, (x) => ({ ...x, lastLogin: clock() }));
    addLogin(sellerId, true, acc.key === "gracia" ? `Ingresó con aviso de pago vencido (${acc.daysLeft} día/s de gracia)` : "Ingresó con código por email");
    addEvent("Sistema", `Login OK de ${sl.name} (${SUB_STYLE[acc.key].label})`);
    setSellerTab("inbox");
    return acc;
  };
  const logout = () => {
    if (session) addLogin(session.sellerId, true, "Cerró sesión");
    setSession(null);
  };
  const registerSeller = (email, name, plan = "mensual") => {
    const t = clock();
    const base = { id: uid("s"), name: name || email.split("@")[0], email, plan, joinedAt: t };
    const sl = plan === "pase"
      ? { ...base, status: "activa", periodEnd: t + PASS_DAYS * DAY, payments: [{ at: t, amount: PASS_PRICE, via: "Mercado Pago · pago único" }] }
      : { ...base, status: "prueba", periodEnd: t + TRIAL_DAYS * DAY, payments: [], ...(plan === "tienda" ? { isStore: true, store: { ready: false } } : {}) };
    setSellers((p) => [...p, sl]);
    addEvent("Sistema", plan === "pase"
      ? `Nueva cuenta «${PLANS.pase.name}»: ${sl.email} pagó ${fmt(PASS_PRICE)} único → 1 publicación por ${PASS_DAYS} días`
      : `Nueva cuenta «${PLANS[plan].name}»: ${sl.email} · ${TRIAL_DAYS} días de prueba gratis`);
    return sl;
  };
  const upgradePlan = (sellerId, plan = "mensual") => {
    patchSeller(sellerId, (x) => ({ ...x, plan }));
    registerPayment(sellerId, `Mercado Pago · cambio a ${PLANS[plan].name}`, PLANS[plan].price);
    addEvent("Sistema", `${sellerById(sellerId)?.name} se pasó a «${PLANS[plan].name}» (${fmt(PLANS[plan].price)}/mes)`);
    toast("success", "¡Listo!", plan === "pro" ? "Ya podés usar la IA para publicar desde tus fotos." : "Ahora podés publicar todo lo que quieras.");
  };
  /* --- AUTOSERVICIO --- */
  const slugTaken = (slug, exceptId) => sellers.some((x) => x.id !== exceptId && sellerSlug(x) === slug);
  const setupStore = (sellerId, data) => {
    patchSeller(sellerId, (x) => ({ ...x, name: data.name, store: { ...x.store, ...data.store, ready: true } }));
    addEvent("Sistema", `Tienda creada sola: «${data.name}» → hacemeprecio.app/${data.store.slug}`);
    toast("success", "¡Tu tienda está lista!", "Ahora cargá tu primer producto.");
    setSellerTab("create");
  };
  const updateStore = (sellerId, store) => {
    patchSeller(sellerId, (x) => ({ ...x, store: { ...x.store, ...store } }));
    toast("success", "Datos guardados", "Ya se ven en tu tienda.");
  };
  const verifyPhone = (sellerId, phone) => {
    patchSeller(sellerId, (x) => ({ ...x, phone, phoneVerified: true }));
    addEvent("Sistema", `${sellerById(sellerId)?.name} verificó su teléfono solo (código por SMS)`);
    toast("success", "Teléfono verificado", "Tus compradores ya ven la marca de verificado.");
  };
  const cancelPlan = (sellerId) => {
    patchSeller(sellerId, (x) => ({ ...x, cancelAt: x.periodEnd }));
    addEvent("Sistema", `${sellerById(sellerId)?.name} canceló su plan · sigue activo hasta ${fmtDate(sellerById(sellerId)?.periodEnd)}`);
    toast("info", "Plan cancelado", "Lo seguís usando hasta el final del período pagado.");
  };
  const resumePlan = (sellerId) => {
    patchSeller(sellerId, (x) => ({ ...x, cancelAt: undefined }));
    toast("success", "¡Seguís con nosotros!", "Tu plan se renueva normalmente.");
  };
  const createTicket = (sellerId, topic, text) => {
    const tk = { id: "AYU-" + Math.floor(100 + Math.random() * 900), sellerId, topic, text, at: clock(), status: "abierto" };
    setTickets((p) => [tk, ...p]);
    addEvent("Vendedor", `${sellerById(sellerId)?.name} pidió ayuda (${topic}) desde la app`);
    return tk;
  };
  const answerTicket = (id, answer) => {
    const tk = tickets.find((x) => x.id === id);
    setTickets((p) => p.map((x) => (x.id === id ? { ...x, status: "respondido", answer, answeredAt: clock() } : x)));
    if (tk) notify({ to: "seller", sellerId: tk.sellerId, title: "💬 Te respondimos", body: answer.slice(0, 90), go: { tab: "account", sellerId: tk.sellerId } });
    toast("success", "Respuesta enviada", "Le llega como aviso en la app.");
  };
  const startSignup = (plan) => {
    setSignupIntent({ plan });
    setSession(null);
    setRole("seller");
    setSheet(null);
  };

  const upgradeToMonthly = (sellerId) => upgradePlan(sellerId, "mensual");
  const registerPayment = (sellerId, via, amountOverride) => {
    const t = clock();
    patchSeller(sellerId, (x) => ({
      ...x,
      status: "activa",
      periodEnd: Math.max(t, x.periodEnd) + 30 * DAY,
      payments: [...x.payments, { at: t, amount: amountOverride ?? planOf(x).price, via }],
    }));
    const sl = sellerById(sellerId);
    addEvent("Sistema", `Pago de suscripción ${fmt(amountOverride ?? planOf(sellerById(sellerId)).price)} de ${sl?.name} vía ${via} → +30 días`);
  };
  const setNotifPref = (id, key, val) =>
    patchSeller(id, (x) => ({ ...x, notif: { ...(x.notif || { push: true, whatsapp: true, email: false }), [key]: val } }));
  const adminExtend = (id, days) => {
    patchSeller(id, (x) => ({ ...x, periodEnd: Math.max(clock(), x.periodEnd) + days * DAY }));
    addEvent("Vendedor", `[Admin] Extendió ${days} días a ${sellerById(id)?.name}`);
    toast("success", "Plazo extendido", `+${days} días para ${sellerById(id)?.name}.`);
  };
  const adminSuspend = (id) => {
    patchSeller(id, (x) => ({ ...x, status: "suspendida", note: x.note || "Suspendida manualmente" }));
    addEvent("Vendedor", `[Admin] Suspendió a ${sellerById(id)?.name}: no puede entrar y sus links quedan pausados`);
    toast("info", "Cuenta suspendida", `${sellerById(id)?.name} ya no puede ingresar.`);
  };
  const adminReactivate = (id) => {
    patchSeller(id, (x) => ({ ...x, status: x.payments.length ? "activa" : "prueba", note: undefined }));
    addEvent("Vendedor", `[Admin] Reactivó a ${sellerById(id)?.name}`);
    toast("success", "Cuenta reactivada", `${sellerById(id)?.name} puede volver a ingresar si su plan está al día.`);
  };
  const adminKick = (id) => {
    if (session?.sellerId === id) setSession(null);
    addLogin(id, true, "Sesiones cerradas por el administrador");
    toast("info", "Sesiones cerradas", `${sellerById(id)?.name} tiene que volver a ingresar con código.`);
  };
  const adminImpersonate = (id) => {
    const acc = subAccess(sellerById(id), clock());
    if (!acc.allowed) return toast("error", "No se puede", "Esta cuenta no tiene acceso. Reactivala o registrale un pago primero.");
    setSession({ sellerId: id, at: clock() });
    addLogin(id, true, "El administrador abrió el panel en modo soporte");
    setRole("seller");
    setSellerTab("inbox");
  };

  /* --- reservas de pedidos "pago en el local": vencen solas y devuelven el stock --- */
  useEffect(() => {
    const due = orders.filter((o) => o.status === "nuevo" && !o.paid && o.reservedUntil && o.reservedUntil <= now);
    if (!due.length) return;
    due.forEach((o) => restoreStock(o));
    setOrders((prev) => prev.map((o) => (due.some((d) => d.id === o.id) ? { ...o, status: "vencido" } : o)));
    due.forEach((o) => addEvent("Sistema", `Pedido ${o.id} de ${o.buyerName}: venció la reserva sin retirar → stock devuelto`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  /* --- expiración automática --- */
  useEffect(() => {
    const due = offers.filter((o) => ACTIVE.includes(o.status) && o.expiresAt && o.expiresAt <= now);
    if (!due.length) return;
    const ids = new Set(due.map((o) => o.id));
    const why = {
      PENDIENTE: "El vendedor no respondió a tiempo",
      CONTRAOFERTA_VENDEDOR: "El comprador no respondió la contraoferta",
      ACEPTADA_PENDIENTE_CIERRE: "Venció la ventana de cierre sin pago ni coordinación · producto liberado",
    };
    setOffers((prev) =>
      prev.map((o) =>
        ids.has(o.id)
          ? {
              ...o,
              status: "EXPIRADA",
              expiresAt: null,
              seenBySeller: false,
              seenByBuyer: o.buyerId !== ME.id,
              log: [...o.log, { at: now, text: why[o.status] }],
            }
          : o
      )
    );
    due.forEach((o) => {
      const p = productById(o.productId);
      addEvent("Sistema", `${o.buyerName} · ${p?.title}: ${STATUS[o.status].label} → EXPIRADA (${why[o.status]})`);
    });
    toast("info", "Timer vencido", `${due.length} negociación(es) expiraron automáticamente.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  /* --- marcar como vistas al entrar a cada rol --- */
  useEffect(() => {
    const key = role === "seller" ? "seenBySeller" : "seenByBuyer";
    const has = offers.some((o) => !o[key] && (role === "seller" || o.buyerId === ME.id));
    if (!has) return;
    const tm = setTimeout(() => {
      setOffers((prev) => prev.map((o) => (role === "seller" || o.buyerId === ME.id ? { ...o, [key]: true } : o)));
    }, 3000);
    return () => clearTimeout(tm);
  }, [role, offers]);

  /* --- vistas del producto --- */
  useEffect(() => {
    if (role !== "buyer") return;
    setProducts((prev) => prev.map((p) => (p.id === buyerProductId ? { ...p, views: p.views + 1 } : p)));
  }, [role, buyerProductId]);

  const sellerUnseen = offers.filter((o) => !o.seenBySeller && session && productById(o.productId)?.sellerId === session.sellerId).length
    + orders.filter((o) => session && o.storeId === session.sellerId && o.status === "nuevo").length;
  const buyerUnseen = offers.filter((o) => o.buyerId === ME.id && !o.seenByBuyer).length;

  /* ================= ACCIONES DEL MOTOR ================= */
  const submitOffer = (productId, amount, buyer = ME) => {
    const pub = productById(productId);
    // ⚠️ En producción: esto corre en el servidor. El cliente solo envía { productId, amount }.
    const p = pub && { ...pub, ...rules[productId] };
    const locked = offers.some((o) => o.productId === productId && o.status === "ACEPTADA_PENDIENTE_CIERRE" && (pub.stock ?? 1) <= 1);
    const t = clock();
    if (pub?.fixedPrice) return { error: "Este producto tiene precio fijo." };
    if (pub?.moderation === "pausada") return { error: "Esta publicación está en revisión." };
    if (!p || p.status === "vendido") return { error: "Este producto ya se vendió." };
    const mine = offers.filter((o) => o.productId === productId && o.buyerId === buyer.id && o.kind === "oferta");
    if (mine.some((o) => ACTIVE.includes(o.status))) return { error: "Ya tenés una negociación activa para este producto." };
    if (mine.length >= MAX_ATTEMPTS)
      return { error: `Llegaste al límite de ${MAX_ATTEMPTS} ofertas para este producto. Podés comprarlo al precio de lista.` };
    if (!amount || amount <= 0) return { error: "Ingresá un monto válido." };
    if (amount >= p.listPrice) return { error: "Tu oferta iguala o supera el precio de lista: usá «Comprar ahora»." };

    const ev = evaluateOffer(rules[productId], p.listPrice, amount, { locked });
    const attempt = mine.length + 1;
    const log = [{ at: t, text: `Ofertó ${fmt(amount)} (${pct(amount, p.listPrice)}% del precio de lista)` }];
    let expiresAt = null;
    if (ev.status === "ACEPTADA_PENDIENTE_CIERRE") {
      log.push({ at: t, text: `Auto-aceptada (≥ ${p.autoAcceptPct}% del precio). Ventana de cierre: 12 h` });
      expiresAt = t + T_PAY;
    } else if (ev.status === "RECHAZADA_AUTO") {
      log.push({ at: t, text: `Rechazo automático: debajo del piso. Se sugirió ${fmt(ev.suggestedAmount)}` });
    } else {
      expiresAt = t + T_PENDING;
    }
    const offer = {
      id: uid("o"),
      kind: "oferta",
      productId,
      buyerId: buyer.id,
      buyerName: buyer.name,
      amount,
      finalAmount: ev.status === "ACEPTADA_PENDIENTE_CIERRE" ? amount : undefined,
      suggestedAmount: ev.suggestedAmount, // lo único del piso que ve el comprador, y solo tras un rechazo
      waiting: ev.reason === "en_espera",
      status: ev.status,
      attempt,
      createdAt: t,
      expiresAt,
      seenBySeller: false,
      seenByBuyer: true,
      log,
    };
    setOffers((prev) => [offer, ...prev]);
    const msg = {
      ACEPTADA_PENDIENTE_CIERRE: `${buyer.name} ofertó ${fmt(amount)} por ${p.title} → ACEPTADA_PENDIENTE_CIERRE automáticamente (≥ ${p.autoAcceptPct}%)`,
      RECHAZADA_AUTO: `${buyer.name} ofertó ${fmt(amount)} por ${p.title} → RECHAZADA_AUTO (piso oculto ${fmt(p.floorPrice)}). Vendedor no molestado`,
      PENDIENTE: `${buyer.name} ofertó ${fmt(amount)} por ${p.title} → PENDIENTE. Llega a la bandeja del vendedor`,
    }[ev.status];
    addEvent(ev.status === "PENDIENTE" ? "Comprador" : "Sistema", msg);
    if (ev.status === "PENDIENTE")
      notify({ to: "seller", sellerId: p.sellerId, title: `💰 Nueva oferta: ${fmt(amount)}`, body: `${buyer.name} por ${p.title} (${pct(amount, p.listPrice)}% de lista). Tenés 15 min para responder.`, go: { tab: "inbox", sellerId: p.sellerId } });
    if (ev.status === "ACEPTADA_PENDIENTE_CIERRE")
      notify({ to: "seller", sellerId: p.sellerId, title: `⚡ Oferta aceptada sola: ${fmt(amount)}`, body: `${buyer.name} por ${p.title}. Entró en tu rango de auto-aceptación; tiene 12 h para pagar o coordinar.`, go: { tab: "inbox", sellerId: p.sellerId } });
    return { offer, product: p };
  };

  const patchOffer = (id, fn) => setOffers((prev) => prev.map((o) => (o.id === id ? fn(o) : o)));

  /* Anti doble venta: ¿hay otro acuerdo pendiente de cierre para un producto de unidad única? */
  const dealLock = (productId, exceptId) => {
    const pr = productById(productId);
    if ((pr?.stock ?? 1) > 1) return null;
    return offers.find((x) => x.productId === productId && x.id !== exceptId && x.status === "ACEPTADA_PENDIENTE_CIERRE") || null;
  };

  const sellerAccept = (o) => {
    const lock = dealLock(o.productId, o.id);
    if (lock) return toast("error", "Bloqueado: posible doble venta", `Ya tenés un acuerdo pendiente con ${lock.buyerName}. Cerralo o liberalo primero.`);
    const t = clock();
    patchOffer(o.id, (x) => ({
      ...x, status: "ACEPTADA_PENDIENTE_CIERRE", finalAmount: x.amount, expiresAt: t + T_PAY, seenBySeller: true, seenByBuyer: x.buyerId !== ME.id,
      log: [...x.log, { at: t, text: `El vendedor aceptó ${fmt(x.amount)}. Ventana de cierre: 12 h` }],
    }));
    addEvent("Vendedor", `Aceptó la oferta de ${o.buyerName} por ${fmt(o.amount)}`);
    if (o.buyerId === ME.id) notify({ to: "buyer", title: "🎉 ¡Aceptaron tu oferta!", body: `${fmt(o.amount)} por ${productById(o.productId)?.title}. Tenés 12 h para pagar o coordinar el cierre.`, go: { productId: o.productId } });
    toast("success", "Oferta aceptada", `${o.buyerName} tiene 12 h para pagar o coordinar.`);
  };
  const sellerReject = (o) => {
    const t = clock();
    patchOffer(o.id, (x) => ({
      ...x, status: "RECHAZADA", expiresAt: null, seenBySeller: true, seenByBuyer: x.buyerId !== ME.id,
      log: [...x.log, { at: t, text: "El vendedor rechazó la oferta" }],
    }));
    addEvent("Vendedor", `Rechazó la oferta de ${o.buyerName} (${fmt(o.amount)})`);
    if (o.buyerId === ME.id) notify({ to: "buyer", title: "Tu oferta no fue aceptada", body: `${productById(o.productId)?.title}. Mirá si te queda otro intento.`, go: { productId: o.productId } });
    toast("info", "Oferta rechazada", `Le avisamos a ${o.buyerName}.`);
  };
  const sellerCounter = (o, amount) => {
    const p = productById(o.productId);
    if (!(amount > o.amount)) return toast("error", "Monto inválido", "La contraoferta tiene que superar la oferta recibida.");
    if (amount > p.listPrice) return toast("error", "Monto inválido", "No puede superar el precio de lista.");
    const t = clock();
    patchOffer(o.id, (x) => ({
      ...x, status: "CONTRAOFERTA_VENDEDOR", counterAmount: amount, expiresAt: t + T_COUNTER, seenBySeller: true,
      seenByBuyer: x.buyerId !== ME.id, log: [...x.log, { at: t, text: `El vendedor contraofertó ${fmt(amount)} (10 min para responder)` }],
    }));
    addEvent("Vendedor", `Contraofertó ${fmt(amount)} a ${o.buyerName} (había ofrecido ${fmt(o.amount)})`);
    if (o.buyerId === ME.id) notify({ to: "buyer", title: `🤝 Te contraofertaron: ${fmt(amount)}`, body: `${p.title}. Tenés 10 min para aceptar.`, go: { productId: o.productId } });
    toast("success", "Contraoferta enviada", `${o.buyerName} tiene 10 min para responder.`);
  };
  const buyerAcceptCounter = (o) => {
    if (dealLock(o.productId, o.id)) return toast("error", "No disponible", "Otro comprador ya cerró un acuerdo. Si se cae, te avisamos.");
    const t = clock();
    patchOffer(o.id, (x) => ({
      ...x, status: "ACEPTADA_PENDIENTE_CIERRE", finalAmount: x.counterAmount, expiresAt: t + T_PAY, seenBySeller: false, seenByBuyer: true,
      log: [...x.log, { at: t, text: `El comprador aceptó la contraoferta de ${fmt(x.counterAmount)}` }],
    }));
    addEvent("Comprador", `${o.buyerName} aceptó la contraoferta de ${fmt(o.counterAmount)}`);
    toast("success", "¡Trato cerrado!", "Tenés 12 h para pagar o coordinar el cierre.");
  };
  const buyerRejectCounter = (o) => {
    const t = clock();
    patchOffer(o.id, (x) => ({
      ...x, status: "RECHAZADA", expiresAt: null, seenBySeller: false, seenByBuyer: true,
      log: [...x.log, { at: t, text: "El comprador rechazó la contraoferta" }],
    }));
    addEvent("Comprador", `${o.buyerName} rechazó la contraoferta de ${fmt(o.counterAmount)}`);
    toast("info", "Contraoferta rechazada", "Podés volver a ofertar si te quedan intentos.");
  };

  /* CERRADA_PAGADA solo por confirmación VERIFICADA de la pasarela (en producción: webhook de Mercado Pago
     validado en el servidor). Nunca por acción manual ni por subir una captura de pantalla. */
  const pay = ({ productId, offerId, amount, delivery, method = "Mercado Pago", buyer = ME, gatewayVerified }) => {
    if (gatewayVerified !== true) {
      toast("error", "Pago no verificado", "Una venta solo se marca pagada con confirmación de la pasarela.");
      return null;
    }
    const t = clock();
    const p = productById(productId);
    const soldOut = (productById(productId)?.stock ?? 1) <= 1; // con stock > 1 solo se descuenta una unidad
    const code = "HP-" + Math.floor(1000 + Math.random() * 9000);
    setOffers((prev) => {
      let next = prev.map((o) => {
        if (o.id === offerId)
          return {
            ...o, status: "CERRADA_PAGADA", finalAmount: amount, delivery, method, code, expiresAt: null, paidAt: t,
            seenBySeller: false, seenByBuyer: true,
            log: [...o.log, { at: t, text: `Pagó ${fmt(amount)} vía ${method}. Entrega: ${delivery}` }],
          };
        if (soldOut && o.productId === productId && ACTIVE.includes(o.status))
          return { ...o, status: "EXPIRADA", expiresAt: null, seenByBuyer: o.buyerId !== ME.id, log: [...o.log, { at: t, text: "El producto se vendió a otro comprador" }] };
        return o;
      });
      if (!offerId) {
        next = [
          {
            id: uid("o"), kind: "directa", productId, buyerId: buyer.id, buyerName: buyer.name, amount, finalAmount: amount,
            status: "CERRADA_PAGADA", attempt: 0, createdAt: t, paidAt: t, expiresAt: null, delivery, method, code,
            seenBySeller: false, seenByBuyer: true, log: [{ at: t, text: `Compra directa a precio de lista: ${fmt(amount)} vía ${method}` }],
          },
          ...next,
        ];
      }
      return next;
    });
    setProducts((prev) => prev.map((x) => (x.id === productId ? { ...x, stock: Math.max(0, (x.stock ?? 1) - 1), status: soldOut ? "vendido" : x.status } : x)));
    if (buyer.id === ME.id) setTimeout(() => notify({ to: "buyer", title: `¿Cómo te fue con ${sellerById(p.sellerId)?.name.split(" ")[0]}?`, body: "Cuando tengas el producto, calificalo. Ayuda a otros compradores.", go: { productId } }), 7500);
    notify({ to: "seller", sellerId: p.sellerId, title: `✅ ¡Te pagaron ${fmt(amount)}!`, body: `${buyer.name} compró ${p.title}. Entrega: ${delivery}.`, go: { tab: "inbox", sellerId: p.sellerId } });
    addEvent(buyer.id === ME.id ? "Comprador" : "Sistema", `${buyer.name} pagó ${fmt(amount)} por ${p.title} → CERRADA_PAGADA. ${soldOut ? "Publicación marcada como VENDIDA" : `Queda(n) ${(productById(productId)?.stock ?? 1) - 1} unidad(es)`}`);
    return code;
  };

  /* --- Cierre fuera de la app (efectivo / transferencia directa): NUNCA marca CERRADA_PAGADA --- */
  const buyerChooseExternal = ({ productId, offerId, amount, delivery }) => {
    const t = clock();
    const p = productById(productId);
    if (offerId) {
      patchOffer(offerId, (x) => ({ ...x, closeMode: "externo", delivery, seenBySeller: false,
        log: [...x.log, { at: t, text: `El comprador eligió pagar fuera de la app (en persona / transferencia). Entrega: ${delivery}` }] }));
    } else {
      if (dealLock(productId)) return { error: "Este producto ya tiene un acuerdo pendiente." };
      setOffers((prev) => [{
        id: uid("o"), kind: "directa", productId, buyerId: ME.id, buyerName: ME.name, amount, finalAmount: amount,
        status: "ACEPTADA_PENDIENTE_CIERRE", closeMode: "externo", delivery, attempt: 0, createdAt: t, expiresAt: t + T_CLOSE,
        seenBySeller: false, seenByBuyer: true,
        log: [{ at: t, text: `Quiere comprar a precio de lista (${fmt(amount)}) pagando fuera de la app. Entrega: ${delivery}` }],
      }, ...prev]);
    }
    addEvent("Comprador", `${ME.name} va a pagar fuera de la app por ${p.title} → queda ACEPTADA_PENDIENTE_CIERRE (12 h)`);
    notify({ to: "seller", sellerId: p.sellerId, title: `🤝 Coordiná la entrega: ${fmt(amount)}`, body: `${ME.name} quiere pagar en persona o por transferencia por ${p.title}. Verificá el dinero antes de entregar.`, go: { tab: "inbox", sellerId: p.sellerId } });
    return { ok: true };
  };
  /* --- Reputación: solo califica quien cerró una compra; 1 reseña por compra; el vendedor responde pero no borra --- */
  const leaveReview = (offerId, stars, tags, text) => {
    const o = offers.find((x) => x.id === offerId);
    if (!o || o.buyerId !== ME.id || !CLOSED.includes(o.status)) return { error: "Solo podés calificar una compra cerrada." };
    if (reviews.some((r) => r.offerId === offerId)) return { error: "Ya calificaste esta compra." };
    if (!(stars >= 1 && stars <= 5)) return { error: "Elegí de 1 a 5 estrellas." };
    const pr = productById(o.productId);
    setReviews((prev) => [{ id: uid("rv"), sellerId: pr.sellerId, offerId, productTitle: pr.title, buyerName: o.buyerName.replace(" (vos)", ""), stars, tags, text, at: clock(), verified: true }, ...prev]);
    addEvent("Comprador", `${o.buyerName} calificó a ${sellerById(pr.sellerId)?.name} con ${stars}★ por ${pr.title}`);
    notify({ to: "seller", sellerId: pr.sellerId, title: `${"⭐".repeat(stars)} Nueva reseña`, body: `${o.buyerName.replace(" (vos)", "")} calificó tu venta de ${pr.title}. Podés responderle.`, go: { tab: "account", sellerId: pr.sellerId } });
    return { ok: true };
  };
  const replyReview = (reviewId, text) => {
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, reply: { text, at: clock() } } : r)));
    toast("success", "Respuesta publicada", "Todos la van a ver debajo de la reseña.");
  };
  const adminToggleReview = (reviewId) => {
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, hidden: !r.hidden } : r)));
    addEvent("Sistema", "[Admin] Cambió la visibilidad de una reseña");
  };

  const sellerCloseExternal = (o) => {
    const t = clock();
    patchOffer(o.id, (x) => ({ ...x, status: "ACUERDO_CERRADO_EXTERNO", expiresAt: null, closedAt: t, seenBySeller: true, seenByBuyer: x.buyerId !== ME.id,
      log: [...x.log, { at: t, text: "El vendedor cerró la venta fuera de la app y declaró haber verificado el dinero acreditado" }] }));
    const soldOut = (productById(o.productId)?.stock ?? 1) <= 1;
    setOffers((prev) => prev.map((x) => (soldOut && x.productId === o.productId && x.id !== o.id && ACTIVE.includes(x.status)
      ? { ...x, status: "EXPIRADA", expiresAt: null, log: [...x.log, { at: t, text: "El producto se vendió a otro comprador" }] } : x)));
    setProducts((prev) => prev.map((x) => (x.id === o.productId ? { ...x, stock: Math.max(0, (x.stock ?? 1) - 1), status: soldOut ? "vendido" : x.status } : x)));
    addEvent("Vendedor", `Cerró fuera de la app con ${o.buyerName} por ${fmt(o.finalAmount ?? o.amount)} → ACUERDO_CERRADO_EXTERNO (sin verificación de pasarela)`);
    toast("success", "Venta cerrada", "Quedó registrada como acuerdo externo.");
  };
  const sellerCancelDeal = (o) => {
    const t = clock();
    patchOffer(o.id, (x) => ({ ...x, status: "EXPIRADA", expiresAt: null, seenBySeller: true, seenByBuyer: x.buyerId !== ME.id,
      log: [...x.log, { at: t, text: "El vendedor liberó el acuerdo: el producto vuelve a estar disponible" }] }));
    addEvent("Vendedor", `Liberó el acuerdo pendiente con ${o.buyerName} → EXPIRADA. Producto libre`);
    if (o.buyerId === ME.id) notify({ to: "buyer", title: "El vendedor canceló el acuerdo", body: `${productById(o.productId)?.title} volvió a estar disponible.`, go: { productId: o.productId } });
    toast("info", "Acuerdo liberado", "El producto vuelve a estar disponible.");
  };

  /* --- Reportes de publicaciones sospechosas --- */
  const reportProduct = (productId, reason, detail) => {
    if (reports.some((r) => r.productId === productId && r.by === ME.id)) return { error: "Ya reportaste esta publicación. La estamos revisando." };
    const p = productById(productId);
    setReports((prev) => [{ id: uid("r"), productId, reason, detail, at: clock(), by: ME.id, status: "abierto" }, ...prev]);
    addEvent("Sistema", `⚠️ Reporte: «${p.title}» de ${sellerById(p.sellerId)?.name} · motivo: ${reason}`);
    return { ok: true };
  };

  /* ================= MODO TIENDA: carrito y pedidos ================= */
  const restoreStock = (o) =>
    setProducts((prev) => prev.map((p) => {
      const its = o.items.filter((i) => i.productId === p.id);
      if (!its.length) return p;
      if (hasVariants(p)) return { ...p, variants: p.variants.map((v) => ({ ...v, stock: v.stock + its.filter((i) => i.variantId === v.id).reduce((s, i) => s + i.qty, 0) })), status: "activo" };
      return { ...p, stock: (p.stock ?? 0) + its.reduce((s, i) => s + i.qty, 0), status: "activo" };
    }));
  const stockOf = (productId, variantId) => {
    const p = productById(productId);
    if (!p) return 0;
    return hasVariants(p) ? p.variants.find((v) => v.id === variantId)?.stock ?? 0 : p.stock ?? 1;
  };
  const addToCart = (productId, variantId, qty = 1) => {
    const inCart = cart.find((c) => c.productId === productId && c.variantId === variantId)?.qty || 0;
    if (inCart + qty > stockOf(productId, variantId)) return toast("error", "No hay más stock", "Ya agregaste todas las unidades disponibles de ese talle.");
    setCart((prev) => {
      const ex = prev.find((c) => c.productId === productId && c.variantId === variantId);
      return ex ? prev.map((c) => (c === ex ? { ...c, qty: c.qty + qty } : c)) : [...prev, { productId, variantId, qty }];
    });
    toast("success", "Agregado al carrito", productById(productId)?.title);
  };
  const setCartQty = (productId, variantId, qty) =>
    setCart((prev) => prev.flatMap((c) => (c.productId === productId && c.variantId === variantId ? (qty <= 0 ? [] : [{ ...c, qty: Math.min(qty, stockOf(productId, variantId)) }]) : [c])));
  const placeOrder = ({ storeId, delivery: deliveryIn, pay }) => {
    let delivery = deliveryIn;
    const items = cart.filter((c) => productById(c.productId)?.sellerId === storeId);
    if (!items.length) return { error: "El carrito está vacío." };
    for (const c of items) if (c.qty > stockOf(c.productId, c.variantId)) return { error: `Ya no queda stock de ${productById(c.productId)?.title}.` };
    const t = clock();
    const storeS = sellerById(storeId);
    const lines = items.map((c) => { const p = productById(c.productId); const price = priceNow(p, storeS, t); return { ...c, price, ...(price < p.listPrice ? { listPrice: p.listPrice } : {}) }; });
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const freeShip = !!storeS?.store?.freeShipFrom && /Envío/.test(delivery) && total >= storeS.store.freeShipFrom;
    if (freeShip) delivery = delivery.replace("(se coordina con la tienda)", "· GRATIS");
    const order = {
      id: "PED-" + Math.floor(1000 + Math.random() * 9000), storeId, buyerId: ME.id, buyerName: ME.name, at: t, items: lines, total, delivery,
      pay, paid: pay === "mp", status: "nuevo", reservedUntil: pay === "mp" ? null : t + RESERVE_HOURS * 60 * MIN, seenBySeller: false,
    };
    // descuenta stock al confirmar (reserva): nadie más puede comprar esas unidades
    setProducts((prev) => prev.map((p) => {
      const its = lines.filter((l) => l.productId === p.id);
      if (!its.length) return p;
      if (hasVariants(p)) {
        const variants = p.variants.map((v) => ({ ...v, stock: v.stock - its.filter((l) => l.variantId === v.id).reduce((s, l) => s + l.qty, 0) }));
        return { ...p, variants, status: variants.some((v) => v.stock > 0) ? p.status : "vendido" };
      }
      const st = (p.stock ?? 1) - its.reduce((s, l) => s + l.qty, 0);
      return { ...p, stock: st, status: st > 0 ? p.status : "vendido" };
    }));
    setOrders((prev) => [order, ...prev]);
    setCart((prev) => prev.filter((c) => !items.includes(c)));
    const store = sellerById(storeId);
    addEvent("Comprador", `${ME.name} hizo el pedido ${order.id} en ${store?.name} por ${fmt(total)} · ${pay === "mp" ? "pagado (Mercado Pago verificado)" : `paga en el local · reserva ${RESERVE_HOURS} h`}`);
    notify({ to: "seller", sellerId: storeId, title: `🛍️ Nuevo pedido ${fmt(total)}`, body: `${ME.name} · ${lines.reduce((s, l) => s + l.qty, 0)} prenda(s) · ${delivery}${pay === "mp" ? " · ya pagó" : " · paga al retirar"}`, go: { tab: "inbox", sellerId: storeId } });
    return { order };
  };
  const setOrderStatus = (orderId, status) => {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    if (status === "cancelado") restoreStock(o);
    setOrders((prev) => prev.map((x) => (x.id === orderId ? { ...x, status, ...(status === "entregado" && !x.paid ? { paid: true, paidExternal: true } : {}), seenBySeller: true } : x)));
    addEvent("Vendedor", `Pedido ${orderId} → ${status.toUpperCase()}`);
    if (o.buyerId === ME.id) {
      const msg = { preparado: ["✅ Tu pedido está listo", o.delivery.startsWith("Retiro") ? "Ya podés pasar a retirarlo." : "Sale hoy para tu casa."], entregado: ["🎉 Pedido entregado", "¡Gracias por tu compra!"], cancelado: ["Pedido cancelado", "La tienda canceló tu pedido."] }[status];
      if (msg) notify({ to: "buyer", title: msg[0], body: `${o.id} · ${msg[1]}`, go: {} });
    }
    toast("success", "Pedido actualizado", `${orderId}: ${status}`);
  };

  /* --- Moderación (admin) --- */
  const adminPauseProduct = (productId) => {
    setProducts((prev) => prev.map((x) => (x.id === productId ? { ...x, moderation: "pausada" } : x)));
    setReports((prev) => prev.map((r) => (r.productId === productId && r.status === "abierto" ? { ...r, status: "resuelto" } : r)));
    const pr = productById(productId);
    addEvent("Sistema", `[Admin] Pausó «${pr?.title}» por reportes. Ya no se puede ofertar ni ver.`);
    notify({ to: "seller", sellerId: pr?.sellerId, title: "⚠️ Pausamos una publicación", body: `«${pr?.title}» recibió reportes y está en revisión. Escribinos si es un error.`, go: { tab: "products", sellerId: pr?.sellerId } });
    toast("info", "Publicación pausada", "Los compradores ven «en revisión».");
  };
  const adminRestoreProduct = (productId) => {
    setProducts((prev) => prev.map((x) => (x.id === productId ? { ...x, moderation: undefined } : x)));
    addEvent("Sistema", `[Admin] Reactivó «${productById(productId)?.title}»`);
    toast("success", "Publicación reactivada", "Vuelve a estar visible.");
  };
  const adminDismissReports = (productId) => {
    setReports((prev) => prev.map((r) => (r.productId === productId && r.status === "abierto" ? { ...r, status: "descartado" } : r)));
    addEvent("Sistema", `[Admin] Descartó los reportes de «${productById(productId)?.title}»: sin problemas`);
    toast("success", "Reportes descartados", "La publicación sigue activa.");
  };

  const updateProduct = (id, patch) => {
    const priv = {};
    const pubPatch = { ...patch };
    PRIVATE_KEYS.forEach((k) => { if (k in pubPatch) { priv[k] = pubPatch[k]; delete pubPatch[k]; } });
    if (Object.keys(priv).length) setRules((r) => ({ ...r, [id]: { ...r[id], ...priv } }));
    if (Object.keys(pubPatch).length) setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...pubPatch } : p)));
  };

  const createProduct = (data) => {
    const me = sellerById(session?.sellerId);
    if (me?.plan === "pase" && products.some((x) => x.sellerId === me.id && x.status !== "vendido")) {
      toast("error", "Tu plan permite 1 publicación", `Pasate a «${PLANS.mensual.name}» para publicar más cosas.`);
      return null;
    }
    let slug = slugify(data.title);
    if (products.some((p) => p.slug === slug)) slug += "-" + Math.random().toString(36).slice(2, 5);
    const p = { ...data, sellerId: session?.sellerId || "s1", id: uid("p"), slug, views: 0, status: "activo", createdAt: clock() };
    const { pub, priv } = splitProduct(p);
    setProducts((prev) => [pub, ...prev]);
    setRules((r) => ({ ...r, [pub.id]: priv }));
    addEvent("Vendedor", `Publicó «${p.title}» a ${fmt(p.listPrice)} (piso ${fmt(p.floorPrice)}, auto-acepta ≥ ${p.autoAcceptPct}%)`);
    toast("success", "¡Publicado!", "Copiá el texto y pegalo en Facebook Marketplace.");
    setFocusProductId(p.id);
    setSellerTab("products");
    return p;
  };

  const resetDemo = () => {
    const s = seed();
    offsetRef.current = 0;
    setOffset(0);
    setNow(Date.now());
    const sp = splitAll(s.products);
    setProducts(sp.products);
    setRules(sp.rules);
    setReports([]);
    setReviews(s.reviews);
    setOrders(s.orders);
    setSignupIntent(null);
    setRole("home");
    setCart([]);
    setOffers(s.offers);
    setEvents(s.events);
    setSellers(s.sellers);
    setSession({ sellerId: "s1", at: Date.now() });
    setSheet(null);
    setBuyerProductId("p1");
    setSellerTab("inbox");
    setBannerOpen(true);
    setInstalled(false);
    toast("info", "Demo reiniciada", "Datos de ejemplo restaurados.");
  };

  const openStorefront = (sellerId) => {
    setBuyerProductId("v:" + sellerId);
    setRole("buyer");
    setSheet(null);
  };
  const openAsBuyer = (productId) => {
    setBuyerProductId(productId);
    setRole("buyer");
    setSheet(null);
  };

  const actions = {
    submitOffer, sellerAccept, sellerReject, sellerCounter, buyerAcceptCounter, buyerRejectCounter, pay,
    updateProduct, createProduct, openAsBuyer, openStorefront, toast, setSheet,
    loginSeller, logout, registerSeller, upgradeToMonthly, upgradePlan,
    slugTaken, setupStore, updateStore, verifyPhone, cancelPlan, resumePlan, createTicket, answerTicket, startSignup, setNotifPref, notify,
    leaveReview, replyReview, adminToggleReview,
    adminPauseProduct, adminRestoreProduct, adminDismissReports,
    addToCart, setCartQty, placeOrder, setOrderStatus,
    buyerChooseExternal, sellerCloseExternal, sellerCancelDeal, reportProduct, dealLock, registerPayment, adminExtend, adminSuspend, adminReactivate, adminKick, adminImpersonate,
  };
  const sessionSeller = session ? sellerById(session.sellerId) : null;
  /* Señales de confianza públicas del vendedor (nunca datos privados) */
  const reputationFor = (sellerId) => repOf(reviews, sellerId);
  const trustFor = (sellerId) => {
    const sl = sellerById(sellerId);
    if (!sl) return null;
    const ids = new Set(products.filter((p) => p.sellerId === sellerId).map((p) => p.id));
    const closed = (sl.baseDeals || 0) + offers.filter((o) => ids.has(o.productId) && CLOSED.includes(o.status)).length
      + orders.filter((o) => o.storeId === sellerId && o.status === "entregado").length;
    return { rep: reputationFor(sellerId), emailVerified: true, phoneVerified: !!sl.phoneVerified, closed, months: Math.max(0, Math.floor((now - sl.joinedAt) / (30 * DAY))), days: Math.floor((now - sl.joinedAt) / DAY) };
  };
  // El panel del vendedor (autenticado) sí recibe sus reglas privadas.
  const myProducts = sessionSeller ? products.filter((p) => p.sellerId === sessionSeller.id).map((p) => ({ ...p, ...rules[p.id] })) : [];
  const myProductIds = new Set(myProducts.map((p) => p.id));
  const myOffers = offers.filter((o) => myProductIds.has(o.productId));

  const storefrontId = buyerProductId.startsWith("v:") ? buyerProductId.slice(2) : null;
  const buyerProduct = productById(buyerProductId) || products[0];

  return (
    <div className="min-h-screen bg-zinc-100 font-sans text-ink antialiased">
      <style>{`
        @keyframes hpUp { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes hpIn { from { transform: translateY(-8px); opacity: 0 } to { transform: none; opacity: 1 } }
        .hp-slide-up { animation: hpUp .22s ease-out }
        .hp-toast { animation: hpIn .2s ease-out }
        .hp-scroll::-webkit-scrollbar { width: 0; height: 0 }
        input[type=range] { accent-color: #C8102E }
        @keyframes hpPop { 0% { transform: scale(.85) rotate(-6deg); opacity: 0 } 60% { transform: scale(1.04) rotate(2deg); opacity: 1 } 100% { transform: none } }
        .hp-pop { animation: hpPop .6s ease-out both }
      `}</style>

      {/* ============ BARRA DE CONTROL SUPERIOR ============ */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950 text-zinc-100">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 overflow-x-auto px-3 py-2.5 hp-scroll sm:gap-3 sm:px-5">
          <div className="flex shrink-0 items-center gap-2 pr-1">
            <img src={LOGO_HORIZDARK} alt="Haceme Precio" className="hidden h-7 w-auto sm:block" />
            <img src={LOGO_PERFIL} alt="Haceme Precio" className="h-7 w-7 sm:hidden" />
            <span className="hidden rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 md:inline">MVP demo</span>
          </div>

          <div className="flex shrink-0 rounded-xl bg-zinc-800/80 p-1">
            {[
              { k: "home", label: "Inicio", Icon: Globe, badge: 0 },
              { k: "buyer", label: "Comprador", Icon: User, badge: buyerUnseen },
              { k: "seller", label: "Vendedor", Icon: Store, badge: sellerUnseen },
              { k: "admin", label: "Admin", Icon: Shield, badge: sellers.filter((x) => ["gracia", "vencida"].includes(subAccess(x, now).key)).length + tickets.filter((t) => t.status === "abierto").length },
            ].map(({ k, label, Icon, badge }) => (
              <button
                key={k}
                onClick={() => { setRole(k); setSheet(null); }}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  role === k ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"
                }`}
              >
                <Icon size={14} /> {label}
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-hpred px-1 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {role === "buyer" && (
            <label className="flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-300">
              <Link2 size={13} />
              <span className="hidden lg:inline">Link abierto:</span>
              <select
                value={storefrontId ? buyerProductId : buyerProduct?.id}
                onChange={(e) => setBuyerProductId(e.target.value)}
                className="max-w-[170px] bg-transparent font-mono text-xs text-white outline-none"
              >
                {sellers.filter((x) => products.some((p) => p.sellerId === x.id) || (x.isStore && x.store?.ready)).map((x) => (
                  <option key={"v" + x.id} value={"v:" + x.id} className="text-zinc-900">/v/{sellerSlug(x)} · vidriera de {x.name}</option>
                ))}
                {products.map((p) => (
                  <option key={p.id} value={p.id} className="text-zinc-900">/p/{p.slug} · {sellerById(p.sellerId)?.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1 font-mono text-[11px] text-zinc-400 md:flex">
              <Clock size={12} /> {clockTime(now)}
              {offset > 0 && <span className="text-kraft">(+{offset >= DAY ? Math.floor(offset / DAY) + "d " : ""}{Math.round((offset % DAY) / MIN)}m)</span>}
            </span>
            <button onClick={() => fastForward(5)} className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-700" title="Simular el paso del tiempo para probar los timers">
              <FastForward size={13} /> +5 min
            </button>
            <button onClick={() => fastForward(24 * 60)} className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-700" title="Simular un día para probar vencimientos de suscripción">
              <CalendarPlus size={13} /> +1 día
            </button>
            <button onClick={resetDemo} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Reiniciar demo">
              <RotateCcw size={13} /> <span className="hidden sm:inline">Reiniciar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============ LAYOUT ============ */}
      {role === "admin" ? (
        <AdminView sellers={sellers} products={products} offers={offers} logins={logins} now={now} actions={actions} session={session} reports={reports} rules={rules} reviews={reviews} tickets={tickets} />
      ) : (
      <main className="mx-auto grid max-w-[1400px] gap-6 sm:px-5 sm:py-5 lg:grid-cols-[1fr_400px_1fr]">
        <GuidePanel role={role} />

        {/* ---- marco PWA mobile-first ---- */}
        <div className="relative mx-auto flex h-[calc(100dvh-52px)] w-full max-w-[400px] flex-col overflow-hidden bg-zinc-50 sm:h-[min(820px,calc(100dvh-96px))] sm:rounded-[2.4rem] sm:border-[10px] sm:border-zinc-900 sm:shadow-2xl">
          <div className="hidden shrink-0 items-center justify-between bg-white px-6 pb-1 pt-2 text-[11px] font-semibold text-zinc-800 sm:flex">
            <span>{new Date(now).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
            <div className="h-5 w-20 rounded-full bg-zinc-900" />
            <span className="flex items-center gap-1">5G ▮▮▮</span>
          </div>

          {bannerOpen && !installed && (
            <div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2.5">
              <img src={LOGO_PERFIL} alt="" className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-tight">Agregá HacemePrecio a tu inicio</p>
                <p className="truncate text-[11px] text-zinc-500">Seguí tus ofertas sin abrir el navegador</p>
              </div>
              <button
                onClick={() => { setInstalled(true); toast("success", "App instalada", "HacemePrecio ya está en tu pantalla de inicio (simulado)."); }}
                className="flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-semibold text-white"
              >
                <Download size={12} /> Agregar
              </button>
              <button onClick={() => setBannerOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-700" aria-label="Cerrar banner">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            {role === "home" ? (
              <LandingPage actions={actions} onExample={() => { setBuyerProductId("p1"); setRole("buyer"); }} onExampleStore={() => { setBuyerProductId("v:s6"); setRole("buyer"); }} onLogin={() => { setSignupIntent(null); setRole("seller"); }} />
            ) : role === "buyer" && storefrontId && sellerById(storefrontId)?.isStore ? (
              <StoreFront store={sellerById(storefrontId)} products={products.filter((p) => p.sellerId === storefrontId && p.moderation !== "pausada")}
                trust={trustFor(storefrontId)} cart={cart} now={now} orders={orders.filter((o) => o.storeId === storefrontId && o.buyerId === ME.id)}
                onOpen={(id) => goBuyer(id)} actions={actions} onReviews={() => setSheet({ type: "reviews", sellerId: storefrontId })} />
            ) : role === "buyer" && !storefrontId && hasVariants(buyerProduct) ? (
              <StoreProduct key={buyerProduct.id} product={buyerProduct} store={sellerById(buyerProduct.sellerId)} cart={cart} actions={actions} now={now}
                onBack={() => setBuyerProductId("v:" + buyerProduct.sellerId)} />
            ) : role === "buyer" && storefrontId ? (
              subAccess(sellerById(storefrontId), now).allowed ? (
                <StorefrontView seller={sellerById(storefrontId)} products={products.filter((p) => p.sellerId === storefrontId && p.moderation !== "pausada")}
                  trust={trustFor(storefrontId)} onOpen={(id) => goBuyer(id)} onReviews={() => setSheet({ type: "reviews", sellerId: storefrontId })}
                  backLabel={buyerBack && !buyerBack.startsWith("v:") ? productById(buyerBack)?.title : null} onBack={() => setBuyerProductId(buyerBack)} />
              ) : (
                <PausedListing product={{ title: `Vidriera de ${sellerById(storefrontId)?.name}`, slug: "" }} />
              )
            ) : role === "buyer" ? (
              subAccess(sellerById(buyerProduct.sellerId), now).allowed && buyerProduct.moderation !== "pausada" ? (
                <BuyerView key={buyerProduct.id} product={buyerProduct} offers={offers} now={now} actions={actions}
                  sellerName={sellerById(buyerProduct.sellerId)?.name} trust={trustFor(buyerProduct.sellerId)}
                  reported={reports.some((r) => r.productId === buyerProduct.id && r.by === ME.id)}
                  reviewedIds={new Set(reviews.filter((r) => r.offerId).map((r) => r.offerId))}
                  onStorefront={() => goBuyer("v:" + buyerProduct.sellerId)}
                  backLabel={buyerBack?.startsWith("v:") ? (sellerById(buyerBack.slice(2))?.isStore ? `la tienda ${sellerById(buyerBack.slice(2))?.name}` : `las cosas de ${sellerById(buyerBack.slice(2))?.name.split(" ")[0]}`) : null}
                  onBack={() => setBuyerProductId(buyerBack)}
                  otherCount={products.filter((p) => p.sellerId === buyerProduct.sellerId && p.id !== buyerProduct.id && p.status !== "vendido").length} />
              ) : (
                <PausedListing product={buyerProduct} />
              )
            ) : sessionSeller && sessionSeller.isStore && sessionSeller.store?.ready === false ? (
              <StoreSetup seller={sessionSeller} actions={actions} />
            ) : sessionSeller ? (
              <SellerView
                products={myProducts} offers={myOffers} now={now} actions={actions} tab={sellerTab} setTab={setSellerTab}
                focusProductId={focusProductId} setFocusProductId={setFocusProductId} seller={sessionSeller} reviews={reviews}
                orders={orders.filter((o) => o.storeId === sessionSeller.id)} productById={productById}
                tickets={tickets.filter((t) => t.sellerId === sessionSeller.id)}
              />
            ) : (
              <SellerLogin key={signupIntent?.plan || "login"} sellers={sellers} now={now} actions={actions} intent={signupIntent} onHome={() => setRole("home")} />
            )}
            {splash && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-kraft-50">
                <img src={LOGO_PERFIL} alt="" className="hp-pop h-28 w-28" />
                <img src={LOGO_HORIZ} alt="Haceme Precio" className="mt-6 h-10 w-auto opacity-90" />
              </div>
            )}
          </div>

          {/* overlays */}
          {sheet?.type === "offer" && (
            <OfferSheet product={productById(sheet.productId)} offers={offers} actions={actions} onClose={() => setSheet(null)}
              sellerName={sellerById(productById(sheet.productId)?.sellerId)?.name} now={now} />
          )}
          {sheet?.type === "cart" && (
            <CartSheet store={sellerById(sheet.storeId)} cart={cart.filter((c) => productById(c.productId)?.sellerId === sheet.storeId)}
              productById={productById} actions={actions} now={now} onClose={() => setSheet(null)} />
          )}
          {sheet?.type === "order" && (() => {
            const o = orders.find((x) => x.id === sheet.orderId);
            return o ? <OrderSheet order={o} store={sellerById(o.storeId)} productById={productById} now={now} onClose={() => setSheet(null)} actions={actions} /> : null;
          })()}
          {sheet?.type === "reviews" && (
            <ReviewsSheet seller={sellerById(sheet.sellerId)} rep={reputationFor(sheet.sellerId)} onClose={() => setSheet(null)} />
          )}
          {sheet?.type === "review" && (() => {
            const o = offers.find((x) => x.id === sheet.offerId);
            const pr = o && productById(o.productId);
            return o && pr ? <ReviewFormSheet offer={o} product={pr} seller={sellerById(pr.sellerId)} actions={actions} onClose={() => setSheet(null)} /> : null;
          })()}
          {sheet?.type === "receipt" && (() => {
            const o = offers.find((x) => x.id === sheet.offerId);
            const pr = o && productById(o.productId);
            return o && pr ? <ReceiptSheet offer={o} product={pr} seller={sellerById(pr.sellerId)} now={now} onClose={() => setSheet(null)} /> : null;
          })()}
          {sheet?.type === "report" && (
            <ReportSheet product={productById(sheet.productId)} actions={actions} onClose={() => setSheet(null)} />
          )}
          {sheet?.type === "checkout" && (
            <CheckoutSheet product={productById(sheet.productId)} sheet={sheet} actions={actions} onClose={() => setSheet(null)} />
          )}

          {/* notificaciones push simuladas */}
          <div className="pointer-events-none absolute inset-x-0 top-1.5 z-[60] flex flex-col items-center gap-2 px-2.5">
            {pushes.map((n) => (
              <button key={n.id} onClick={() => openPush(n)}
                className="hp-toast pointer-events-auto w-full max-w-[370px] rounded-[1.3rem] bg-white/95 p-3 text-left shadow-2xl ring-1 ring-zinc-200 backdrop-blur">
                <div className="flex items-center gap-2">
                  <img src={LOGO_PERFIL} alt="" className="h-5 w-5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Haceme Precio · ahora</span>
                  {((n.to === "seller" && role !== "seller") || (n.to === "buyer" && role !== "buyer")) && (
                    <span className="ml-auto rounded bg-kraft-100 px-1.5 py-px text-[9px] font-semibold text-ink">📱 celular de {n.target}</span>
                  )}
                </div>
                <p className="mt-1 text-[13px] font-semibold text-ink">{n.title}</p>
                <p className="text-[12px] leading-snug text-zinc-600">{n.body}</p>
              </button>
            ))}
          </div>

          {/* toasts */}
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-3">
            {toasts.map((t) => (
              <div key={t.id} className="hp-toast pointer-events-auto flex w-full max-w-[360px] items-start gap-2.5 rounded-2xl bg-zinc-900/95 px-3.5 py-2.5 text-white shadow-xl">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${t.type === "success" ? "bg-hpred" : t.type === "error" ? "bg-rose-500" : "bg-zinc-600"}`}>
                  {t.type === "success" ? <Check size={12} /> : t.type === "error" ? <X size={12} /> : <Info size={12} />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{t.title}</p>
                  {t.msg && <p className="text-[11px] leading-snug text-zinc-300">{t.msg}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <EventLog events={events} />
      </main>
      )}
    </div>
  );
}

/* ============================================================
   PANELES LATERALES (solo escritorio)
   ============================================================ */
function GuidePanel({ role }) {
  const steps = [
    "En Comprador, tocá «Hacer oferta» y probá $500.000 por el iPhone → rechazo automático con sugerencia.",
    "Usá tu 2º intento con el monto sugerido → queda PENDIENTE.",
    "Pasá a Vendedor: tu oferta y la de Martín están en la bandeja. Contraofertá.",
    "Volvé a Comprador: aceptá la contraoferta y pagá.",
    "Usá «+5 min» para ver cómo expiran los timers.",
    "Entrá a Admin: mirá el estado de cada vendedor, suspendé a Nico y volvé a Comprador: su link queda pausado.",
    "Seguridad: ofertá $600.000 por el iPhone (se acepta sola) y en Vendedor intentá aceptar a Martín → queda bloqueado por doble venta.",
    "Pagá «en persona» y en Vendedor tocá «Cerrar fuera de la app»: exige confirmar que viste el dinero acreditado. Probá también «Reportar publicación sospechosa».",
    "Tienda Aura: en Comprador abrí «/v/aura», elegí color y talle, «Lo quiero» y confirmá el pedido. Después en Vendedor cerrá sesión y entrá con hola@aura.ar para ver el pedido.",
    "En Vendedor → «Mi plan» → Cerrar sesión y probá entrar como juanp.bikes@gmail.com (bloqueado) o con un email nuevo (prueba gratis).",
  ];
  return (
    <aside className="hidden self-start lg:block">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Cómo probarlo</p>
        <ol className="mt-3 space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-zinc-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Máquina de estados</p>
        <div className="mt-3 space-y-2 text-[12px] text-zinc-600">
          <div className="flex flex-wrap items-center gap-1.5"><StatusPill status="PENDIENTE" /> → <StatusPill status="ACEPTADA_PENDIENTE_CIERRE" /> → <StatusPill status="CERRADA_PAGADA" /></div>
          <div className="flex flex-wrap items-center gap-1.5"><StatusPill status="ACEPTADA_PENDIENTE_CIERRE" /> → <StatusPill status="ACUERDO_CERRADO_EXTERNO" /></div>
          <div className="flex flex-wrap items-center gap-1.5"><StatusPill status="PENDIENTE" /> → <StatusPill status="CONTRAOFERTA_VENDEDOR" /></div>
          <div className="flex flex-wrap items-center gap-1.5"><StatusPill status="RECHAZADA_AUTO" /> <StatusPill status="RECHAZADA" /> <StatusPill status="EXPIRADA" /></div>
          <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
            <li>• ≥ % de auto-aceptación → <b>aprobada al instante</b></li>
            <li>• &lt; precio piso → <b>rechazo automático</b> con sugerencia</li>
            <li>• Máximo <b>{MAX_ATTEMPTS} ofertas</b> por comprador y producto</li>
            <li>• «Pagada» solo con confirmación de la pasarela, nunca con capturas</li>
            <li>• Unidad única: no se puede aceptar otra oferta con un acuerdo abierto</li>
            <li>• Timers: 15 min respuesta · 10 min contraoferta · 12 h ventana de cierre</li>
          </ul>
        </div>
      </div>
      <p className="mt-3 px-1 text-[11px] text-zinc-400">Vista actual: {role === "buyer" ? "Comprador (llegó desde el link de Marketplace)" : "Panel del vendedor"}</p>
    </aside>
  );
}

function EventLog({ events }) {
  const color = { Comprador: "bg-sky-50 text-sky-700", Vendedor: "bg-zinc-900 text-white", Sistema: "bg-kraft-50 text-hpred-dark" };
  return (
    <aside className="hidden self-start lg:block">
      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5">
          <Activity size={14} className="text-zinc-500" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Registro del motor en vivo</p>
        </div>
        <div className="max-h-[calc(100dvh-170px)] overflow-y-auto px-5 py-3">
          {events.map((e) => (
            <div key={e.id} className="border-b border-zinc-100 py-2.5 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${color[e.actor]}`}>{e.actor}</span>
                <span className="font-mono text-[10px] text-zinc-400">{clockTime(e.at)}</span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-zinc-700">{e.text}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   VISTA COMPRADOR
   ============================================================ */
function Gallery({ product, sold, reserved }) {
  const [i, setI] = useState(0);
  const Icon = CATEGORY_ICON[product.category] || Box;
  const n = product.photos.length;
  const ph = product.photos[i];
  const go = (d) => setI((x) => (x + d + n) % n);
  return (
    <div>
      <div className={`relative aspect-[4/3.4] bg-gradient-to-br ${PALETTES[i % PALETTES.length]} flex items-center justify-center overflow-hidden`}>
        {ph.src ? (
          <img src={ph.src} alt={ph.label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-zinc-400">
            <Icon size={96} strokeWidth={1} />
            <p className="mt-3 text-sm font-semibold text-zinc-600">{ph.label}</p>
            <p className="text-xs text-zinc-500">{ph.sub}</p>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 backdrop-blur">
          {product.condition}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-zinc-900/70 px-2 py-0.5 font-mono text-[10px] text-white">{i + 1}/{n}</span>
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-zinc-200" aria-label="Foto anterior">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-zinc-200" aria-label="Foto siguiente">
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {(sold || reserved) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[2px]">
            <span className={`rotate-[-8deg] rounded-xl border-4 px-5 py-2 text-2xl font-black tracking-widest ${sold ? "border-zinc-900 text-zinc-900" : "border-amber-600 text-amber-700"}`}>
              {sold ? "VENDIDO" : "RESERVADO"}
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto bg-white px-4 py-3 hp-scroll">
        {product.photos.map((p, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={`flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${PALETTES[idx % PALETTES.length]} ring-2 transition ${idx === i ? "ring-hpred" : "ring-transparent opacity-70"}`}
            aria-label={p.label}
          >
            {p.src ? <img src={p.src} alt="" className="h-full w-full rounded-lg object-cover" /> : <Icon size={18} strokeWidth={1.5} className="text-zinc-500" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function BuyerStatusCard({ offer, product, now, actions, attemptsLeft, reviewed, sellerName = "" }) {
  if (!offer) return null;
  const rateBtn = CLOSED.includes(offer.status) && (reviewed ? (
    <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] font-semibold opacity-90"><Star size={14} className="fill-current" /> ¡Gracias por calificar!</p>
  ) : (
    <button onClick={() => actions.setSheet({ type: "review", offerId: offer.id })}
      className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-kraft text-[15px] font-bold text-ink">
      <Star size={17} className="fill-ink" /> Calificar a {sellerName.split(" ")[0] || "el vendedor"}
    </button>
  ));
  const receiptBtn = ["ACEPTADA_PENDIENTE_CIERRE", "CERRADA_PAGADA", "ACUERDO_CERRADO_EXTERNO"].includes(offer.status) && (
    <button onClick={() => actions.setSheet({ type: "receipt", offerId: offer.id })} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold underline-offset-2 hover:underline">
      <Receipt size={14} /> Ver recibo del acuerdo
    </button>
  );
  const left = offer.expiresAt ? offer.expiresAt - now : 0;
  const wrap = "mx-4 mt-4 rounded-2xl border p-4";
  switch (offer.status) {
    case "PENDIENTE":
      return (
        <div className={`${wrap} border-amber-200 bg-amber-50/60`}>
          <div className="flex items-center justify-between">
            <StatusPill status="PENDIENTE" />
            <span className="flex items-center gap-1 font-mono text-xs text-amber-800"><Clock size={12} /> {mmss(left)}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-800">Tu oferta de <b>{fmt(offer.amount)}</b> está en manos del vendedor. Tiene hasta que termine el contador para responder.</p>
        </div>
      );
    case "RECHAZADA_AUTO":
      return (
        <div className={`${wrap} border-zinc-200 bg-white`}>
          <StatusPill status="RECHAZADA_AUTO" />
          <p className="mt-2 text-sm text-zinc-800">
            Tu oferta de {fmt(offer.amount)} es muy baja. El vendedor empieza a escuchar ofertas desde <b>{fmt(offer.suggestedAmount)}</b>. ¿Querés ofertar ese monto?
          </p>
          {attemptsLeft > 0 && product.status !== "vendido" ? (
            <Btn
              className="mt-3 w-full py-2.5"
              onClick={() => {
                const r = actions.submitOffer(product.id, offer.suggestedAmount);
                if (r.error) actions.toast("error", "No se pudo ofertar", r.error);
                else actions.toast("success", "Oferta enviada", r.offer.status === "ACEPTADA_PENDIENTE_CIERRE" ? "¡Aceptada al instante!" : "El vendedor ya la tiene en su bandeja.");
              }}
            >
              <HandCoins size={16} /> Ofertar {fmt(offer.suggestedAmount)} <span className="font-normal opacity-80">(último intento)</span>
            </Btn>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">No te quedan intentos. Podés comprarlo al precio de lista.</p>
          )}
        </div>
      );
    case "CONTRAOFERTA_VENDEDOR":
      return (
        <div className={`${wrap} border-sky-200 bg-sky-50/60`}>
          <div className="flex items-center justify-between">
            <StatusPill status="CONTRAOFERTA_VENDEDOR" />
            <span className="flex items-center gap-1 font-mono text-xs text-sky-800"><Clock size={12} /> {mmss(left)}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-800">
            Ofreciste {fmt(offer.amount)}. El vendedor te propone <b className="text-base">{fmt(offer.counterAmount)}</b>.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn variant="outline" className="py-2.5" onClick={() => actions.buyerRejectCounter(offer)}>No, gracias</Btn>
            <Btn className="py-2.5" onClick={() => actions.buyerAcceptCounter(offer)}><Check size={16} /> Acepto</Btn>
          </div>
        </div>
      );
    case "ACEPTADA_PENDIENTE_CIERRE":
      return (
        <div className={`${wrap} border-kraft-200 bg-kraft-50`}>
          <div className="flex items-center justify-between">
            <StatusPill status="ACEPTADA_PENDIENTE_CIERRE" />
            <span className="flex items-center gap-1 font-mono text-xs text-hpred-dark"><Clock size={12} /> {mmss(left)} para cerrar</span>
          </div>
          <DealCard offer={offer} product={product} sellerName={sellerName} now={now} actions={actions} compact />
          {offer.closeMode === "externo" ? (
            <p className="mt-3 text-[13px] text-zinc-700">Elegiste pagar en persona o por transferencia. El vendedor cierra la venta cuando ve el dinero.</p>
          ) : (
            <Btn className="mt-3 w-full py-3" onClick={() => actions.setSheet({ type: "checkout", productId: product.id, offerId: offer.id, amount: offer.finalAmount })}>
              <CreditCard size={16} /> Pagar o coordinar · {fmt(offer.finalAmount)}
            </Btn>
          )}
          {receiptBtn}
        </div>
      );
    case "ACUERDO_CERRADO_EXTERNO":
      return (
        <div className={`${wrap} border-zinc-200 bg-white`}>
          <StatusPill status="ACUERDO_CERRADO_EXTERNO" />
          <p className="mt-2 text-sm text-zinc-700">El vendedor registró la venta por {fmt(offer.finalAmount ?? offer.amount)} con pago fuera de la app. Haceme Precio no verificó ese pago.</p>
          {receiptBtn}
          {rateBtn}
        </div>
      );
    case "CERRADA_PAGADA":
      return (
        <div className={`${wrap} border-hpred bg-hpred text-white`}>
          <div className="flex items-center gap-2"><BadgeCheck size={18} /><p className="text-sm font-semibold">Pago verificado por la pasarela · {fmt(offer.finalAmount)}</p></div>
          <p className="mt-2 text-xs text-kraft-50">Entrega: {offer.delivery}. Te mandamos los datos del vendedor por mail.</p>
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wider text-kraft-100">Código de retiro</p>
            <p className="font-mono text-lg font-bold tracking-widest">{offer.code}</p>
          </div>
          <button onClick={() => actions.setSheet({ type: "receipt", offerId: offer.id })} className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold text-white underline">
            <Receipt size={14} /> Ver recibo del acuerdo
          </button>
          {rateBtn}
        </div>
      );
    case "RECHAZADA":
      return (
        <div className={`${wrap} border-zinc-200 bg-white`}>
          <StatusPill status="RECHAZADA" />
          <p className="mt-2 text-sm text-zinc-700">La negociación por {fmt(offer.counterAmount || offer.amount)} no prosperó.{attemptsLeft > 0 ? " Te queda 1 oferta más." : " Ya no te quedan ofertas: podés comprarlo al precio de lista."}</p>
        </div>
      );
    case "EXPIRADA":
      return (
        <div className={`${wrap} border-zinc-200 bg-white`}>
          <StatusPill status="EXPIRADA" />
          <p className="mt-2 text-sm text-zinc-700">{offer.log[offer.log.length - 1]?.text}.</p>
        </div>
      );
    default:
      return null;
  }
}

function BuyerView({ product, offers, now, actions, sellerName = "Vendedor", trust, reported, onStorefront, otherCount = 0, backLabel, onBack, reviewedIds = new Set() }) {
  const [openFaq, setOpenFaq] = useState(0);
  const mine = offers.filter((o) => o.productId === product.id && o.buyerId === ME.id);
  const myOffers = mine.filter((o) => o.kind === "oferta");
  const latest = mine[0];
  const myActive = myOffers.find((o) => ACTIVE.includes(o.status));
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - myOffers.length);
  const sold = product.status === "vendido";
  const reservedByOther = !sold && offers.some((o) => o.productId === product.id && o.status === "ACEPTADA_PENDIENTE_CIERRE" && o.buyerId !== ME.id);
  const faqs = buildFaqs(product);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
        <Lock size={11} className="text-zinc-500" />
        <span className="truncate font-mono text-[11px] text-zinc-600">hacemeprecio.app/p/{product.slug}</span>
      </div>
      {backLabel && <BackBar label={backLabel} onBack={onBack} />}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 bg-white px-4 py-2">
        <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-6 w-auto" />
        <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-500"><ShieldCheck size={12} /> Compra protegida</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4 hp-scroll">
        <Gallery product={product} sold={sold} reserved={reservedByOther} />

        <div className="bg-white px-4 pb-4">
          <h1 className="text-lg font-semibold leading-snug text-zinc-900">{product.title}</h1>
          <div className="mt-1 flex items-end gap-2">
            <p className="text-2xl font-bold tracking-tight">{fmt(product.listPrice)}</p>
            <p className="mb-1 text-xs text-zinc-500">precio de lista · acepta ofertas</p>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-zinc-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-white">{initials(sellerName)}</div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs font-semibold">{sellerName} <ShieldCheck size={13} className="text-hpred" /></p>
              <RatingLine rep={trust?.rep} onClick={() => actions.setSheet({ type: "reviews", sellerId: product.sellerId })} />
              <p className="text-[11px] text-zinc-500">
                {trust?.closed ?? 0} operaciones cerradas · en Haceme Precio {trust?.months >= 1 ? `hace ${trust.months} ${trust.months === 1 ? "mes" : "meses"}` : `hace ${trust?.days ?? 0} días`}
              </p>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-zinc-500"><Eye size={12} /> {product.views}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium">
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"><Check size={10} /> Email verificado</span>
            {trust?.phoneVerified
              ? <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"><Check size={10} /> Teléfono verificado</span>
              : <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200"><AlertTriangle size={10} /> Teléfono sin verificar</span>}
            {(trust?.days ?? 0) < 14 && <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200">Cuenta nueva</span>}
            {(product.stock ?? 1) <= 1 ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">Unidad única</span>
              : <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">Quedan {product.stock}</span>}
          </div>
          {otherCount > 0 && (
            <button onClick={onStorefront} className="mt-2 flex w-full items-center justify-between rounded-xl bg-kraft-50 px-3 py-2.5 text-left text-[13px] font-semibold text-ink ring-1 ring-kraft-200">
              <span className="flex items-center gap-2"><Store size={15} /> Ver {otherCount} cosa(s) más de {sellerName.split(" ")[0]}</span>
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {reservedByOther && (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
            Otra oferta fue aceptada y está esperando el pago. Si no se paga a tiempo, vuelve a estar disponible.
          </div>
        )}

        <BuyerStatusCard offer={latest} product={product} now={now} actions={actions} attemptsLeft={attemptsLeft} reviewed={latest && reviewedIds.has(latest.id)} sellerName={sellerName} />

        {!sold && (
          <div className="mx-4 mt-4 flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-xs ring-1 ring-zinc-200">
            <span className="flex items-center gap-1.5 text-zinc-600"><HandCoins size={14} /> Ofertas formales disponibles</span>
            <span className="flex items-center gap-1">
              {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                <span key={i} className={`h-2 w-5 rounded-full ${i < attemptsLeft ? "bg-hpred" : "bg-zinc-200"}`} />
              ))}
              <b className="ml-1">{attemptsLeft}/{MAX_ATTEMPTS}</b>
            </span>
          </div>
        )}

        <section className="mx-4 mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Entrega</h2>
          <div className="mt-2.5 space-y-2 text-sm">
            <p className="flex gap-2"><Truck size={16} className="mt-0.5 shrink-0 text-zinc-500" />
              {product.shipping.enabled ? <span>Envíos a cargo del comprador · <span className="text-zinc-500">{product.shipping.note}</span></span> : <span className="text-zinc-600">{product.shipping.note}</span>}
            </p>
            {product.pickupPoints.map((pp) => (
              <p key={pp} className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-zinc-500" /> {pp}</p>
            ))}
          </div>
        </section>

        <section className="mx-4 mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Detalles</h2>
          <ul className="mt-2.5 grid grid-cols-1 gap-1.5 text-sm">
            {product.highlights.map((h) => (
              <li key={h} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-hpred" /> {h}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">{product.description}</p>
        </section>

        <section className="mx-4 mt-4 rounded-2xl bg-white ring-1 ring-zinc-200">
          <div className="flex items-center gap-2 px-4 pt-4">
            <MessageSquareOff size={15} className="text-zinc-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Antes de preguntar</h2>
          </div>
          <div className="mt-1 divide-y divide-zinc-100">
            {faqs.map((f, i) => (
              <button key={f.q} onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="block w-full px-4 py-3 text-left">
                <span className="flex items-center justify-between text-sm font-medium">
                  {f.q}
                  <ChevronDown size={16} className={`text-zinc-400 transition ${openFaq === i ? "rotate-180" : ""}`} />
                </span>
                {openFaq === i && <span className="mt-1.5 block text-sm text-zinc-600">{f.a}</span>}
              </button>
            ))}
          </div>
        </section>

        <FaqList title="Cómo funciona Haceme Precio" Icon={Info} dark items={PLATFORM_FAQ.oferta} />

        <section className="mx-4 mt-4 rounded-2xl bg-ink p-4 text-white">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-kraft"><ShieldCheck size={14} /> Comprá seguro</p>
          <ul className="mt-2.5 space-y-2 text-[12px] leading-snug text-zinc-200">
            <li className="flex gap-2"><span className="text-kraft">1.</span> Nunca pagues señas ni adelantos sin ver el producto o sin verificar al vendedor.</li>
            <li className="flex gap-2"><span className="text-kraft">2.</span> Revisá las condiciones de entrega antes de ofertar. Para pagos fuera de la app, encontrate en un lugar público.</li>
            <li className="flex gap-2"><span className="text-kraft">3.</span><span>Este link pertenece al dominio oficial <b className="font-mono text-white">hacemeprecio.app</b>. Desconfiá de otros links o de quien te pida datos por chat.</span></li>
          </ul>
        </section>

        <div className="mx-4 mt-3 flex justify-center">
          {reported ? (
            <span className="flex items-center gap-1.5 text-[12px] text-zinc-500"><Check size={13} /> Reportaste esta publicación. La estamos revisando.</span>
          ) : (
            <button onClick={() => actions.setSheet({ type: "report", productId: product.id })} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-zinc-600 underline-offset-2 hover:text-hpred hover:underline">
              <AlertTriangle size={13} /> Reportar publicación sospechosa
            </button>
          )}
        </div>

        <p className="mt-4 px-6 pb-2 text-center text-[10px] leading-relaxed text-zinc-400">
          Haceme Precio es una herramienta de gestión de ofertas y condiciones comerciales entre partes. No actúa como intermediario financiero ni garantiza entregas físicas.
        </p>
      </div>

      {/* CTA fija */}
      <div className="shrink-0 border-t border-zinc-200 bg-white p-3">
        {sold ? (
          <Btn variant="dark" disabled className="w-full py-3">Vendido</Btn>
        ) : myActive?.status === "ACEPTADA_PENDIENTE_CIERRE" && myActive.closeMode === "externo" ? (
          <Btn variant="outline" disabled className="w-full py-3"><Clock size={16} /> Acuerdo en curso · {mmss(myActive.expiresAt - now)}</Btn>
        ) : myActive?.status === "ACEPTADA_PENDIENTE_CIERRE" ? (
          <Btn className="w-full py-3" onClick={() => actions.setSheet({ type: "checkout", productId: product.id, offerId: myActive.id, amount: myActive.finalAmount })}>
            <CreditCard size={16} /> Cerrar la compra · {fmt(myActive.finalAmount)}
          </Btn>
        ) : reservedByOther ? (
          <Btn variant="outline" disabled className="w-full py-3">Reservado temporalmente</Btn>
        ) : (
          <div className="grid grid-cols-[1fr_1.15fr] gap-2">
            <Btn
              variant="outline"
              className="py-3"
              disabled={!!myActive || attemptsLeft === 0}
              onClick={() => actions.setSheet({ type: "offer", productId: product.id })}
            >
              <HandCoins size={16} /> {myActive ? "Oferta en curso" : attemptsLeft === 0 ? "Sin ofertas" : "Hacer oferta"}
            </Btn>
            <Btn className="py-3" onClick={() => actions.setSheet({ type: "checkout", productId: product.id, offerId: null, amount: product.listPrice })}>
              <ShoppingBag size={16} /> Comprar {fmt(product.listPrice)}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function OfferSheet({ product, offers, actions, onClose, sellerName, now = Date.now() }) {
  const [amount, setAmount] = useState(round1k(product.listPrice * 0.85));
  const [result, setResult] = useState(null);
  const myCount = offers.filter((o) => o.productId === product.id && o.buyerId === ME.id && o.kind === "oferta").length;
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - myCount);
  const min = round1k(product.listPrice * 0.4);

  const send = (value) => {
    const r = actions.submitOffer(product.id, value);
    if (r.error) return actions.toast("error", "No se pudo enviar", r.error);
    setResult(r.offer);
  };

  if (result) {
    const s = result.status;
    return (
      <Sheet onClose={onClose} title="Resultado de tu oferta">
        <div className="text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${s === "ACEPTADA_PENDIENTE_CIERRE" ? "bg-hpred text-white" : s === "PENDIENTE" ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>
            {s === "ACEPTADA_PENDIENTE_CIERRE" ? <Zap size={26} /> : s === "PENDIENTE" ? <Clock size={26} /> : <Ban size={26} />}
          </div>
          <p className="mt-3 text-lg font-semibold">
            {s === "ACEPTADA_PENDIENTE_CIERRE" ? "¡Aceptada al instante!" : s === "PENDIENTE" ? "Oferta enviada" : "Tu oferta es muy baja"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {s === "ACEPTADA_PENDIENTE_CIERRE" && <>Cerraste en <b>{fmt(result.amount)}</b>. Tenés 12 horas para pagar o coordinar el cierre.</>}
            {s === "PENDIENTE" && <>El vendedor tiene 15 minutos para aceptar, rechazar o contraofertar tus <b>{fmt(result.amount)}</b>. Te avisamos acá.</>}
            {s === "RECHAZADA_AUTO" && <>El vendedor empieza a escuchar ofertas desde <b>{fmt(result.suggestedAmount)}</b>. ¿Querés ofertar ese monto?</>}
          </p>
        </div>
        <div className="mt-5 space-y-2">
          {s === "ACEPTADA_PENDIENTE_CIERRE" && (
            <>
              <DealCard offer={result} product={product} sellerName={sellerName} now={now} actions={actions} />
              <Btn className="w-full py-3" onClick={() => actions.setSheet({ type: "checkout", productId: product.id, offerId: result.id, amount: result.amount })}>
                <CreditCard size={16} /> Pagar o coordinar · {fmt(result.amount)}
              </Btn>
            </>
          )}
          {s === "RECHAZADA_AUTO" && result.attempt < MAX_ATTEMPTS && (
            <Btn className="w-full py-3" onClick={() => send(result.suggestedAmount)}>
              <HandCoins size={16} /> Sí, ofertar {fmt(result.suggestedAmount)}
            </Btn>
          )}
          <Btn variant="outline" className="w-full py-3" onClick={onClose}>{s === "RECHAZADA_AUTO" ? "Ahora no" : "Listo"}</Btn>
        </div>
      </Sheet>
    );
  }

  const ratio = pct(amount, product.listPrice);
  return (
    <Sheet onClose={onClose} title="Hacé tu oferta formal">
      <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
        <ProductThumb product={product} size="h-11 w-11" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{product.title}</p>
          <p className="text-xs text-zinc-500">Precio de lista {fmt(product.listPrice)}</p>
        </div>
      </div>

      <label className="mt-5 block text-xs font-medium text-zinc-500">Tu oferta</label>
      <div className="mt-1 flex items-center rounded-2xl border-2 border-zinc-900 px-4 py-2">
        <span className="text-2xl font-semibold text-zinc-400">$</span>
        <input
          inputMode="numeric"
          value={amount ? amount.toLocaleString("es-AR") : ""}
          onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
          className="w-full bg-transparent px-1 text-3xl font-bold tracking-tight outline-none"
          aria-label="Monto de la oferta"
        />
        <span className="shrink-0 rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">{ratio}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={product.listPrice - 1000}
        step={1000}
        value={Math.min(Math.max(amount, min), product.listPrice - 1000)}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="mt-4 w-full"
        aria-label="Ajustar oferta"
      />
      <div className="mt-2 flex gap-2">
        {[5, 10, 15, 20].map((d) => (
          <button key={d} onClick={() => setAmount(round1k(product.listPrice * (1 - d / 100)))}
            className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
            −{d}%
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">Ahorrás <b className="text-zinc-800">{fmt(Math.max(0, product.listPrice - amount))}</b> si la aceptan.</p>

      <div className="mt-4 space-y-1.5 rounded-xl bg-zinc-50 p-3 text-[12px] text-zinc-600">
        <p className="flex gap-2"><Zap size={13} className="mt-0.5 shrink-0" /> Si entra en el rango del vendedor, se acepta al instante.</p>
        <p className="flex gap-2"><Clock size={13} className="mt-0.5 shrink-0" /> Si no, el vendedor responde en máximo 15 min.</p>
        <p className="flex gap-2"><Info size={13} className="mt-0.5 shrink-0" /> Te quedan <b className="text-zinc-800">{attemptsLeft} de {MAX_ATTEMPTS}</b> ofertas para este producto.</p>
      </div>

      <Btn className="mt-4 w-full py-3.5" disabled={!amount || attemptsLeft === 0} onClick={() => send(amount)}>
        Enviar oferta de {fmt(amount)}
      </Btn>
    </Sheet>
  );
}

function CheckoutSheet({ product, sheet, actions, onClose }) {
  const options = [
    ...product.pickupPoints.map((p) => ({ k: "Retiro en " + p, label: "Retiro en persona", sub: p, Icon: MapPin })),
    ...(product.shipping.enabled ? [{ k: "Envío a domicilio (" + product.shipping.note + ")", label: "Envío a domicilio", sub: `${product.shipping.note} · a cargo tuyo`, Icon: Truck }] : []),
  ];
  const [delivery, setDelivery] = useState(options[0]?.k || "A coordinar");
  const [method, setMethod] = useState("gateway");
  const [stage, setStage] = useState("form"); // form → waiting → verified | external
  const [code, setCode] = useState("");

  const confirm = () => {
    if (method === "external") {
      const r = actions.buyerChooseExternal({ productId: product.id, offerId: sheet.offerId, amount: sheet.amount, delivery });
      if (r?.error) return actions.toast("error", "No disponible", r.error);
      setStage("external");
      return;
    }
    // Simulación del webhook de Mercado Pago: el estado solo cambia cuando la pasarela confirma.
    setStage("waiting");
    setTimeout(() => {
      const c = actions.pay({ productId: product.id, offerId: sheet.offerId, amount: sheet.amount, delivery, method: "Mercado Pago", gatewayVerified: true });
      if (!c) return setStage("form");
      setCode(c);
      setStage("verified");
    }, 1600);
  };

  if (stage === "verified") {
    return (
      <Sheet onClose={onClose} title="Pago verificado">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-hpred text-white"><BadgeCheck size={28} /></div>
          <p className="mt-3 text-lg font-semibold">Pago verificado por la pasarela</p>
          <p className="mt-1 text-sm text-zinc-600">{fmt(sheet.amount)} · {delivery}</p>
          <div className="mx-auto mt-4 w-fit rounded-xl bg-zinc-100 px-5 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Código de retiro</p>
            <p className="font-mono text-xl font-bold tracking-widest">{code}</p>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">Mostrá el código recién cuando tengas el producto en la mano.</p>
        </div>
        <Btn variant="dark" className="mt-5 w-full py-3" onClick={onClose}>Cerrar</Btn>
      </Sheet>
    );
  }
  if (stage === "external") {
    return (
      <Sheet onClose={onClose} title="Acuerdo registrado">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-kraft-100 text-ink"><Clock size={26} /></div>
          <p className="mt-3 text-lg font-semibold">El vendedor ya sabe que vas a pagar en persona</p>
          <p className="mt-1 text-sm text-zinc-600">Tienen 12 horas para coordinar. Si nadie cierra la venta, el acuerdo vence solo.</p>
        </div>
        <div className="mt-4 space-y-1.5 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-900 ring-1 ring-amber-200">
          <p className="font-semibold">Para cuidarte:</p>
          <p>• Pagá recién cuando veas el producto, en un lugar público.</p>
          <p>• No mandes señas ni adelantos a nadie que no viste.</p>
          <p>• Haceme Precio no retiene ni garantiza pagos hechos fuera de la app.</p>
        </div>
        <Btn variant="dark" className="mt-4 w-full py-3" onClick={onClose}>Entendido</Btn>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={stage === "waiting" ? () => {} : onClose} title={sheet.offerId ? "Cerrar la compra" : "Comprar ahora"}>
      <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
        <ProductThumb product={product} size="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.title}</p>
          {sheet.amount < product.listPrice && <p className="text-xs text-zinc-400 line-through">{fmt(product.listPrice)}</p>}
        </div>
        <p className="text-lg font-bold">{fmt(sheet.amount)}</p>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">Entrega</p>
      <div className="mt-2 space-y-2">
        {options.map((o) => (
          <button key={o.k} onClick={() => setDelivery(o.k)}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${delivery === o.k ? "border-hpred bg-kraft-50/50 ring-1 ring-hpred" : "border-zinc-200"}`}>
            <o.Icon size={18} className="shrink-0 text-zinc-600" />
            <span className="min-w-0"><span className="block text-sm font-medium">{o.label}</span><span className="block truncate text-xs text-zinc-500">{o.sub}</span></span>
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">Cómo pagás</p>
      <div className="mt-2 space-y-2">
        <button onClick={() => setMethod("gateway")}
          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${method === "gateway" ? "border-hpred bg-kraft-50/50 ring-1 ring-hpred" : "border-zinc-200"}`}>
          <Wallet size={18} className="mt-0.5 shrink-0" />
          <span><span className="flex items-center gap-1.5 text-sm font-semibold">Mercado Pago <span className="rounded bg-ink px-1.5 py-px text-[9px] font-bold uppercase text-white">Recomendado</span></span>
            <span className="block text-xs text-zinc-500">La venta se confirma solo cuando la pasarela verifica el pago.</span></span>
        </button>
        <button onClick={() => setMethod("external")}
          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${method === "external" ? "border-hpred bg-kraft-50/50 ring-1 ring-hpred" : "border-zinc-200"}`}>
          <ArrowLeftRight size={18} className="mt-0.5 shrink-0" />
          <span><span className="block text-sm font-semibold">En persona o transferencia directa</span>
            <span className="block text-xs text-zinc-500">Lo coordinás con el vendedor. Haceme Precio no interviene en ese pago.</span></span>
        </button>
      </div>
      <p className="mt-3 flex gap-1.5 text-[11px] text-zinc-500"><ShieldCheck size={13} className="shrink-0" /> Nunca te vamos a pedir que mandes capturas de pantalla como comprobante.</p>

      <Btn className="mt-4 w-full py-3.5" disabled={stage === "waiting"} onClick={confirm}>
        {stage === "waiting" ? "Esperando confirmación de Mercado Pago…" : method === "gateway" ? <>Pagar {fmt(sheet.amount)}</> : "Avisar al vendedor"}
      </Btn>
    </Sheet>
  );
}

/* ============================================================
   VISTA VENDEDOR
   ============================================================ */
function SellerView({ products, offers, now, actions, tab, setTab, focusProductId, setFocusProductId, seller, reviews = [], orders = [], productById, tickets = [] }) {
  const isStore = !!seller.isStore;
  const newOrders = orders.filter((o) => o.status === "nuevo").length;
  const storeRevenue = orders.filter((o) => o.status === "entregado" || (o.paid && o.status !== "cancelado")).reduce((s, o) => s + o.total, 0);
  const acc = subAccess(seller, now);
  const pending = offers.filter((o) => o.status === "PENDIENTE");
  const filtered = offers.filter((o) => o.status === "RECHAZADA_AUTO" || (o.kind === "oferta" && o.log.some((l) => l.text.startsWith("Auto-aceptada")))).length;
  const sales = offers.filter((o) => CLOSED.includes(o.status));
  const revenue = sales.reduce((s, o) => s + (o.finalAmount || 0), 0);
  const views = products.reduce((s, p) => s + p.views, 0);

  const tabs = [
    { k: "inbox", label: isStore ? "Pedidos" : "Mis ofertas", Icon: Inbox, badge: isStore ? newOrders + pending.length : pending.length },
    { k: "products", label: isStore ? "Productos" : "Mis cosas", Icon: Package },
    { k: "create", label: isStore ? "Cargar" : "Vender algo", Icon: Plus },
    { k: "account", label: "Mi cuenta", Icon: User, badge: acc.key === "gracia" ? "!" : 0 },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto hp-scroll">
        <div className="bg-white px-4 pb-4 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-6 w-auto" />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${SUB_STYLE[acc.key].cls}`}>{SUB_STYLE[acc.key].label}</span>
          </div>
          {acc.key === "gracia" && (
            <button onClick={() => setTab("account")} className="mb-3 flex w-full items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-left text-[12px] text-amber-900 ring-1 ring-amber-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>Tu pago de {fmt(planOf(seller).price)} está vencido. Te quedan <b>{acc.daysLeft} día(s)</b> antes de que se pausen tus links. <u>Pagar ahora</u></span>
            </button>
          )}
          {acc.key === "prueba" && (
            <button onClick={() => setTab("account")} className="mb-3 flex w-full items-center gap-2 rounded-xl bg-sky-50 p-2.5 text-left text-[12px] text-sky-900 ring-1 ring-sky-200">
              <Sparkles size={14} className="shrink-0" /> Prueba gratis: te quedan <b>{acc.daysLeft} día(s)</b>. Activá tu plan por {fmt(planOf(seller).price)}/mes.
            </button>
          )}
          <p className="text-xs text-zinc-500">Hola, {seller.isStore ? seller.name : seller.name.split(" ")[0]} 👋</p>
          <h1 className="font-display text-lg font-extrabold">
            {tab === "inbox" ? (isStore ? "Pedidos" : "Mis ofertas") : tab === "products" ? (isStore ? "Tus productos" : "Lo que estás vendiendo") : tab === "create" ? (isStore ? "Cargar producto" : "Vender algo nuevo") : "Mi cuenta"}
          </h1>
          {(tab === "inbox" || tab === "products") && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {isStore ? (
                <>
                  <Metric Icon={ShoppingBag} label="Pedidos nuevos" value={newOrders} accent={newOrders > 0} />
                  <Metric Icon={Package} label="Prendas en stock" value={products.reduce((s, p) => s + (p.status === "vendido" ? 0 : totalStock(p)), 0)} hint={`${products.filter((p) => hasVariants(p) && p.variants.some((v) => v.stock === 0)).length} con talles agotados`} />
                  <Metric Icon={TrendingUp} label="Ya vendiste" value={fmt(storeRevenue + revenue)} hint={`${orders.filter((o) => o.status === "entregado").length} entregado(s)`} />
                  <Metric Icon={Eye} label="Visitas a la tienda" value={views} />
                </>
              ) : (
                <>
                  <Metric Icon={Clock} label="Para contestar" value={pending.length} accent={pending.length > 0} />
                  <Metric Icon={MessageSquareOff} label="Charlas que te ahorramos" value={filtered} hint="ofertas bajas o vendidas solas" />
                  <Metric Icon={TrendingUp} label="Ya vendiste" value={fmt(revenue)} hint={`${sales.length} venta(s)`} />
                  <Metric Icon={Eye} label="Personas que lo vieron" value={views} />
                </>
              )}
            </div>
          )}
        </div>

        {tab === "inbox" && isStore && <OrdersPanel orders={orders} productById={productById} now={now} actions={actions} />}
        {tab === "inbox" && (!isStore || offers.length > 0) && (
          <>
            {isStore && <p className="px-4 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Ofertas en liquidación</p>}
            <Inbox_ offers={offers} products={products} now={now} actions={actions} sellerName={seller.name} />
          </>
        )}
        {tab === "products" && (
          <ProductsTab seller={seller} products={products} offers={offers} actions={actions} focusProductId={focusProductId} setFocusProductId={setFocusProductId} />
        )}
        {tab === "create" && <CreateTab actions={actions} seller={seller} products={products} />}
        {tab === "account" && <AccountTab seller={seller} now={now} actions={actions} reviews={reviews} tickets={tickets} products={products} />}
      </div>

      <nav className="grid shrink-0 grid-cols-4 border-t border-zinc-200 bg-white">
        {tabs.map(({ k, label, Icon, badge }) => (
          <button key={k} onClick={() => setTab(k)} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${tab === k ? "text-hpred" : "text-zinc-500"}`}>
            <Icon size={20} strokeWidth={tab === k ? 2.2 : 1.8} />
            {label}
            {!!badge && <span className="absolute right-[24%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-hpred px-1 text-[10px] font-bold text-white">{badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Metric({ Icon, label, value, hint, accent }) {
  return (
    <div className={`rounded-xl p-3 ring-1 ${accent ? "bg-kraft-50 ring-kraft-200" : "bg-zinc-50 ring-zinc-100"}`}>
      <p className="flex items-center gap-1 text-[11px] text-zinc-500"><Icon size={12} /> {label}</p>
      <p className="mt-0.5 text-lg font-bold tracking-tight">{value}</p>
      {hint && <p className="text-[10px] text-zinc-400">{hint}</p>}
    </div>
  );
}

function Inbox_({ offers, products, now, actions, sellerName }) {
  const [filter, setFilter] = useState("pending");
  const list = offers
    .filter((o) => (filter === "pending" ? ACTIVE.includes(o.status) : true))
    .sort((a, b) => (b.status === "PENDIENTE") - (a.status === "PENDIENTE") || b.createdAt - a.createdAt);
  return (
    <div className="px-4 pb-6 pt-3">
      <div className="mb-3 flex items-center gap-2">
        <Filter size={13} className="text-zinc-400" />
        {[{ k: "pending", l: "Activas" }, { k: "all", l: "Todas" }].map(({ k, l }) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === k ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>{l}</button>
        ))}
      </div>
      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
          No hay ofertas activas. El sistema está filtrando por vos 😌
        </div>
      )}
      <div className="space-y-3">
        {list.map((o) => (
          <OfferCard key={o.id} offer={o} product={products.find((p) => p.id === o.productId)} now={now} actions={actions} sellerName={sellerName}
            lock={o.status === "PENDIENTE" ? actions.dealLock(o.productId, o.id) : null} />
        ))}
      </div>
    </div>
  );
}

function OfferCard({ offer: o, product: p, now, actions, lock, sellerName }) {
  const [closing, setClosing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [countering, setCountering] = useState(false);
  const [counter, setCounter] = useState(round1k((o.amount + p.listPrice) / 2));
  const [showLog, setShowLog] = useState(false);
  const ratio = pct(o.amount, p.listPrice);
  const left = o.expiresAt ? o.expiresAt - now : 0;
  const isNew = !o.seenBySeller;
  const shown = o.finalAmount ?? o.counterAmount ?? o.amount;

  return (
    <div className={`rounded-2xl bg-white p-3.5 ring-1 transition ${isNew ? "ring-2 ring-hpred" : "ring-zinc-200"}`}>
      <div className="flex items-start gap-3">
        <ProductThumb product={p} size="h-10 w-10" iconSize={18} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs text-zinc-500">{p.title}</p>
            {isNew && <span className="shrink-0 rounded bg-hpred px-1.5 py-px text-[9px] font-bold uppercase text-white">Nueva</span>}
          </div>
          <p className="text-sm font-semibold">{o.buyerName} {o.kind === "directa" && <span className="font-normal text-zinc-500">· compra directa</span>}</p>
        </div>
        <StatusPill status={o.status} />
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          {o.status === "PENDIENTE" && <p className="text-[13px] text-zinc-600">{o.buyerName.split(" ")[0]} te ofrece</p>}
          <p className="text-[28px] font-extrabold leading-tight tracking-tight">{fmt(shown)}</p>
          {o.status === "CONTRAOFERTA_VENDEDOR" && <p className="text-[12px] text-zinc-500">Ofreció {fmt(o.amount)} · le pediste {fmt(o.counterAmount)}</p>}
          {o.kind === "oferta" && o.status !== "CONTRAOFERTA_VENDEDOR" && (
            <p className="text-[12px] text-zinc-500">Es el {ratio}% de lo que pedís ({fmt(p.listPrice)})</p>
          )}
        </div>
        {ACTIVE.includes(o.status) && (
          <span className={`flex flex-col items-end rounded-xl px-2.5 py-1 ${left < 3 * MIN ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}>
            <span className="text-[10px] font-medium">{o.status === "PENDIENTE" ? "Contestá en" : "Vence en"}</span>
            <span className="font-mono text-[12px] font-semibold">{mmss(left)}</span>
          </span>
        )}
      </div>

      {o.kind === "oferta" && (
        <div className="relative mt-2.5 h-1.5 rounded-full bg-zinc-100">
          <div className="absolute inset-y-0 left-0 rounded-full bg-zinc-800" style={{ width: `${Math.min(100, ratio)}%` }} />
          <div className="absolute -top-1 h-3.5 w-0.5 bg-rose-500" style={{ left: `${pct(p.floorPrice, p.listPrice)}%` }} title="Precio piso" />
          <div className="absolute -top-1 h-3.5 w-0.5 bg-hpred" style={{ left: `${p.autoAcceptPct}%` }} title="Auto-aceptación" />
        </div>
      )}
      {o.kind === "oferta" && (
        <div className="mt-1.5 flex justify-between text-[10px] text-zinc-400">
          <span><span className="text-rose-500">▍</span>tu mínimo {fmt(p.floorPrice)}</span>
          <span><span className="text-hpred">▍</span>se vende solo desde {p.autoAcceptPct}%</span>
        </div>
      )}

      {o.status === "PENDIENTE" && lock && (
        <div className="mt-3 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900 ring-1 ring-amber-200">
          <p className="flex items-center gap-1 font-semibold"><AlertTriangle size={13} /> Ojo: ya se lo prometiste a otra persona</p>
          <p className="mt-0.5">Ya tenés un acuerdo pendiente con <b>{lock.buyerName}</b> por {fmt(lock.finalAmount ?? lock.amount)} (vence en {mmss(lock.expiresAt - now)}). Como tenés uno solo, primero cobrale o cancelá esa venta.</p>
        </div>
      )}
      {o.status === "PENDIENTE" && !countering && (
        <div className="mt-3 space-y-2">
          <Btn className="w-full py-3 text-base" disabled={!!lock} onClick={() => actions.sellerAccept(o)}><Check size={18} /> Sí, se lo vendo a {fmt(o.amount)}</Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="outline" className="py-2.5 text-sm" disabled={!!lock} onClick={() => setCountering(true)}><ArrowLeftRight size={15} /> Pedirle más</Btn>
            <Btn variant="danger" className="py-2.5 text-sm" onClick={() => actions.sellerReject(o)}><X size={15} /> No, gracias</Btn>
          </div>
        </div>
      )}
      {o.status === "PENDIENTE" && countering && (
        <div className="mt-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
          <p className="text-[12px] font-medium text-zinc-600">¿Cuánto le pedís? (entre {fmt(o.amount + 1000)} y {fmt(p.listPrice)})</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5">
              <span className="text-zinc-400">$</span>
              <input inputMode="numeric" value={counter ? counter.toLocaleString("es-AR") : ""}
                onChange={(e) => setCounter(Number(e.target.value.replace(/\D/g, "")) || 0)}
                className="w-full bg-transparent px-1 text-sm font-semibold outline-none" aria-label="Monto de contraoferta" />
            </div>
            <Btn className="px-3 py-2 text-xs" onClick={() => { actions.sellerCounter(o, counter); setCountering(false); }}>Enviar</Btn>
            <button onClick={() => setCountering(false)} className="p-1 text-zinc-400"><X size={16} /></button>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[0.25, 0.5, 0.75].map((f) => {
              const v = round1k(o.amount + (p.listPrice - o.amount) * f);
              return <button key={f} onClick={() => setCounter(v)} className="rounded-md bg-white px-2 py-1 text-[11px] ring-1 ring-zinc-200">{fmt(v)}</button>;
            })}
          </div>
        </div>
      )}
      {o.status === "ACEPTADA_PENDIENTE_CIERRE" && <DealCard offer={o} product={p} sellerName={sellerName} now={now} actions={actions} compact />}
      {o.status === "ACEPTADA_PENDIENTE_CIERRE" && (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 ring-1 ring-zinc-100">
            {o.closeMode === "externo"
              ? <>🤝 El comprador eligió <b>pagar fuera de la app</b> ({o.delivery}). Coordiná y cerrá cuando verifiques el dinero.</>
              : <>⏳ Esperando el pago del comprador por Mercado Pago. Se marca pagada sola cuando la pasarela lo confirme.</>}
          </p>
          {o.buyerId !== ME.id && o.closeMode !== "externo" && (
            <Btn variant="outline" className="w-full py-2 text-xs"
              onClick={() => { const c = actions.pay({ productId: p.id, offerId: o.id, amount: o.finalAmount, delivery: p.pickupPoints[0] ? "Retiro en " + p.pickupPoints[0] : "A coordinar", method: "Mercado Pago", buyer: { id: o.buyerId, name: o.buyerName }, gatewayVerified: true }); if (c) actions.toast("success", "Pago verificado por la pasarela", `${o.buyerName} pagó ${fmt(o.finalAmount)}.`); }}>
              <Sparkles size={13} /> Demo: simular confirmación de Mercado Pago
            </Btn>
          )}
          {!closing && !releasing && (
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="danger" className="py-2 text-[13px]" onClick={() => setReleasing(true)}><X size={14} /> Cancelar venta</Btn>
              <Btn variant="dark" className="py-2 text-[13px]" onClick={() => setClosing(true)}><Check size={14} /> Ya cobré en persona</Btn>
            </div>
          )}
          {releasing && (
            <div className="rounded-xl bg-zinc-50 p-3 text-[11px] ring-1 ring-zinc-200">
              <p>¿Cancelar la venta con <b>{o.buyerName}</b>? El producto vuelve a estar disponible para otras ofertas.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn variant="outline" className="py-1.5 text-[11px]" onClick={() => setReleasing(false)}>Volver</Btn>
                <Btn variant="danger" className="py-1.5 text-[11px]" onClick={() => { actions.sellerCancelDeal(o); setReleasing(false); }}>Sí, cancelar</Btn>
              </div>
            </div>
          )}
          {closing && (
            <div className="rounded-xl border-2 border-hpred bg-white p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-bold text-hpred"><AlertTriangle size={14} /> Antes de entregar el producto</p>
              <p className="mt-1 text-[12px] leading-snug text-ink">Verificá que el dinero esté acreditado en tu cuenta antes de entregar el producto. No te guíes solo por capturas de pantalla.</p>
              <label className="mt-2 flex items-start gap-2 text-[11px] text-zinc-700">
                <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5 accent-hpred" />
                Confirmo que vi el dinero acreditado en mi cuenta (o lo recibí en efectivo en mano).
              </label>
              <p className="mt-1 text-[10px] text-zinc-400">Queda como «Cobrada en persona» (Haceme Precio no ve ese pago).</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn variant="outline" className="py-1.5 text-[11px]" onClick={() => { setClosing(false); setVerified(false); }}>Volver</Btn>
                <Btn className="py-1.5 text-[11px]" disabled={!verified} onClick={() => { actions.sellerCloseExternal(o); setClosing(false); }}>Cerrar venta</Btn>
              </div>
            </div>
          )}
        </div>
      )}
      {o.status === "ACUERDO_CERRADO_EXTERNO" && (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-[11px] text-ink">🤝 Cerrada fuera de la app · {o.delivery || "entrega a coordinar"} · sin verificación de pasarela</p>
      )}
      {o.status === "CERRADA_PAGADA" && (
        <p className="mt-3 rounded-lg bg-kraft-50 px-3 py-2 text-[11px] text-ink">
          ✅ Pago verificado por pasarela ({o.method}) · {o.delivery} · código <b className="font-mono">{o.code}</b>
        </p>
      )}

      {["ACEPTADA_PENDIENTE_CIERRE", "CERRADA_PAGADA", "ACUERDO_CERRADO_EXTERNO"].includes(o.status) && (
        <button onClick={() => actions.setSheet({ type: "receipt", offerId: o.id })} className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-ink underline">
          <Receipt size={13} /> Ver recibo del acuerdo
        </button>
      )}
      <button onClick={() => setShowLog(!showLog)} className="mt-2.5 flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600">
        <ChevronDown size={12} className={showLog ? "rotate-180" : ""} /> Historial ({o.log.length})
      </button>
      {showLog && (
        <ul className="mt-1.5 space-y-1 border-l-2 border-zinc-100 pl-3">
          {o.log.map((l, i) => (
            <li key={i} className="text-[11px] text-zinc-600"><span className="font-mono text-zinc-400">{clockTime(l.at).slice(0, 5)}</span> {l.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/* Texto para compartir según el canal donde vende la persona */
const CHANNELS = [
  { k: "whatsapp", l: "Estado de WhatsApp", hint: "Pegalo debajo de la foto en tu estado." },
  { k: "instagram", l: "Instagram", hint: "Usalo como texto del posteo o de la historia (con sticker de link)." },
  { k: "marketplace", l: "Marketplace / grupos", hint: "Pegalo en la descripción de tu publicación." },
];
function buildShareCopy(p, channel, tone, showPrice) {
  if (channel === "marketplace") return buildFbCopy(p, tone, showPrice);
  const url = `hacemeprecio.app/p/${p.slug}`;
  const price = showPrice ? fmt(p.listPrice) : "Escucho ofertas";
  const hl = p.highlights.slice(0, 3);
  if (channel === "whatsapp") {
    return `🔥 ${p.title}
💲 ${price} · ${p.condition}
${hl.map((h) => `✅ ${h}`).join("\n")}

👉 Fotos, detalles y ofertas acá: ${url}
(Si ves esto, está disponible 😉)`;
  }
  const tags = { "Tecnología": "#tecnologia #celulares", Hogar: "#hogar #deco #muebles", Ropa: "#ropa #moda #outfit", Deportes: "#deportes #bici", Otros: "#ventas" }[p.category] || "#ventas";
  return `${p.title} ✨
${price} · ${p.condition}

${hl.map((h) => `• ${h}`).join("\n")}

${p.pickupPoints.length ? `📍 Retiro en ${p.pickupPoints[0]}` : ""}${p.shipping.enabled ? "\n🚚 Hago envíos" : ""}

Hacé tu oferta sin vueltas desde el link 👉 ${url}
(o desde el link de mi bio)

#vendo ${tags} #argentina`;
}

function FbGenerator({ product, actions }) {
  const [channel, setChannel] = useState("whatsapp");
  const [tone, setTone] = useState("directo");
  const [showPrice, setShowPrice] = useState(true);
  const text = buildShareCopy(product, channel, tone, showPrice);
  const ch = CHANNELS.find((c) => c.k === channel);
  return (
    <div className="mt-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={13} className="text-hpred" /> ¿Dónde lo vas a compartir?</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {CHANNELS.map((c) => (
          <button key={c.k} onClick={() => setChannel(c.k)} className={`rounded-xl px-2 py-2 text-[12px] font-semibold leading-tight ${channel === c.k ? "bg-ink text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>{c.l}</button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">{ch.hint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {channel === "marketplace" && [{ k: "directo", l: "Directo" }, { k: "amigable", l: "Amigable" }, { k: "urgente", l: "Urgencia" }].map(({ k, l }) => (
          <button key={k} onClick={() => setTone(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone === k ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>{l}</button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[11px] text-zinc-600">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="accent-hpred" /> Mostrar precio
        </label>
      </div>
      <textarea readOnly value={text} rows={12} className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-white p-2.5 font-mono text-[11px] leading-relaxed text-zinc-800 outline-none" onFocus={(e) => e.target.select()} />
      <Btn className="mt-2 w-full py-2.5"
        onClick={async () => {
          const ok = await copyText(text);
          actions.toast(ok ? "success" : "error", ok ? "Texto copiado" : "No se pudo copiar", ok ? ch.hint : "Seleccioná el texto y copialo a mano.");
        }}>
        <Copy size={15} /> Copiar texto
      </Btn>
    </div>
  );
}

function ProductsTab({ products, offers, actions, focusProductId, setFocusProductId, seller }) {
  const url = `hacemeprecio.app/v/${sellerSlug(seller)}`;
  return (
    <div className="space-y-3 px-4 pb-6 pt-3">
      {seller?.plan !== "pase" && products.length > 0 && (
        <div className="rounded-2xl bg-ink p-3.5 text-white">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-kraft"><Store size={13} /> Tu vidriera</p>
          <p className="mt-1 text-[13px] text-zinc-300">Un solo link con todo lo que vendés. Ponelo en tus estados de WhatsApp o en tu perfil.</p>
          <p className="mt-2 truncate font-mono text-[12px]">{url}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn variant="outline" className="py-2 text-sm" onClick={async () => { const ok = await copyText("https://" + url); actions.toast(ok ? "success" : "error", ok ? "Link copiado" : "No se pudo copiar", url); }}><Copy size={14} /> Copiar</Btn>
            <Btn className="py-2 text-sm" onClick={() => actions.openStorefront(seller.id)}><Eye size={14} /> Ver</Btn>
          </div>
        </div>
      )}
      {products.map((p) => (
        <ProductAdminCard key={p.id} product={p} offers={offers.filter((o) => o.productId === p.id)} actions={actions}
          open={focusProductId === p.id} setOpen={(v) => setFocusProductId(v ? p.id : null)} />
      ))}
    </div>
  );
}

function ProductAdminCard({ product: p, offers, actions, open, setOpen }) {
  const [panel, setPanel] = useState(hasVariants(p) ? "stock" : "copy");
  const floorPct = pct(p.floorPrice, p.listPrice);
  const pendingCount = offers.filter((o) => o.status === "PENDIENTE").length;
  const sold = p.status === "vendido";
  return (
    <div className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200">
      <div className="flex gap-3">
        <ProductThumb product={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.title}</p>
          <p className="text-sm font-bold">{fmt(p.listPrice)}{p.compareAt && <span className="ml-1 text-[11px] font-medium text-zinc-400 line-through">{fmt(p.compareAt)}</span>}</p>
          {(hasVariants(p) || p.fixedPrice || p.liquidation) && (
            <p className="text-[11px] text-zinc-500">{p.liquidation ? "🔥 Liquidación · acepta ofertas" : "Precio fijo"}{hasVariants(p) ? ` · ${totalStock(p)} en stock${p.variants.some((v) => v.stock === 0) ? " · talles agotados" : ""}` : ""}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-zinc-500">
            <span className="flex items-center gap-0.5"><Eye size={11} /> {p.views}</span>
            <span className="flex items-center gap-0.5"><HandCoins size={11} /> {offers.length} ofertas</span>
            {pendingCount > 0 && <span className="font-semibold text-hpred">{pendingCount} por responder</span>}
          </div>
        </div>
        <span className={`h-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sold ? "bg-zinc-900 text-white" : "bg-kraft-50 text-hpred-dark ring-1 ring-kraft-200"}`}>
          {sold ? "Vendido" : p.moderation === "pausada" ? "En revisión" : "Activo"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Btn variant="outline" className="py-2 text-[11px]"
          onClick={async () => { const ok = await copyText(`https://hacemeprecio.app/p/${p.slug}`); actions.toast(ok ? "success" : "error", ok ? "Link copiado" : "No se pudo copiar", `hacemeprecio.app/p/${p.slug}`); }}>
          <Link2 size={13} /> Link
        </Btn>
        <Btn variant="outline" className="py-2 text-[11px]" onClick={() => actions.openAsBuyer(p.id)}><Eye size={13} /> Ver</Btn>
        <Btn variant={open ? "dark" : "outline"} className="py-2 text-[11px]" onClick={() => setOpen(!open)}><Pencil size={13} /> {open ? "Cerrar" : "Gestionar"}</Btn>
      </div>

      {open && (
        <>
          <div className="mt-3 flex rounded-lg bg-zinc-100 p-0.5">
            {[...(hasVariants(p) ? [{ k: "stock", l: "Stock por talle" }] : []), { k: "copy", l: "Compartir tu link" }, ...(p.fixedPrice ? [] : [{ k: "rules", l: "Mínimo y venta automática" }])].map(({ k, l }) => (
              <button key={k} onClick={() => setPanel(k)} className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold ${panel === k ? "bg-white shadow-sm" : "text-zinc-500"}`}>{l}</button>
            ))}
          </div>
          {panel === "stock" ? (
            <VariantStockEditor product={p} actions={actions} />
          ) : panel === "copy" ? (
            <ShareKit product={p} actions={actions} />
          ) : (
            <div className="mt-3 space-y-4 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <RuleSlider label="Lo mínimo que aceptás" hint="Si te ofrecen menos, le decimos que no por vos (no lo ve nadie)"
                value={floorPct} min={40} max={Math.min(99, p.autoAcceptPct - 1)} money={p.floorPrice}
                onChange={(v) => actions.updateProduct(p.id, { floorPrice: round1k((p.listPrice * v) / 100) })} />
              <RuleSlider label="Se vende solo desde" hint="Si te ofrecen esto o más, se vende sin preguntarte"
                value={p.autoAcceptPct} min={Math.max(floorPct + 1, 50)} max={99} money={(p.listPrice * p.autoAcceptPct) / 100}
                onChange={(v) => actions.updateProduct(p.id, { autoAcceptPct: v })} />
              <p className="text-[11px] text-zinc-500">Los cambios aplican a las próximas ofertas en tiempo real.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RuleSlider({ label, hint, value, min, max, money, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-xs"><b>{value}%</b> <span className="text-zinc-500">· {fmt(money)}</span></p>
      </div>
      <input type="range" min={min} max={max} value={Math.min(Math.max(value, min), max)} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full" aria-label={label} />
      <p className="text-[10px] text-zinc-500">{hint}</p>
    </div>
  );
}

/* --- carga rápida: la foto se achica en el celular antes de subirla (menos datos, carga más rápida) --- */
async function compressImage(file, max = 1080) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* data:URL → Blob (las fotos ya están comprimidas en el celular) */
function dataUrlToBlob(u) {
  const [head, b64] = u.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* --- IA: arma la publicación a partir de las fotos (+ lo que el vendedor dijo) ---
   En el prototipo usa la capacidad "sample" del artefacto (cuenta de Claude de quien lo abre).
   En producción: Edge Function de Supabase → API de Claude, con la clave en el servidor. */
async function aiDraftListing(sampleFn, photos, spoken, signal) {
  const lim = await sampleFn.limits().catch(() => null);
  const max = lim?.images?.maxCount || 3;
  const images = photos.slice(0, Math.min(max, 4)).map((p) => dataUrlToBlob(p.src));
  const prompt = `Sos el asistente de "Haceme Precio", una app argentina para vender cosas usadas en Facebook Marketplace. Te paso las fotos de un producto que una persona común (no técnica) quiere vender. Armá la publicación.

Reglas:
- Español rioplatense (voseo), simple, cálido y honesto. Nada de exageraciones.
- No inventes datos que no se vean en las fotos ni en lo que contó el vendedor: no inventes memoria, talle, año, medidas exactas ni estado de batería. Si algo no se puede saber, no lo pongas.
- NO sugieras precio.
- Si parece un producto prohibido en Marketplace (armas, medicamentos, animales, alcohol, tabaco, documentos, servicios, cosas digitales), marcalo.

Lo que contó el vendedor (puede estar vacío): """${(spoken || "").slice(0, 1500)}"""

Respondé SOLO con un objeto JSON con esta forma exacta:
{"title": "qué es + marca/modelo si se ve (máx 60 caracteres)", "category": uno de ${JSON.stringify(Object.keys(CATEGORY_ICON))}, "condition": uno de ${JSON.stringify(CONDITIONS)}, "highlights": ["2 a 4 detalles cortos que se vean, máx 40 caracteres c/u"], "description": "2 o 3 oraciones para la publicación", "doubts": "qué conviene que el vendedor confirme, en una frase corta, o vacío", "prohibited": false, "prohibitedReason": ""}`;
  return sampleFn.json(prompt, { images, modelTier: "quick", signal, cache: false });
}

/* --- Dictado: la Tía Norma lo cuenta con la voz --- */
function DictateBox({ dict, value, setValue, placeholder, label }) {
  const [state, setState] = useState("idle");
  const [partial, setPartial] = useState("");
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!dict) return;
    const u1 = dict.onFinal(({ text }) => setValue((v) => (v ? v + text : text.trimStart())));
    const u2 = dict.onPartial(({ text }) => setPartial(text));
    const u3 = dict.onState(({ state: st, reason }) => {
      setState(st);
      if (st === "idle") setPartial("");
      if (reason === "not_granted" || reason === "unavailable") setGone(true);
    });
    return () => { u1(); u2(); u3(); if (dict.active()) dict.stop(); };
  }, [dict]);
  const listening = state === "listening" || state === "starting";
  const toggle = () => {
    if (listening) { dict.stop(); return; }
    dict.start({ language: "es" }).catch((e) => { if (e?.code === "not_granted" || e?.code === "unavailable") setGone(true); });
  };
  return (
    <div>
      {label && <p className="text-sm font-semibold text-ink">{label}</p>}
      <div className="mt-1 rounded-2xl border border-zinc-300 bg-white p-2 focus-within:border-zinc-900">
        <textarea value={value + (partial ? (value ? " " : "") + partial : "")} onChange={(e) => setValue(e.target.value)} rows={3} placeholder={placeholder}
          className="w-full resize-none bg-transparent px-1 text-sm outline-none" />
        {dict && !gone && (
          <button type="button" onClick={toggle}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[14px] font-semibold ${listening ? "bg-hpred text-white" : "bg-zinc-100 text-ink"}`}>
            {listening ? <><Square size={14} className="fill-white" /> Escuchando… tocá para terminar</> : <><Mic size={17} /> Decilo con tu voz</>}
          </button>
        )}
      </div>
    </div>
  );
}

const guessCategory = (t) => {
  const s = t.toLowerCase();
  if (/(iphone|celu|samsung|motorola|xiaomi|notebook|laptop|tablet|ipad|play|ps[345]|xbox|tv|monitor|auricular|airpods|parlante|cámara|camara|consola|smart)/.test(s)) return "Tecnología";
  if (/(sill[oó]n|sof[aá]|mesa|silla|cama|colch[oó]n|placard|ropero|heladera|lavarropas|microondas|l[aá]mpara|escritorio|biblioteca|mueble|horno)/.test(s)) return "Hogar";
  if (/(remera|campera|zapatilla|jean|vestido|buzo|pantal[oó]n|botas|cartera|mochila|ropa|top|morley|blusa|pollera|short|calza|camisa|sweater|tapado|bikini)/.test(s)) return "Ropa";
  if (/(bici|bicicleta|pesas|mancuerna|cinta|raqueta|pelota|skate|roller|monopat[ií]n|gimnasio)/.test(s)) return "Deportes";
  return "Otros";
};

function CreateTab({ actions, seller, products }) {
  const last = products[0];
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(0);
  const [condition, setCondition] = useState(seller?.isStore ? "Nuevo - Sin uso" : "Usado - Como nuevo");
  const [category, setCategory] = useState(seller?.isStore ? "Ropa" : null);
  const [floorPct, setFloorPct] = useState(85);
  const [autoPct, setAutoPct] = useState(93);
  const [adjust, setAdjust] = useState(false);
  const [shipping, setShipping] = useState(last?.shipping?.enabled ?? seller?.store?.shipping?.enabled ?? true);
  const [pickup, setPickup] = useState(last?.pickupPoints?.[0] || (seller?.store?.address ? `Local ${seller.name} · ${seller.store.address}` : ""));
  const [more, setMore] = useState(false);
  const [highlights, setHighlights] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState(1);
  const isStoreSeller = !!seller?.isStore;
  const [sizeSet, setSizeSet] = useState("Ropa");
  const [sizes, setSizes] = useState([]);
  const [vColors, setVColors] = useState([]);
  const [vStock, setVStock] = useState({});
  const [liquid, setLiquid] = useState(false);
  const toggleIn = (arr, setArr, x) => setArr(arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  const combos = (vColors.length ? vColors : ["Único"]).flatMap((c) => sizes.map((z) => ({ id: `${c}-${z}`, color: c === "Único" ? "" : c, size: z })));
  const [sampleFn, setSampleFn] = useState(null);
  const [dict, setDict] = useState(null);
  const [ai, setAi] = useState({ status: "idle" });
  const [aiInfo, setAiInfo] = useState(null);
  const aiCtl = useRef(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!window.claude?.use) return;
      const smp = await window.claude.use("sample").catch(() => null);
      if (smp && alive) {
        const lim = await smp.limits().catch(() => null);
        if (lim?.images && alive) setSampleFn(() => smp);
      }
      const d = await window.claude.use("dictation").catch(() => null);
      if (d && alive) setDict(d);
    })();
    return () => { alive = false; aiCtl.current?.abort(); };
  }, []);
  const runAI = async () => {
    if (!sampleFn || !photos.length || seller?.plan !== "pro") return;
    const ctl = new AbortController();
    aiCtl.current = ctl;
    setAi({ status: "thinking" });
    try {
      const r = await aiDraftListing(sampleFn, photos, description, ctl.signal);
      const hl = Array.isArray(r?.highlights) ? r.highlights.map(String).filter(Boolean).slice(0, 4) : [];
      if (r?.title) setTitle(String(r.title).slice(0, 80));
      if (Object.keys(CATEGORY_ICON).includes(r?.category)) setCategory(r.category);
      if (CONDITIONS.includes(r?.condition)) setCondition(r.condition);
      if (hl.length) setHighlights(hl.join(", "));
      if (r?.description) setDescription(String(r.description).slice(0, 600));
      setAiInfo({ doubts: String(r?.doubts || ""), prohibited: r?.prohibited === true, reason: String(r?.prohibitedReason || "") });
      setMore(true);
      setAi({ status: "idle" });
      setStep(2);
      actions.toast("success", "✨ Listo, la IA armó tu publicación", "Revisá que esté todo bien y poné el precio.");
    } catch (e) {
      const code = e?.code;
      setAi({ status: "idle" });
      if (code === "cancelled") return;
      if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "images_unavailable"].includes(code)) {
        setSampleFn(null);
        actions.toast("info", "La IA no está disponible acá", "Completalo a mano, son 3 datos.");
      } else if (code === "rate_limited") actions.toast("error", "Muchos pedidos seguidos", "Probá de nuevo en un rato.");
      else if (code === "image_rejected") actions.toast("error", "No pudimos leer la foto", "Probá con otra foto.");
      else if (code === "refused") actions.toast("error", "No pudimos analizar esta foto", "Completalo a mano.");
      else actions.toast("error", "No salió esta vez", "Podés probar de nuevo o completarlo a mano.");
    }
  };
  const camRef = useRef(null);
  const isPass = seller?.plan === "pase";
  const passUsed = isPass && products.some((x) => x.status !== "vendido");
  const galRef = useRef(null);
  const cat = category || guessCategory(title);
  const floor = round1k((price * floorPct) / 100);
  const auto = Math.ceil((price * autoPct) / 100);

  const addFiles = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/")).slice(0, 6 - photos.length);
    if (!list.length) return;
    setBusy(true);
    try {
      const out = [];
      for (const f of list) out.push(await compressImage(f));
      setPhotos((p) => [...p, ...out.map((src, k) => ({ src, label: `Foto ${p.length + k + 1}`, sub: "" }))]);
    } catch {
      actions.toast("error", "No pudimos leer la foto", "Probá con otra imagen.");
    } finally {
      setBusy(false);
    }
  };
  const removePhoto = (k) => setPhotos((p) => p.filter((_, i) => i !== k));
  const makeCover = (k) => setPhotos((p) => [p[k], ...p.filter((_, i) => i !== k)]);

  const publish = () => {
    actions.createProduct({
      title: title.trim(),
      category: cat,
      condition,
      listPrice: price,
      floorPrice: floor,
      autoAcceptPct: autoPct,
      shipping: { enabled: shipping, note: shipping ? "A coordinar, a cargo del comprador" : "Solo retiro" },
      pickupPoints: pickup.trim() ? [pickup.trim()] : [],
      acceptsSwap: false,
      highlights: highlights.split(",").map((x) => x.trim()).filter(Boolean).length
        ? highlights.split(",").map((x) => x.trim()).filter(Boolean)
        : [condition],
      description: description.trim() || "Mirá las fotos y hacé tu oferta formal. Si entra en lo que acepto, se aprueba al instante.",
      photos: photos.map((ph, k) => ({ ...ph, label: k === 0 ? "Portada" : `Foto ${k + 1}` })),
      stock: isPass ? 1 : stock,
      ...(isStoreSeller ? {
        fixedPrice: !liquid, liquidation: liquid, collection: liquid ? "Liquidación" : cat === "Ropa" ? "Nuevos ingresos" : cat,
        ...(combos.length ? { variants: combos.map((v) => ({ ...v, color: v.color || "Único", stock: vStock[v.id] ?? 2 })) } : {}),
      } : {}),
    });
  };

  const Steps = () => (
    <div className="mb-4 flex items-center gap-1.5">
      {["Foto", "Precio", "¡Listo!"].map((l, k) => (
        <div key={l} className="flex flex-1 flex-col gap-1">
          <div className={`h-1.5 rounded-full ${step > k ? "bg-hpred" : "bg-zinc-200"}`} />
          <span className={`text-[10px] font-semibold ${step === k + 1 ? "text-ink" : "text-zinc-400"}`}>{k + 1}. {l}</span>
        </div>
      ))}
    </div>
  );
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-900";

  if (passUsed) {
    return (
      <div className="px-4 pb-8 pt-2">
        <div className="rounded-3xl bg-kraft-50 p-5 text-center ring-1 ring-kraft-200">
          <p className="font-display text-lg font-extrabold">Tu plan es para vender una sola cosa</p>
          <p className="mt-1 text-sm text-zinc-600">Ya tenés una publicación activa. Si querés vender más cosas, pasate a «{PLANS.mensual.name}».</p>
          <Btn className="mt-4 w-full py-3.5" onClick={() => actions.upgradeToMonthly(seller.id)}>Vender más cosas · {fmt(SUB_PRICE)}/mes</Btn>
          <p className="mt-2 text-[11px] text-zinc-500">Publicaciones sin límite, tu vidriera y varias unidades del mismo producto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-1">
      <Steps />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      {step === 1 && (
        <div>
          {photos.length === 0 ? (
            <button onClick={() => camRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-kraft bg-kraft-50 px-4 py-10 text-center transition active:scale-[0.99]">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-hpred text-white shadow-lg"><Camera size={30} /></span>
              <span className="mt-3 font-display text-lg font-extrabold">Sacale una foto</span>
              <span className="mt-0.5 text-xs text-zinc-600">Abre la cámara del celular. Con luz natural vende más.</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((ph, k) => (
                <div key={k} className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-zinc-200">
                  <img src={ph.src} alt="" className="h-full w-full object-cover" />
                  {k === 0 ? (
                    <span className="absolute bottom-1 left-1 rounded bg-hpred px-1.5 py-px text-[9px] font-bold uppercase text-white">Portada</span>
                  ) : (
                    <button onClick={() => makeCover(k)} className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-px text-[9px] font-semibold text-ink">Hacer portada</button>
                  )}
                  <button onClick={() => removePhoto(k)} aria-label="Quitar foto" className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-zinc-700"><Trash2 size={12} /></button>
                </div>
              ))}
              {photos.length < 6 && (
                <button onClick={() => camRef.current?.click()} className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-zinc-500">
                  <Camera size={20} /><span className="mt-1 text-[10px] font-medium">Otra foto</span>
                </button>
              )}
            </div>
          )}
          {busy && <p className="mt-3 text-center text-xs text-zinc-500">Optimizando foto…</p>}
          <button onClick={() => galRef.current?.click()} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200">
            <ImagePlus size={16} /> Elegir de la galería
          </button>
          <p className="mt-2 text-center text-[11px] text-zinc-400">Hasta 6 fotos · {photos.length}/6</p>
          {photos.length > 0 && dict && (
            <div className="mt-4">
              <DictateBox dict={dict} value={description} setValue={setDescription} label="¿Querés contarlo? (opcional)"
                placeholder="Ej: es un sillón de dos cuerpos, lo usé dos años, está impecable…" />
            </div>
          )}
          {photos.length > 0 && seller?.plan !== "pro" && (
            <button onClick={() => actions.upgradePlan(seller.id, "pro")}
              className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-kraft bg-kraft-50 px-4 py-3 text-left">
              <Wand2 size={22} className="shrink-0 text-ink" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[15px] font-extrabold text-ink">Completar con IA <span className="rounded bg-ink px-1.5 py-px text-[10px] font-bold text-white">PRO</span></span>
                <span className="block text-[12px] text-zinc-600">¿Vendés seguido? La IA arma la publicación desde tus fotos. {fmt(PRO_PRICE)}/mes.</span>
              </span>
            </button>
          )}
          {photos.length > 0 && sampleFn && seller?.plan === "pro" && (
            ai.status === "thinking" ? (
              <div className="mt-4 rounded-2xl bg-ink p-4 text-center text-white">
                <Wand2 size={26} className="mx-auto animate-pulse text-kraft" />
                <p className="mt-2 font-display text-lg font-extrabold">Mirando tus fotos…</p>
                <p className="text-[12px] text-zinc-300">La IA está armando el título y la descripción.</p>
                <button onClick={() => aiCtl.current?.abort()} className="mt-2 text-[12px] underline">Cancelar</button>
              </div>
            ) : (
              <button onClick={runAI} disabled={busy}
                className="mt-4 flex w-full flex-col items-center rounded-2xl bg-gradient-to-br from-kraft to-kraft-200 px-4 py-4 text-ink shadow-sm ring-1 ring-kraft transition active:scale-[0.99] disabled:opacity-50">
                <span className="flex items-center gap-2 text-[17px] font-extrabold"><Wand2 size={20} /> Completar con IA</span>
                <span className="mt-0.5 text-[12px]">Mira tus fotos y escribe la publicación por vos</span>
              </button>
            )
          )}
          <Btn variant={sampleFn && seller?.plan === "pro" ? "outline" : "primary"} className="mt-3 w-full py-3.5" disabled={!photos.length || busy || ai.status === "thinking"} onClick={() => setStep(2)}>
            {sampleFn && seller?.plan === "pro" ? "Prefiero completarlo yo" : "Siguiente"}
          </Btn>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto hp-scroll">
            {photos.map((ph, k) => <img key={k} src={ph.src} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200" />)}
          </div>
          <div>
            {aiInfo && (
              <div className={`mb-3 rounded-2xl p-3 text-[12px] leading-snug ring-1 ${aiInfo.prohibited ? "bg-rose-50 text-rose-800 ring-rose-200" : "bg-kraft-50 text-ink ring-kraft-200"}`}>
                <p className="flex items-center gap-1.5 font-bold"><Wand2 size={14} /> {aiInfo.prohibited ? "Ojo: esto podría no estar permitido en Marketplace" : "Lo completó la IA. Revisá que esté bien."}</p>
                {aiInfo.prohibited && aiInfo.reason && <p className="mt-1">{aiInfo.reason}</p>}
                {aiInfo.doubts && <p className="mt-1">💡 Confirmá: {aiInfo.doubts}</p>}
              </div>
            )}
            <label className="text-sm font-semibold text-ink">¿Qué es?</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: PlayStation 5 con 2 joysticks" className={input} autoFocus />
            {title.length > 2 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.keys(CATEGORY_ICON).map((c) => (
                  <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${cat === c ? "bg-ink text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>{c}</button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold text-ink">¿Cuánto pedís?</label>
            <div className="mt-1 flex items-center rounded-2xl border-2 border-zinc-900 bg-white px-3 py-2">
              <span className="text-xl text-zinc-400">$</span>
              <input inputMode="numeric" value={price ? price.toLocaleString("es-AR") : ""} placeholder="0"
                onChange={(e) => setPrice(Number(e.target.value.replace(/\D/g, "")) || 0)} className="w-full bg-transparent px-1 text-2xl font-bold outline-none" />
            </div>
          </div>
          {isStoreSeller && (
            <div className="space-y-3 rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200">
              <div>
                <p className="text-sm font-semibold text-ink">Talles</p>
                <div className="mt-1.5 flex gap-1.5">
                  {Object.keys(SIZE_SETS).map((k) => (
                    <button key={k} onClick={() => { setSizeSet(k); setSizes(k === "Único" ? ["Único"] : []); }} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sizeSet === k ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}>{k === "Ropa" ? "XS a XL" : k === "Pantalones" ? "36 a 44" : "Talle único"}</button>
                  ))}
                </div>
                {sizeSet !== "Único" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {SIZE_SETS[sizeSet].map((z) => (
                      <button key={z} onClick={() => toggleIn(sizes, setSizes, z)} className={`h-10 min-w-10 rounded-xl px-2 text-sm font-bold ${sizes.includes(z) ? "bg-hpred text-white" : "bg-white ring-1 ring-zinc-300"}`}>{z}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Colores <span className="font-normal text-zinc-500">(opcional)</span></p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.keys(COLOR_HEX).map((c) => (
                    <button key={c} onClick={() => toggleIn(vColors, setVColors, c)} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${vColors.includes(c) ? "bg-ink text-white" : "bg-white ring-1 ring-zinc-300"}`}>
                      <span className="h-3 w-3 rounded-full ring-1 ring-zinc-300" style={{ background: COLOR_HEX[c] }} /> {c}
                    </button>
                  ))}
                </div>
              </div>
              {combos.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-ink">¿Cuántas tenés de cada una?</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {combos.map((v) => {
                      const n = vStock[v.id] ?? 2;
                      return (
                        <div key={v.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-2 py-1.5 ring-1 ring-zinc-200">
                          <span className="text-[12px] font-semibold">{[v.color, v.size].filter(Boolean).join(" · ")}</span>
                          <span className="flex items-center gap-1">
                            <button onClick={() => setVStock((m) => ({ ...m, [v.id]: Math.max(0, n - 1) }))} className="h-7 w-7 rounded-md font-bold ring-1 ring-zinc-300">−</button>
                            <span className="w-5 text-center text-[13px] font-bold">{n}</span>
                            <button onClick={() => setVStock((m) => ({ ...m, [v.id]: n + 1 }))} className="h-7 w-7 rounded-md font-bold ring-1 ring-zinc-300">+</button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {!isPass && !isStoreSeller && (
            <div>
              <label className="text-sm font-semibold text-ink">¿Cuántos tenés?</label>
              <div className="mt-1 flex items-center gap-3">
                <button onClick={() => setStock((n) => Math.max(1, n - 1))} className="h-12 w-12 rounded-2xl bg-white text-2xl font-bold ring-1 ring-zinc-300" aria-label="Uno menos">−</button>
                <span className="w-10 text-center text-2xl font-extrabold">{stock}</span>
                <button onClick={() => setStock((n) => Math.min(99, n + 1))} className="h-12 w-12 rounded-2xl bg-white text-2xl font-bold ring-1 ring-zinc-300" aria-label="Uno más">+</button>
                <span className="text-[12px] text-zinc-500">{stock === 1 ? "Uno solo" : "Ideal para ropa o cosas repetidas"}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-semibold text-ink">¿En qué estado está?</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {CONDITIONS.map((c) => (
                <button key={c} onClick={() => setCondition(c)} className={`rounded-xl px-2 py-2 text-[11px] font-medium ${condition === c ? "bg-ink text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1.3fr] gap-2">
            <Btn variant="outline" className="py-3" onClick={() => setStep(1)}>Atrás</Btn>
            <Btn className="py-3" disabled={title.trim().length < 3 || price < 1000} onClick={() => setStep(3)}>Siguiente</Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
            <img src={photos[0].src} alt="" className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="text-lg font-bold">{fmt(price)}</p>
            </div>
          </div>

          {isStoreSeller && (
            <div className="rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200">
              <p className="text-sm font-semibold">💲 Precio fijo: {fmt(price)}</p>
              <p className="mt-0.5 text-[12px] text-zinc-500">Tus clientes eligen talle y tocan «Lo quiero». Sin regateo.</p>
              <div className="mt-3"><Toggle label="🔥 Es liquidación: aceptar ofertas" checked={liquid} onChange={setLiquid} /></div>
            </div>
          )}
          <div className={`rounded-2xl bg-kraft-50 p-3.5 ring-1 ring-kraft-200 ${isStoreSeller && !liquid ? "hidden" : ""}`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold"><Zap size={13} className="text-hpred" /> Así te cuidamos las ofertas</p>
            <div className="mt-2 space-y-1 text-[12px] text-zinc-700">
              <p>🙅 Si te ofrecen menos de <b>{fmt(floor)}</b>, le decimos que no por vos.</p>
              <p>🎉 Si te ofrecen <b>{fmt(auto)}</b> o más, se vende solo.</p>
              <p>📲 Si es algo en el medio, te avisamos al celu para que decidas.</p>
            </div>
            <button onClick={() => setAdjust(!adjust)} className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-ink underline"><Settings2 size={12} /> {adjust ? "Listo" : "Cambiar estos números"}</button>
            {adjust && (
              <div className="mt-3 space-y-3">
                <RuleSlider label="Lo mínimo que aceptás" hint="El comprador no lo ve" value={floorPct} min={40} max={autoPct - 1} money={floor} onChange={setFloorPct} />
                <RuleSlider label="Se vende solo desde" hint="Desde acá se aprueba sola" value={autoPct} min={floorPct + 1} max={99} money={auto} onChange={setAutoPct} />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-2xl bg-white p-3.5 ring-1 ring-zinc-200">
            <Toggle label="Hago envíos (a cargo del comprador)" checked={shipping} onChange={setShipping} />
            <div>
              <label className="text-xs font-medium text-zinc-600">Punto de retiro</label>
              <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Ej: Palermo · Plaza Italia" className={input} />
            </div>
          </div>

          <button onClick={() => setMore(!more)} className="flex w-full items-center justify-between text-xs font-semibold text-zinc-600">
            Agregar detalles (opcional) <ChevronDown size={14} className={more ? "rotate-180" : ""} />
          </button>
          {more && (
            <div className="space-y-3">
              <input value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="Destacados, separados por coma: Con caja, Garantía…" className={input} />
              <DictateBox dict={dict} value={description} setValue={setDescription} placeholder="Por qué lo vendés, estado real, qué incluye…" />
            </div>
          )}

          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Btn variant="outline" className="py-3.5" onClick={() => setStep(2)}>Atrás</Btn>
            <Btn className="py-3.5" onClick={publish}><Check size={16} /> Publicar ahora</Btn>
          </div>
          <p className="text-center text-[11px] text-zinc-400">Después te damos el texto listo para pegar en Marketplace.</p>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`relative h-6 w-10 rounded-full transition ${checked ? "bg-hpred" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}


/* ============================================================
   LOGIN DE VENDEDORES (código por email, sin contraseñas)
   ============================================================ */
const DEMO_OTP = "482913";

function SellerLogin({ sellers, now, actions, intent, onHome }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [plan, setPlan] = useState(intent?.plan || "mensual");
  const [code, setCode] = useState("");
  const [target, setTarget] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900";

  const requestCode = (e) => {
    e?.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return actions.toast("error", "Email inválido", "Revisá cómo lo escribiste.");
    const sl = sellers.find((x) => x.email.toLowerCase() === em);
    if (!sl) return setStep("signup");
    setTarget(sl);
    setCode("");
    setStep("otp");
  };

  const verify = (e) => {
    e?.preventDefault();
    if (code !== DEMO_OTP) return actions.toast("error", "Código incorrecto", "Probá de nuevo o pedí uno nuevo.");
    const acc = actions.loginSeller(target.id);
    if (!acc.allowed) {
      setBlocked(acc);
      setStep("blocked");
    }
  };

  const payAndEnter = () => {
    actions.registerPayment(target.id, "Mercado Pago");
    actions.loginSeller(target.id, { ...target, status: "activa", periodEnd: Math.max(now, target.periodEnd) + 30 * DAY });
    actions.toast("success", "Pago aprobado", `Plan activo por 30 días · ${fmt(SUB_PRICE)}`);
  };

  const createAccount = (e) => {
    e.preventDefault();
    const sl = actions.registerSeller(email.trim().toLowerCase(), name.trim(), plan);
    actions.loginSeller(sl.id, sl);
    actions.toast("success", plan === "tienda" ? "¡Cuenta creada! Armemos tu tienda" : "¡Listo, ya podés vender!", plan === "pase"
      ? `Pagaste ${fmt(PASS_PRICE)} una sola vez: tu publicación dura ${PASS_DAYS} días.`
      : `Tenés ${TRIAL_DAYS} días gratis. Después, ${fmt(PLANS[plan].price)}/mes.`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white px-6 pb-6 pt-10 hp-scroll">
      <img src={LOGO_PERFIL} alt="" className="mx-auto h-20 w-20" />
      <img src={LOGO_HORIZ} alt="Haceme Precio" className="mx-auto mt-4 h-8 w-auto" />

      {step === "email" && (
        <form onSubmit={requestCode} className="mt-8">
          {onHome && <button type="button" onClick={onHome} className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-zinc-500"><ChevronLeft size={16} /> Volver al inicio</button>}
          {intent?.plan ? (
            <>
              <p className="inline-flex rounded-full bg-kraft-100 px-3 py-1 text-[12px] font-semibold text-ink">Plan elegido: {PLANS[intent.plan]?.name}</p>
              <h1 className="mt-2 font-display text-xl font-extrabold">Creá tu cuenta en 1 minuto</h1>
              <p className="mt-1 text-sm text-zinc-500">Poné tu email y te mandamos un código. Sin contraseñas, sin hablar con nadie.</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-extrabold">Ingresá a tu panel</h1>
              <p className="mt-1 text-sm text-zinc-500">Sin contraseñas: te mandamos un código de 6 dígitos.</p>
            </>
          )}
          <label className="mt-5 block text-xs font-medium text-zinc-600">Tu email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@gmail.com" className={input} autoComplete="email" />
          <Btn type="submit" className="mt-3 w-full py-3.5"><Mail size={16} /> Enviarme el código</Btn>
          <div className="mt-6 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Cuentas de demo</p>
            <div className="mt-2 space-y-1.5">
              {sellers.map((x) => {
                const a = subAccess(x, now);
                return (
                  <button type="button" key={x.id} onClick={() => setEmail(x.email)} className="flex w-full items-center justify-between rounded-lg bg-white px-2.5 py-2 text-left ring-1 ring-zinc-200 hover:ring-zinc-400">
                    <span className="min-w-0"><span className="block text-xs font-medium">{x.name}</span><span className="block truncate font-mono text-[10px] text-zinc-500">{x.email}</span></span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ring-1 ${SUB_STYLE[a.key].cls}`}>{SUB_STYLE[a.key].label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-zinc-400">O escribí un email nuevo para crear una cuenta con prueba gratis.</p>
          </div>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verify} className="mt-8">
          <h1 className="font-display text-xl font-extrabold">Revisá tu email</h1>
          <p className="mt-1 text-sm text-zinc-500">Mandamos un código a <b className="text-zinc-800">{target.email}</b>. Vence en 10 minutos.</p>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••"
            className="mt-5 w-full rounded-xl border-2 border-zinc-900 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none" aria-label="Código" />
          <p className="mt-2 rounded-lg bg-kraft-50 px-3 py-2 text-center text-[12px] text-zinc-700 ring-1 ring-kraft-200">Demo: el código es <b className="font-mono">{DEMO_OTP}</b></p>
          <Btn type="submit" className="mt-3 w-full py-3.5" disabled={code.length !== 6}><KeyRound size={16} /> Ingresar</Btn>
          <button type="button" onClick={() => setStep("email")} className="mt-3 w-full text-center text-xs text-zinc-500 underline">Usar otro email</button>
        </form>
      )}

      {step === "signup" && (
        <form onSubmit={createAccount} className="mt-8">
          <h1 className="font-display text-xl font-extrabold">Creá tu cuenta</h1>
          <p className="mt-1 text-sm text-zinc-500"><b className="text-zinc-800">{email}</b> todavía no está registrado.</p>
          <label className="mt-5 block text-xs font-medium text-zinc-600">Tu nombre (lo ven los compradores)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Lucas G." className={input} />
          <p className="mt-5 text-sm font-semibold text-ink">¿Qué vas a vender?</p>
          <div className="mt-2 space-y-2">
            {[
              { k: "pase", t: "Una sola cosa", d: `Pagás ${fmt(PASS_PRICE)} una vez y tu publicación dura ${PASS_DAYS} días.`, e: "🏷️" },
              { k: "mensual", t: "Vendo seguido", d: `Ropa, reventa o muchas cosas. ${TRIAL_DAYS} días gratis, después ${fmt(SUB_PRICE)}/mes.`, e: "🛍️" },
              { k: "pro", t: "Pro · con IA", d: `Vendés seguido y querés que la IA arme tus publicaciones desde las fotos. ${TRIAL_DAYS} días gratis, después ${fmt(PRO_PRICE)}/mes.`, e: "✨" },
              { k: "tienda", t: "Tengo un local", d: `Precio fijo, talles y colores, carrito y pedidos. ${TRIAL_DAYS} días gratis, después ${fmt(TIENDA_PRICE)}/mes.`, e: "🏬" },
            ].map((o) => (
              <button type="button" key={o.k} onClick={() => setPlan(o.k)}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left ${plan === o.k ? "border-hpred bg-kraft-50" : "border-zinc-200 bg-white"}`}>
                <span className="text-2xl">{o.e}</span>
                <span><span className="block text-base font-bold">{o.t}</span><span className="block text-[12px] leading-snug text-zinc-600">{o.d}</span></span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">Podés cambiar de plan cuando quieras.</p>
          <Btn type="submit" className="mt-3 w-full py-3.5" disabled={name.trim().length < 2}>
            {plan === "pase" ? <><Wallet size={16} /> Pagar {fmt(PASS_PRICE)} y empezar</> : <><UserPlus size={16} /> Empezar gratis</>}
          </Btn>
          <button type="button" onClick={() => setStep("email")} className="mt-3 w-full text-center text-xs text-zinc-500 underline">Volver</button>
        </form>
      )}

      {step === "blocked" && (
        <div className="mt-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hpred text-white"><Lock size={22} /></div>
          {blocked.key === "suspendida" ? (
            <>
              <h1 className="mt-3 font-display text-xl font-extrabold">Tu cuenta está suspendida</h1>
              <p className="mt-1 text-sm text-zinc-600">El administrador pausó tu cuenta{target.note ? `: ${target.note}` : ""}. Tus links muestran «publicación pausada».</p>
              <p className="mt-3 text-sm text-zinc-600">Escribinos a <b>soporte@hacemeprecio.app</b> para revisarlo.</p>
            </>
          ) : (
            <>
              <h1 className="mt-3 font-display text-xl font-extrabold">Tu plan está vencido</h1>
              <p className="mt-1 text-sm text-zinc-600">Pasaron los {GRACE_DAYS} días de gracia sin pago, así que pausamos tu panel y tus links. Tus publicaciones y ofertas siguen guardadas.</p>
              <Btn className="mt-4 w-full py-3.5" onClick={payAndEnter}><Wallet size={16} /> Pagar {fmt(SUB_PRICE)} con Mercado Pago</Btn>
              <p className="mt-2 text-center text-[11px] text-zinc-400">Pago simulado · se reactiva al instante</p>
            </>
          )}
          <button type="button" onClick={() => setStep("email")} className="mt-4 w-full text-center text-xs text-zinc-500 underline">Volver</button>
        </div>
      )}
    </div>
  );
}

function AccountTab({ seller, now, actions, reviews = [], tickets = [], products = [] }) {
  const acc = subAccess(seller, now);
  return (
    <div className="space-y-3 px-4 pb-8 pt-3">
      <div className="rounded-2xl bg-ink p-4 text-white">
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-400">Tu plan: <b className="text-white">{PLANS[seller.plan || "mensual"].name}</b></p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${SUB_STYLE[acc.key].cls}`}>{SUB_STYLE[acc.key].label}</span>
        </div>
        <p className="mt-1 font-display text-2xl font-extrabold">{fmt(PLANS[seller.plan || "mensual"].price)}<span className="text-sm font-medium text-zinc-400">{PLANS[seller.plan || "mensual"].per}</span></p>
        <p className="mt-1 text-xs text-zinc-300">
          {acc.key === "gracia"
            ? `Venció el ${fmtDate(seller.periodEnd)}. Tenés ${acc.daysLeft} día(s) de gracia.`
            : `${acc.key === "prueba" ? "La prueba termina" : "Se renueva"} el ${fmtDate(seller.periodEnd)} · faltan ${acc.daysLeft} día(s)`}
        </p>
        {seller.plan === "pase" ? (
          <>
            <p className="mt-2 text-[12px] text-zinc-300">Tu publicación dura hasta el {fmtDate(seller.periodEnd)}. No se renueva sola.</p>
            <Btn className="mt-3 w-full py-3" onClick={() => actions.upgradeToMonthly(seller.id)}>
              <Wallet size={16} /> Vender más cosas · {fmt(SUB_PRICE)}/mes
            </Btn>
            <p className="mt-2 text-center text-[10px] text-zinc-500">Publicaciones sin límite, vidriera y stock</p>
          </>
        ) : (
          <>
            <Btn className="mt-3 w-full py-3" onClick={() => { actions.registerPayment(seller.id, "Mercado Pago"); actions.toast("success", "Pago aprobado", "Sumamos 30 días a tu plan."); }}>
              <Wallet size={16} /> {acc.key === "prueba" ? "Activar plan" : acc.key === "gracia" ? "Pagar ahora" : "Adelantar un mes"} · {fmt(planOf(seller).price)}
            </Btn>
            <p className="mt-2 text-center text-[10px] text-zinc-500">Débito automático con Mercado Pago (simulado)</p>
            {seller.plan !== "pro" && (
              <button onClick={() => actions.upgradePlan(seller.id, "pro")} className="mt-3 w-full rounded-xl bg-white/10 p-3 text-left ring-1 ring-white/20">
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-kraft"><Wand2 size={14} /> Pasate a Pro · {fmt(PRO_PRICE)}/mes</p>
                <p className="mt-0.5 text-[11px] text-zinc-300">Sacás la foto y la IA escribe el título, la descripción y los detalles por vos.</p>
              </button>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pagos</p>
        {seller.payments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Todavía no hiciste pagos.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {[...seller.payments].reverse().map((p, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2"><Receipt size={14} className="text-zinc-400" /> {fmtDate(p.at)} · {p.via}</span>
                <b>{fmt(p.amount)}</b>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PlanManager seller={seller} now={now} actions={actions} />
      {seller.isStore && <StoreProfileEditor seller={seller} actions={actions} />}
      {seller.isStore && <PromoEditor seller={seller} products={products} now={now} actions={actions} />}
      {seller.isStore && <StoreFaqEditor seller={seller} actions={actions} />}
      {!seller.isStore && seller.plan !== "pase" && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-dashed ring-zinc-300">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Lock size={13} /> Plan Tienda</p>
          <p className="mt-1 text-[13px] text-zinc-600">¿Vendés seguido? Con el plan Tienda armás <b>promos con fecha</b>, ofrecés <b>envío gratis</b> desde un monto y cargás <b>tus propias preguntas frecuentes</b>. Lo cambiás en «Tu plan».</p>
        </div>
      )}
      {!seller.phoneVerified && <PhoneVerify seller={seller} actions={actions} />}
      <SellerReputation seller={seller} reviews={reviews} actions={actions} />
      <NotifSettings seller={seller} actions={actions} />
      <HelpCenter seller={seller} tickets={tickets} actions={actions} />

      <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Sesión</p>
        <p className="mt-2 text-sm"><b>{seller.name}</b> · <span className="font-mono text-xs text-zinc-500">{seller.email}</span></p>
        <Btn variant="outline" className="mt-3 w-full py-2.5" onClick={actions.logout}><LogOut size={15} /> Cerrar sesión</Btn>
      </div>
      <div className="rounded-2xl bg-amber-50 p-4 text-[12px] leading-snug text-amber-900 ring-1 ring-amber-200">
        <p className="flex items-center gap-1.5 font-semibold"><ShieldCheck size={14} /> Vendé seguro</p>
        <p className="mt-1">Si cobrás fuera de la app, verificá que el dinero esté acreditado en tu cuenta antes de entregar. No te guíes solo por capturas de pantalla: se falsifican en segundos.</p>
      </div>
      <p className="px-2 text-center text-[10px] leading-relaxed text-zinc-400">Haceme Precio es una herramienta de gestión de ofertas y condiciones comerciales entre partes. No actúa como intermediario financiero ni garantiza entregas físicas.</p>
    </div>
  );
}

function PausedListing({ product }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-white px-8 text-center">
      <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-8 w-auto" />
      <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><PauseCircle size={28} /></div>
      <h1 className="mt-4 font-display text-lg font-extrabold">Publicación pausada</h1>
      <p className="mt-1 text-sm text-zinc-500">«{product.title}» {product.moderation === "pausada" ? "está en revisión por nuestro equipo." : "no está disponible en este momento."} Probá de nuevo más tarde.</p>
      <p className="mt-6 font-mono text-[11px] text-zinc-400">hacemeprecio.app/p/{product.slug}</p>
    </div>
  );
}

/* ============================================================
   PANEL DE ADMINISTRADOR (vos)
   ============================================================ */
function AdminView({ sellers, products, offers, logins, now, actions, session, reports = [], rules = {}, reviews = [], tickets = [] }) {
  const [filter, setFilter] = useState("todos");
  const [reviewId, setReviewId] = useState(null);
  const openReports = reports.filter((r) => r.status === "abierto");
  const reportedIds = [...new Set(reports.map((r) => r.productId))];
  const [q, setQ] = useState("");
  const rows = sellers.map((x) => {
    const acc = subAccess(x, now);
    const prods = products.filter((p) => p.sellerId === x.id);
    const ids = new Set(prods.map((p) => p.id));
    const sales = offers.filter((o) => ids.has(o.productId) && CLOSED.includes(o.status)).length;
    const nReports = reports.filter((r) => ids.has(r.productId)).length;
    const last = logins.find((l) => l.sellerId === x.id && l.ok);
    return { x, acc, prods, sales, last, nReports };
  });
  const groups = {
    todos: () => true,
    activos: (r) => r.acc.key === "activa",
    prueba: (r) => r.acc.key === "prueba",
    deuda: (r) => ["gracia", "vencida"].includes(r.acc.key),
    suspendidos: (r) => r.acc.key === "suspendida",
  };
  const list = rows.filter(groups[filter]).filter((r) => (r.x.name + r.x.email).toLowerCase().includes(q.toLowerCase()));
  const payingRows = rows.filter((r) => isMonthly(r.x) && (r.acc.key === "activa" || r.acc.key === "gracia"));
  const paying = payingRows.length;
  const mrr = payingRows.reduce((sum, r) => sum + planOf(r.x).price, 0);
  const month = sellers.flatMap((x) => x.payments.map((p) => ({ ...p, seller: x }))).sort((a, b) => b.at - a.at);
  const collected30 = month.filter((p) => now - p.at < 30 * DAY).reduce((s, p) => s + p.amount, 0);
  const sinceLast = (t) => {
    if (!t) return "—";
    const d = now - t;
    if (d < 60 * MIN) return `hace ${Math.max(1, Math.round(d / MIN))} min`;
    if (d < DAY) return `hace ${Math.round(d / (60 * MIN))} h`;
    return `hace ${Math.round(d / DAY)} d`;
  };
  const kpis = [
    { Icon: Users, label: "Vendedores", value: sellers.length, hint: `${rows.filter((r) => r.acc.allowed).length} con acceso` },
    { Icon: CircleDollarSign, label: "Ingreso mensual (MRR)", value: fmt(mrr), hint: `${paying} con plan mensual (${payingRows.filter((r) => r.x.plan === "pro").length} Pro)` },
    { Icon: Receipt, label: "Cobrado últimos 30 días", value: fmt(collected30) },
    { Icon: Sparkles, label: "En prueba gratis", value: rows.filter((r) => r.acc.key === "prueba").length, hint: "posibles altas" },
    { Icon: AlertTriangle, label: "Con deuda", value: rows.filter((r) => ["gracia", "vencida"].includes(r.acc.key)).length, hint: "en gracia o bloqueados", warn: true },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={LOGO_ISOTIPO} alt="" className="h-10 w-auto" />
          <div>
            <h1 className="font-display text-xl font-extrabold">Panel de administración</h1>
            <p className="text-xs text-zinc-500">Vendedores, planes, cobros y control de acceso</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-zinc-600">
          <span className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-200">Prueba: <b>{TRIAL_DAYS} días</b></span>
          <span className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-200">Planes: <b>{fmt(PASS_PRICE)} único · {fmt(SUB_PRICE)}/mes · Tienda {fmt(TIENDA_PRICE)}/mes · Pro {fmt(PRO_PRICE)}/mes</b></span>
          <span className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-zinc-200">Gracia: <b>{GRACE_DAYS} días</b></span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map(({ Icon, label, value, hint, warn }) => (
          <div key={label} className={`rounded-2xl bg-white p-4 ring-1 ${warn && value > 0 ? "ring-hpred/40" : "ring-zinc-200"}`}>
            <p className="flex items-center gap-1.5 text-[11px] text-zinc-500"><Icon size={13} /> {label}</p>
            <p className={`mt-1 font-display text-2xl font-extrabold ${warn && value > 0 ? "text-hpred" : ""}`}>{value}</p>
            {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="rounded-2xl bg-white ring-1 ring-zinc-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
            {[["todos", "Todos"], ["activos", "Activos"], ["prueba", "En prueba"], ["deuda", "Con deuda"], ["suspendidos", "Suspendidos"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === k ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}>{l}</button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o email…" className="ml-auto w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs outline-none focus:border-zinc-900 sm:w-56" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Vendedor</th>
                  <th className="px-3 py-2.5 font-semibold">Estado</th>
                  <th className="px-3 py-2.5 font-semibold">Vence</th>
                  <th className="px-3 py-2.5 font-semibold">Actividad</th>
                  <th className="px-3 py-2.5 font-semibold">Último ingreso</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {list.map(({ x, acc, prods, sales, last, nReports }) => (
                  <tr key={x.id} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kraft-100 text-[11px] font-bold text-ink">{initials(x.name)}</div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium">{x.name}{session?.sellerId === x.id && <span className="rounded bg-ink px-1 py-px text-[9px] font-bold uppercase text-white">en línea</span>}</p>
                          <p className="truncate font-mono text-[11px] text-zinc-500">{x.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${SUB_STYLE[acc.key].cls}`}>{SUB_STYLE[acc.key].label}</span>
                      <p className="mt-1 text-[10px] font-semibold text-zinc-500">{x.plan === "pase" ? `🏷️ Una sola cosa (${fmt(PASS_PRICE)} único)` : x.plan === "pro" ? `✨ Pro (${fmt(PRO_PRICE)}/mes)` : x.plan === "tienda" ? `🏬 Tienda (${fmt(TIENDA_PRICE)}/mes)` : `🛍️ Vendo seguido (${fmt(SUB_PRICE)}/mes)`}</p>
                      {x.note && <p className="mt-1 max-w-[160px] text-[10px] text-zinc-500">{x.note}</p>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p>{fmtDate(x.periodEnd)}</p>
                      <p className={x.periodEnd < now ? "text-hpred" : "text-zinc-400"}>
                        {x.periodEnd >= now ? `en ${daysLeft(x.periodEnd - now)} d` : `hace ${Math.floor((now - x.periodEnd) / DAY)} d`}
                        {acc.key === "gracia" && ` · ${acc.daysLeft} d de gracia`}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      <p>{prods.length} publicaciones · {sales} ventas</p>
                      {(() => { const r = repOf(reviews, x.id); return <p className="flex items-center gap-1"><Star size={11} className="fill-kraft text-kraft" /> {r.count ? `${fmtStars(r.avg)} (${r.count})` : "sin reseñas"}</p>; })()}
                      <p className="text-zinc-400">{x.payments.length} pagos · {fmt(x.payments.reduce((s, p) => s + p.amount, 0))}</p>
                      {nReports > 0 && <p className="mt-0.5 flex items-center gap-1 font-semibold text-hpred"><AlertTriangle size={11} /> {nReports} reporte(s)</p>}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">{sinceLast(last?.at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconBtn title="Registrar pago manual (transferencia) · +30 días" onClick={() => { actions.registerPayment(x.id, "Transferencia (manual)"); actions.toast("success", "Pago registrado", `${x.name}: +30 días.`); }}><Wallet size={15} /></IconBtn>
                        <IconBtn title="Extender 7 días" onClick={() => actions.adminExtend(x.id, 7)}><CalendarPlus size={15} /></IconBtn>
                        {x.status === "suspendida" ? (
                          <IconBtn title="Reactivar cuenta" onClick={() => actions.adminReactivate(x.id)}><PlayCircle size={15} /></IconBtn>
                        ) : (
                          <IconBtn title="Suspender cuenta" danger onClick={() => actions.adminSuspend(x.id)}><PauseCircle size={15} /></IconBtn>
                        )}
                        <IconBtn title="Cerrar todas sus sesiones" onClick={() => actions.adminKick(x.id)}><LogOut size={15} /></IconBtn>
                        <IconBtn title="Abrir su panel (modo soporte)" onClick={() => actions.adminImpersonate(x.id)}><Eye size={15} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">No hay vendedores en este filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-zinc-100 px-4 py-2.5 text-[11px] text-zinc-400">
            Acciones: <Wallet size={11} className="inline" /> pago manual · <CalendarPlus size={11} className="inline" /> +7 días · <PauseCircle size={11} className="inline" /> suspender · <LogOut size={11} className="inline" /> cerrar sesiones · <Eye size={11} className="inline" /> ver su panel
          </p>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl bg-white ring-1 ring-zinc-200">
            <p className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <AlertTriangle size={13} /> Reportes de publicaciones
              {openReports.length > 0 && <span className="ml-auto rounded-full bg-hpred px-2 py-0.5 text-[10px] font-bold text-white">{openReports.length} sin revisar</span>}
            </p>
            {reportedIds.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-zinc-400">Sin reportes.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto">
                {reportedIds.map((pid) => {
                  const pr = products.find((p) => p.id === pid);
                  const sl = sellers.find((x) => x.id === pr?.sellerId);
                  const rs = reports.filter((r) => r.productId === pid);
                  const open = rs.filter((r) => r.status === "abierto").length;
                  return (
                    <li key={pid} className="flex items-center gap-3 px-4 py-3">
                      {pr && <ProductThumb product={pr} size="h-12 w-12" />}
                      <div className="min-w-0 flex-1 text-[12px]">
                        <p className="truncate font-semibold">{pr?.title}</p>
                        <p className="text-zinc-500">{sl?.name} · {rs.length} reporte(s){pr?.moderation === "pausada" ? " · pausada" : ""}</p>
                        <p className={open ? "font-semibold text-hpred" : "text-zinc-400"}>{open ? `${open} sin revisar · ${[...new Set(rs.map((r) => r.reason))].join(", ")}` : "Revisado"}</p>
                      </div>
                      <Btn variant={open ? "primary" : "outline"} className="shrink-0 px-3 py-1.5 text-[13px]" onClick={() => setReviewId(pid)}><Eye size={14} /> Revisar</Btn>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="rounded-2xl bg-white ring-1 ring-zinc-200">
            <AdminTickets tickets={tickets} sellers={sellers} actions={actions} />
          </section>
          <section className="rounded-2xl bg-white ring-1 ring-zinc-200">
            <p className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><Star size={13} /> Reseñas recientes</p>
            <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto">
              {[...reviews].sort((a, b) => b.at - a.at).slice(0, 10).map((r) => (
                <li key={r.id} className={`px-4 py-2.5 text-[12px] ${r.hidden ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5"><Stars value={r.stars} size={11} /> <b>{sellers.find((x) => x.id === r.sellerId)?.name}</b></span>
                    <button onClick={() => actions.adminToggleReview(r.id)} className="text-[11px] font-semibold text-hpred underline">{r.hidden ? "Mostrar" : "Ocultar"}</button>
                  </div>
                  <p className="text-zinc-600">{r.buyerName} · {r.productTitle}{r.text ? ` · “${r.text.slice(0, 60)}${r.text.length > 60 ? "…" : ""}”` : ""}</p>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-white ring-1 ring-zinc-200">
            <p className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><KeyRound size={13} /> Ingresos al sistema</p>
            <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto">
              {logins.map((l) => (
                <li key={l.id} className="flex gap-2.5 px-4 py-2.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${l.ok ? "bg-ink" : "bg-hpred"}`} />
                  <div className="min-w-0 text-[12px]">
                    <p><b>{sellers.find((x) => x.id === l.sellerId)?.name}</b> <span className="font-mono text-[10px] text-zinc-400">{clockTime(l.at)}</span></p>
                    <p className={l.ok ? "text-zinc-600" : "text-hpred"}>{l.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-white ring-1 ring-zinc-200">
            <p className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><Receipt size={13} /> Pagos de suscripción</p>
            <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto">
              {month.map((p, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
                  <span><b>{p.seller.name}</b><span className="block text-[11px] text-zinc-500">{fmtDate(p.at)} · {p.via}</span></span>
                  <b>{fmt(p.amount)}</b>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl bg-ink p-4 text-white">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-kraft"><Server size={13} /> Cómo funciona en producción</p>
            <ol className="mt-3 space-y-2 text-[12px] leading-snug text-zinc-300">
              <li><b className="text-white">1. Login:</b> Supabase Auth con código por email (sin contraseñas). Cada usuario tiene un rol: vendedor o admin.</li>
              <li><b className="text-white">2. Cobro:</b> suscripción de Mercado Pago con débito automático. Cada cobro avisa a tu backend y extiende el vencimiento 30 días.</li>
              <li><b className="text-white">3. Bloqueo real:</b> reglas en la base de datos (RLS). Sin plan vigente, no se puede leer ni escribir nada del panel y los links se pausan.</li>
              <li><b className="text-white">4. Vos:</b> este panel, con tu rol de admin, para ver cobros, dar días, suspender o cerrar sesiones.</li>
            </ol>
          </section>
        </div>
      </div>
      {reviewId && (
        <ReviewModal product={products.find((p) => p.id === reviewId)} rules={rules[reviewId]} reports={reports.filter((r) => r.productId === reviewId)}
          seller={sellers.find((x) => x.id === products.find((p) => p.id === reviewId)?.sellerId)}
          offers={offers.filter((o) => o.productId === reviewId)} now={now} actions={actions} onClose={() => setReviewId(null)} />
      )}
    </main>
  );
}

function IconBtn({ children, title, onClick, danger }) {
  return (
    <button title={title} aria-label={title} onClick={onClick}
      className={`rounded-lg p-2 ring-1 transition ${danger ? "text-hpred ring-zinc-200 hover:bg-kraft-50" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50 hover:text-ink"}`}>
      {children}
    </button>
  );
}


function NotifSettings({ seller, actions }) {
  const pref = seller.notif || { push: true, whatsapp: true, email: false };
  const [perm, setPerm] = useState(() => {
    try { return typeof Notification === "undefined" ? "no-soportado" : Notification.permission; } catch { return "no-soportado"; }
  });
  const ask = async () => {
    try {
      const r = await Notification.requestPermission();
      setPerm(r);
      if (r === "granted") {
        new Notification("Haceme Precio", { body: "Listo: te vamos a avisar cuando llegue una oferta.", icon: LOGO_PERFIL });
        actions.toast("success", "Notificaciones activadas", "Así se ve cuando llega una oferta.");
      } else actions.toast("info", "Permiso no otorgado", "En este visor el navegador lo bloquea. En la app instalada sí funciona.");
    } catch {
      setPerm("bloqueado");
      actions.toast("info", "No disponible acá", "El visor de la demo no permite notificaciones reales. Abajo podés simular una.");
    }
  };
  const rows = [
    { k: "push", Icon: BellRing, l: "Notificación en el celular", d: "Al instante, aunque la app esté cerrada" },
    { k: "whatsapp", Icon: MessageCircle, l: "WhatsApp", d: "Respaldo si no abrís la notificación en 5 min" },
    { k: "email", Icon: Mail, l: "Email", d: "Resumen de ofertas y ventas" },
  ];
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Bell size={13} /> Notificaciones</p>
      <div className="mt-3 space-y-3">
        {rows.map(({ k, Icon, l, d }) => (
          <div key={k} className="flex items-center gap-3">
            <Icon size={18} className="shrink-0 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{l}</p>
              <p className="text-[11px] text-zinc-500">{d}</p>
            </div>
            <div className="w-11 shrink-0"><Toggle label="" checked={!!pref[k]} onChange={(v) => actions.setNotifPref(seller.id, k, v)} /></div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn variant="outline" className="py-2.5 text-xs" onClick={ask} disabled={perm === "granted"}>
          <BellRing size={14} /> {perm === "granted" ? "Activadas" : "Activar en este celular"}
        </Btn>
        <Btn variant="dark" className="py-2.5 text-xs"
          onClick={() => actions.notify({ to: "seller", sellerId: seller.id, title: "💰 Nueva oferta: $590.000", body: "Martín G. por iPhone 13 (91% de lista). Tenés 15 min para responder.", go: { tab: "inbox", sellerId: seller.id } })}>
          Probar aviso
        </Btn>
      </div>
      <p className="mt-2 text-[10px] text-zinc-400">En iPhone las notificaciones funcionan solo si instalaste la app en la pantalla de inicio.</p>
    </div>
  );
}


/* ============================================================
   REPORTE DE PUBLICACIÓN SOSPECHOSA
   ============================================================ */
const REPORT_REASONS = [
  { k: "Precio irreal", d: "Demasiado barato para ser verdad" },
  { k: "Posible estafa", d: "Pide señas, datos o pagos raros" },
  { k: "Producto prohibido", d: "Armas, medicamentos, animales, etc." },
  { k: "Datos falsos", d: "Fotos robadas o información engañosa" },
];
function ReportSheet({ product, actions, onClose }) {
  const [reason, setReason] = useState(null);
  const [detail, setDetail] = useState("");
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <Sheet onClose={onClose} title="Gracias por avisar">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white"><ShieldCheck size={26} /></div>
          <p className="mt-3 text-sm text-zinc-600">Recibimos el reporte. El equipo de Haceme Precio lo revisa y, si corresponde, pausa la publicación. El vendedor no sabe quién reportó.</p>
        </div>
        <Btn variant="dark" className="mt-5 w-full py-3" onClick={onClose}>Cerrar</Btn>
      </Sheet>
    );
  }
  return (
    <Sheet onClose={onClose} title="Reportar publicación">
      <p className="text-sm text-zinc-600">¿Qué pasa con «{product.title}»?</p>
      <div className="mt-3 space-y-2">
        {REPORT_REASONS.map((r) => (
          <button key={r.k} onClick={() => setReason(r.k)}
            className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${reason === r.k ? "border-hpred bg-kraft-50/50 ring-1 ring-hpred" : "border-zinc-200"}`}>
            <span><span className="block text-sm font-semibold">{r.k}</span><span className="block text-xs text-zinc-500">{r.d}</span></span>
            {reason === r.k && <Check size={16} className="text-hpred" />}
          </button>
        ))}
      </div>
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="Contanos más (opcional)"
        className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
      <Btn className="mt-3 w-full py-3.5" disabled={!reason}
        onClick={() => { const r = actions.reportProduct(product.id, reason, detail.trim()); if (r.error) actions.toast("error", "Ya reportado", r.error); else setDone(true); }}>
        <AlertTriangle size={16} /> Enviar reporte
      </Btn>
    </Sheet>
  );
}

/* ============================================================
   NIVEL "TÍA NORMA": compartir, vidriera y recibo
   ============================================================ */
const sellerSlug = (sl) => (sl ? sl.store?.slug || slugify(sl.name.split(" ")[0]) : "");

/* --- Kit para compartir en Facebook --- */
function ShareKit({ product, actions }) {
  const [tab, setTab] = useState("text");
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-1.5">
        {[{ k: "text", l: "Descripción", I: Copy }, { k: "replies", l: "Respuestas", I: MessageCircle }, { k: "badge", l: "Placa foto", I: ImagePlus }].map(({ k, l, I }) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[12px] font-semibold ${tab === k ? "bg-ink text-white" : "bg-zinc-100 text-zinc-600"}`}>
            <I size={17} /> {l}
          </button>
        ))}
      </div>
      {tab === "replies" && <MessengerReplies product={product} actions={actions} />}
      {tab === "text" && (
        <>
          <p className="mt-3 text-[13px] font-bold text-ink">1. Copiá el texto para donde vendas</p>
          <FbGenerator product={product} actions={actions} />
          <p className="mt-4 text-[13px] font-bold text-ink">2. Si igual te escriben por privado, respondé con esto</p>
          <div className="mt-2 space-y-2">
            {quickReplies(product).map((r) => <ReplyCard key={r.q} q={r.q} a={r.a} actions={actions} />)}
          </div>
        </>
      )}
      {tab === "badge" && <PhotoBadge product={product} />}
    </div>
  );
}

/* Respuestas rápidas principales para cualquier chat: WhatsApp, Instagram, Messenger */
const quickReplies = (p) => {
  const url = `hacemeprecio.app/p/${p.slug}`;
  return [
    { q: "¿Sigue disponible?", a: `¡Hola! Sí, si ves la publicación sigue disponible. Para no dar vueltas y ver bien las condiciones, pasame tu oferta directa acá: ${url}` },
    { q: "¿Cuál es lo menos?", a: `¡Hola! Para no dar vueltas, pasame tu oferta directa acá y te contesto enseguida. Si entra en lo que acepto, queda cerrada al toque: ${url}` },
  ];
};

function ReplyCard({ q, a, actions }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-zinc-200">
      <p className="text-[12px] font-semibold text-zinc-500">Si te escriben: “{q}”</p>
      <p className="mt-1 text-[13px] leading-snug text-ink">{a}</p>
      <Btn variant="dark" className="mt-2 w-full py-2.5 text-sm"
        onClick={async () => { const ok = await copyText(a); actions.toast(ok ? "success" : "error", ok ? "Respuesta copiada" : "No se pudo copiar", ok ? "Pegala en WhatsApp, Instagram o Messenger." : "Mantené apretado el texto para copiarlo."); }}>
        <MessageCircle size={15} /> Copiar respuesta
      </Btn>
    </div>
  );
}

function MessengerReplies({ product: p, actions }) {
  const url = `hacemeprecio.app/p/${p.slug}`;
  const replies = [
    ...quickReplies(p),
    { q: "¿Dónde estás? / ¿Hacés envíos?", a: `${p.pickupPoints.length ? `Se retira en ${p.pickupPoints.join(" o ")}.` : "El retiro lo coordinamos."} ${p.shipping.enabled ? "También hago envíos, a cargo del comprador." : "No hago envíos."} Todo está acá: ${url}` },
    { q: "¿Permutás?", a: p.acceptsSwap ? `Puede ser 🙂 Contame qué tenés en tu oferta acá: ${url}` : `No, gracias, solo venta. Si te interesa, ofertá acá: ${url}` },
  ];
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] text-zinc-600">Cuando te escriban por WhatsApp, Instagram o Messenger, copiá y pegá la respuesta con tu link.</p>
      {replies.map((r) => <ReplyCard key={r.q} q={r.q} a={r.a} actions={actions} />)}
    </div>
  );
}

/* Placa para la ÚLTIMA foto de Marketplace (no en la portada: Facebook pide que las fotos muestren el producto). */
function PhotoBadge({ product: p }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = (u) => new Promise((res) => { if (!u) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });
    (async () => {
      const [logo, photo] = await Promise.all([load(LOGO_PERFIL), load(p.photos?.[0]?.src)]);
      const c = document.createElement("canvas");
      c.width = 1080; c.height = 1080;
      const g = c.getContext("2d");
      g.fillStyle = "#FBF5EC"; g.fillRect(0, 0, 1080, 1080);
      if (photo) {
        const k = Math.max(1080 / photo.width, 560 / photo.height);
        const w = photo.width * k, h = photo.height * k;
        g.save(); g.beginPath(); g.rect(0, 0, 1080, 560); g.clip();
        g.drawImage(photo, (1080 - w) / 2, (560 - h) / 2, w, h); g.restore();
      } else {
        g.fillStyle = "#E8CFA5"; g.fillRect(0, 0, 1080, 560);
      }
      g.fillStyle = "#1B1B1B";
      g.font = "800 50px Archivo, Inter, sans-serif";
      const title = p.title.length > 34 ? p.title.slice(0, 33) + "…" : p.title;
      g.fillText(title, 70, 650);
      g.fillStyle = "#C8102E";
      g.font = "900 96px Archivo, Inter, sans-serif";
      g.fillText(fmt(p.listPrice), 70, 770);
      g.fillStyle = "#1B1B1B";
      g.font = "600 40px Inter, sans-serif";
      g.fillText("Mirá más fotos y hacé tu oferta en:", 70, 860);
      g.font = "700 44px Inter, sans-serif";
      g.fillText(`hacemeprecio.app/p/${p.slug}`.slice(0, 40), 70, 920);
      if (logo) g.drawImage(logo, 860, 820, 160, 160);
      if (alive) setSrc(c.toDataURL("image/jpeg", 0.9));
    })();
    return () => { alive = false; };
  }, [p]);
  return (
    <div className="mt-3">
      {src ? <img src={src} alt="Placa para la última foto" className="w-full rounded-xl ring-1 ring-zinc-200" /> : <div className="aspect-square animate-pulse rounded-xl bg-zinc-100" />}
      <div className="mt-2 rounded-xl bg-kraft-50 p-3 text-[12px] leading-snug text-zinc-700 ring-1 ring-kraft-200">
        <p><b>Cómo usarla:</b> mantené apretada la imagen → «Guardar imagen». Subila a tu <b>estado de WhatsApp</b> o <b>historia de Instagram</b>. En Marketplace, ponela como <b>última foto</b>, nunca como portada.</p>
      </div>
    </div>
  );
}

/* --- Vidriera: un link con todo lo que vende la persona --- */
function BackBar({ label, onBack }) {
  return (
    <button onClick={onBack} className="flex w-full shrink-0 items-center gap-1.5 border-b border-zinc-100 bg-white px-3 py-2.5 text-left text-[14px] font-semibold text-ink active:bg-zinc-50">
      <ChevronLeft size={20} className="shrink-0" /> <span className="truncate">Volver a {label}</span>
    </button>
  );
}

function StorefrontView({ seller, products, trust, onOpen, backLabel, onBack, onReviews }) {
  const active = products.filter((p) => p.status !== "vendido");
  const sold = products.filter((p) => p.status === "vendido");
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
        <Lock size={11} className="text-zinc-500" />
        <span className="truncate font-mono text-[11px] text-zinc-600">hacemeprecio.app/v/{sellerSlug(seller)}</span>
      </div>
      {backLabel && <BackBar label={backLabel} onBack={onBack} />}
      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 pb-6 hp-scroll">
        <div className="bg-white px-4 pb-4 pt-4">
          <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-6 w-auto" />
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-kraft text-lg font-extrabold text-ink">{initials(seller.name)}</div>
            <div>
              <p className="font-display text-xl font-extrabold">Las cosas de {seller.name.split(" ")[0]}</p>
              <RatingLine rep={trust?.rep} onClick={onReviews} big />
              <p className="text-[12px] text-zinc-500">{trust?.closed ?? 0} ventas cerradas · {active.length} a la venta</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-medium">
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5"><Check size={10} /> Email verificado</span>
            {trust?.phoneVerified && <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5"><Check size={10} /> Teléfono verificado</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          {active.map((p) => (
            <button key={p.id} onClick={() => onOpen(p.id)} className="overflow-hidden rounded-2xl bg-white text-left ring-1 ring-zinc-200 transition active:scale-[0.98]">
              <ProductThumb product={p} size="h-36 w-full !rounded-none" iconSize={40} />
              <div className="p-2.5">
                <p className="line-clamp-2 text-[13px] font-medium leading-snug">{p.title}</p>
                <p className="mt-1 text-base font-extrabold">{fmt(p.listPrice)}</p>
                {(p.stock ?? 1) > 1 && <p className="text-[11px] text-zinc-500">Quedan {p.stock}</p>}
                <p className="mt-1.5 rounded-lg bg-hpred py-1.5 text-center text-[12px] font-semibold text-white">Ofertar</p>
              </div>
            </button>
          ))}
        </div>
        {sold.length > 0 && (
          <div className="px-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Ya vendido</p>
            <div className="mt-2 flex gap-2 overflow-x-auto hp-scroll">
              {sold.map((p) => <div key={p.id} className="opacity-50 grayscale"><ProductThumb product={p} size="h-16 w-16" /></div>)}
            </div>
          </div>
        )}
        <FaqList title="Cómo funciona Haceme Precio" Icon={Info} dark items={PLATFORM_FAQ.oferta} />
        <p className="mt-6 px-6 text-center text-[10px] leading-relaxed text-zinc-400">Haceme Precio es una herramienta de gestión de ofertas y condiciones comerciales entre partes. No actúa como intermediario financiero ni garantiza entregas físicas.</p>
      </div>
    </div>
  );
}

/* --- Recibo del acuerdo (comprobante de lo pactado, NO comprobante de pago salvo pasarela) --- */
function ReceiptSheet({ offer: o, product: p, seller, now, onClose }) {
  const amount = o.finalAmount ?? o.amount;
  const head = {
    ACEPTADA_PENDIENTE_CIERRE: { t: o.closeMode === "externo" ? "Acuerdo listo · se paga al retirar" : "Acuerdo listo · falta pagar", c: "bg-kraft text-ink" },
    CERRADA_PAGADA: { t: "Pagado ✓ · listo para retirar", c: "bg-hpred text-white" },
    ACUERDO_CERRADO_EXTERNO: { t: "Venta cerrada · cobrada en persona", c: "bg-ink text-white" },
  }[o.status] || { t: STATUS[o.status]?.label, c: "bg-zinc-200 text-ink" };
  const lines = [
    ["Producto", p.title],
    ["Precio acordado", fmt(amount)],
    ["Comprador", o.buyerName],
    ["Vendedor", seller?.name],
    ["Entrega", o.delivery || p.pickupPoints[0] || "A coordinar"],
    ...(o.code ? [["Código de retiro", o.code]] : []),
    ...(o.status === "ACEPTADA_PENDIENTE_CIERRE" ? [["Vence en", mmss(o.expiresAt - now)]] : []),
    ["N° de acuerdo", o.id.toUpperCase()],
  ];
  const waText = `Acuerdo Haceme Precio ${o.id.toUpperCase()}\n${p.title}\nPrecio acordado: ${fmt(amount)}\nEstado: ${head.t}\nEntrega: ${o.delivery || p.pickupPoints[0] || "A coordinar"}${o.code ? `\nCódigo de retiro: ${o.code}` : ""}`;
  return (
    <Sheet onClose={onClose} title="Recibo del acuerdo">
      <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-200">
        <div className={`px-4 py-3 ${head.c}`}>
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Haceme Precio</p>
          <p className="font-display text-lg font-extrabold">{head.t}</p>
        </div>
        <div className="flex items-center gap-3 border-b border-dashed border-zinc-300 bg-white p-4">
          <ProductThumb product={p} size="h-14 w-14" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{p.title}</p>
            <p className="text-2xl font-extrabold">{fmt(amount)}</p>
            {amount < p.listPrice && <p className="text-xs text-zinc-400 line-through">{fmt(p.listPrice)}</p>}
          </div>
        </div>
        <dl className="divide-y divide-zinc-100 bg-white px-4 text-[13px]">
          {lines.slice(2).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2"><dt className="text-zinc-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
      </div>
      {o.status !== "CERRADA_PAGADA" && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[12px] leading-snug text-amber-900 ring-1 ring-amber-200">
          Este recibo muestra lo que acordaron. <b>No es un comprobante de pago.</b> Antes de entregar, el vendedor tiene que ver la plata acreditada.
        </p>
      )}
      <button onClick={async () => { try { await navigator.clipboard.writeText(waText); } catch {} }}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-ink ring-1 ring-zinc-300">
        <Copy size={17} /> Copiar resumen para WhatsApp/Messenger
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer"
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-semibold text-white">
        <MessageCircle size={18} /> Mandar por WhatsApp
      </a>
      <p className="mt-2 text-center text-[11px] text-zinc-400">O sacale una captura para tenerlo a mano.</p>
    </Sheet>
  );
}

/* ============================================================
   ADMIN · REVISIÓN DE UNA PUBLICACIÓN REPORTADA
   ============================================================ */
function ReviewModal({ product: p, rules, reports, seller, offers, now, actions, onClose }) {
  if (!p) return null;
  const acc = subAccess(seller, now);
  const open = reports.filter((r) => r.status === "abierto").length;
  const active = offers.filter((o) => ACTIVE.includes(o.status)).length;
  const closed = offers.filter((o) => CLOSED.includes(o.status)).length;
  const paused = p.moderation === "pausada";
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-zinc-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div className="hp-slide-up flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3.5">
          <AlertTriangle size={18} className="text-hpred" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Revisión de publicación reportada</p>
            <p className="truncate font-display text-lg font-extrabold">{p.title}</p>
          </div>
          {paused && <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase text-white">Pausada</span>}
          <button onClick={onClose} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[380px_1fr]">
          <div className="border-b border-zinc-100 md:border-b-0 md:border-r">
            <Gallery product={p} sold={p.status === "vendido"} reserved={false} />
            <div className="space-y-3 p-4">
              <div className="flex items-end gap-2">
                <p className="text-2xl font-extrabold">{fmt(p.listPrice)}</p>
                <span className="mb-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium">{p.condition}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-zinc-600">{p.description}</p>
              <ul className="space-y-1 text-[13px]">
                {p.highlights.map((h) => <li key={h} className="flex gap-1.5"><Check size={14} className="mt-0.5 text-hpred" /> {h}</li>)}
              </ul>
              <p className="text-[12px] text-zinc-500">
                {p.shipping.enabled ? "Hace envíos" : "Solo retiro"}{p.pickupPoints.length ? ` · ${p.pickupPoints.join(" · ")}` : ""} · {p.views} visitas
              </p>
              <p className="font-mono text-[11px] text-zinc-400">hacemeprecio.app/p/{p.slug}</p>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Reportes ({reports.length})</p>
              <ul className="mt-2 space-y-2">
                {reports.map((r) => (
                  <li key={r.id} className={`rounded-xl p-3 text-[13px] ring-1 ${r.status === "abierto" ? "bg-kraft-50 ring-kraft-200" : "bg-zinc-50 ring-zinc-100"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <b className={r.status === "abierto" ? "text-hpred" : ""}>{r.reason}</b>
                      <span className="text-[11px] text-zinc-400">{clockTime(r.at).slice(0, 5)} · {r.status === "abierto" ? "sin revisar" : r.status}</span>
                    </div>
                    {r.detail ? <p className="mt-1 text-zinc-700">“{r.detail}”</p> : <p className="mt-1 text-zinc-400">Sin comentario.</p>}
                    <p className="mt-1 font-mono text-[10px] text-zinc-400">Reportado por: {r.by === ME.id ? "comprador de la demo (Lucía)" : r.by}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-zinc-50 p-3 text-[13px] ring-1 ring-zinc-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Vendedor</p>
                <p className="mt-1 font-semibold">{seller?.name}</p>
                <p className="font-mono text-[11px] text-zinc-500">{seller?.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${SUB_STYLE[acc.key].cls}`}>{SUB_STYLE[acc.key].label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${seller?.phoneVerified ? "bg-zinc-200" : "bg-amber-50 text-amber-800"}`}>{seller?.phoneVerified ? "Teléfono verificado" : "Teléfono sin verificar"}</span>
                </div>
                <p className="mt-1.5 text-[12px] text-zinc-500">En la app desde hace {Math.floor((now - (seller?.joinedAt || now)) / DAY)} días</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 text-[13px] ring-1 ring-zinc-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Actividad de esta publicación</p>
                <p className="mt-1">{offers.length} ofertas · {active} en curso · {closed} ventas</p>
                {rules && (
                  <p className="mt-1.5 text-[12px] text-zinc-500">Mínimo oculto: <b className="text-ink">{fmt(rules.floorPrice)}</b> ({pct(rules.floorPrice, p.listPrice)}%) · se vende solo desde {rules.autoAcceptPct}%</p>
                )}
                <p className="mt-1 text-[10px] text-zinc-400">Solo vos ves estos datos (rol admin, del lado del servidor).</p>
              </div>
            </section>

            <section className="rounded-xl bg-ink p-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-kraft">¿Qué hacemos?</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {paused ? (
                  <Btn variant="outline" className="py-2.5 text-sm" onClick={() => actions.adminRestoreProduct(p.id)}><PlayCircle size={15} /> Reactivar publicación</Btn>
                ) : (
                  <Btn className="py-2.5 text-sm" onClick={() => actions.adminPauseProduct(p.id)}><PauseCircle size={15} /> Pausar publicación</Btn>
                )}
                <Btn variant="outline" className="py-2.5 text-sm" disabled={!open} onClick={() => actions.adminDismissReports(p.id)}><Check size={15} /> Está bien, descartar reportes</Btn>
                {seller && seller.status !== "suspendida" ? (
                  <Btn variant="outline" className="py-2.5 text-sm !text-hpred" onClick={() => actions.adminSuspend(seller.id)}><Ban size={15} /> Suspender al vendedor</Btn>
                ) : (
                  <Btn variant="outline" className="py-2.5 text-sm" onClick={() => seller && actions.adminReactivate(seller.id)}><PlayCircle size={15} /> Reactivar vendedor</Btn>
                )}
                <Btn variant="outline" className="py-2.5 text-sm" onClick={() => { onClose(); actions.openAsBuyer(p.id); }}><Eye size={15} /> Verla como comprador</Btn>
              </div>
              <p className="mt-2 text-[11px] text-zinc-400">Pausar: nadie la ve ni puede ofertar, y le avisamos al vendedor. Suspender: se pausan todas sus publicaciones y no puede entrar.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   REPUTACIÓN DEL VENDEDOR (estilo reseñas de Google, con compra verificada)
   ============================================================ */
function Stars({ value = 0, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-px" aria-label={`${fmtStars(value)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-zinc-300" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="fill-[#E8A33D] text-[#E8A33D]" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function RatingLine({ rep, onClick, big }) {
  if (!rep || rep.count === 0) {
    return <p className={`${big ? "text-[13px]" : "text-[11px]"} text-zinc-500`}>Sin reseñas todavía · vendedor nuevo</p>;
  }
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 text-left ${big ? "text-[14px]" : "text-[12px]"} font-semibold text-ink hover:underline`}>
      <span>{fmtStars(rep.avg)}</span>
      <Stars value={rep.avg} size={big ? 15 : 12} />
      <span className="font-normal text-zinc-500 underline">({rep.count} {rep.count === 1 ? "reseña" : "reseñas"})</span>
    </button>
  );
}

function ReviewItem({ r, children }) {
  return (
    <li className="py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kraft-100 text-[11px] font-bold text-ink">{initials(r.buyerName)}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{r.buyerName}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Stars value={r.stars} size={11} /> · {fmtDate(r.at)}
            {r.verified && <span className="flex items-center gap-0.5 font-semibold text-ink"><BadgeCheck size={11} /> Compra verificada</span>}
          </p>
        </div>
      </div>
      <p className="mt-1.5 text-[12px] text-zinc-500">Compró: {r.productTitle}</p>
      {r.text && <p className="mt-1 text-[13px] leading-snug text-ink">{r.text}</p>}
      {r.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {r.tags.map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">{t}</span>)}
        </div>
      )}
      {r.reply && (
        <div className="ml-4 mt-2 rounded-xl bg-zinc-50 p-2.5 text-[12px] ring-1 ring-zinc-100">
          <p className="font-semibold">Respuesta del vendedor</p>
          <p className="mt-0.5 text-zinc-700">{r.reply.text}</p>
        </div>
      )}
      {children}
    </li>
  );
}

function RepSummary({ rep }) {
  return (
    <div className="flex gap-4">
      <div className="text-center">
        <p className="font-display text-4xl font-extrabold leading-none">{rep.count ? fmtStars(rep.avg) : "–"}</p>
        <div className="mt-1"><Stars value={rep.avg} size={13} /></div>
        <p className="mt-0.5 text-[11px] text-zinc-500">{rep.count} reseñas</p>
      </div>
      <div className="flex-1 space-y-1">
        {[5, 4, 3, 2, 1].map((n, i) => (
          <div key={n} className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="w-2">{n}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-[#E8A33D]" style={{ width: `${rep.count ? (rep.dist[i] / rep.count) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsSheet({ seller, rep, onClose }) {
  return (
    <Sheet onClose={onClose} title={`Reseñas de ${seller?.name}`}>
      <RepSummary rep={rep} />
      {rep.topTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rep.topTags.map(([t, n]) => <span key={t} className="rounded-full bg-kraft-50 px-2.5 py-1 text-[11px] font-semibold text-ink ring-1 ring-kraft-200">{t} · {n}</span>)}
        </div>
      )}
      <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-zinc-50 p-2.5 text-[11px] text-zinc-600 ring-1 ring-zinc-100">
        <ShieldCheck size={13} className="mt-px shrink-0" /> Solo puede calificar quien le compró a este vendedor por Haceme Precio. El vendedor puede responder, pero no borrar reseñas.
      </p>
      {rep.count === 0 ? (
        <p className="mt-4 text-center text-sm text-zinc-500">Todavía no tiene reseñas.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100">{rep.list.map((r) => <ReviewItem key={r.id} r={r} />)}</ul>
      )}
    </Sheet>
  );
}

function ReviewFormSheet({ offer, product, seller, actions, onClose }) {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState([]);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const labels = ["", "Muy mal", "Mal", "Más o menos", "Bien", "¡Excelente!"];
  if (done) {
    return (
      <Sheet onClose={onClose} title="¡Gracias!">
        <div className="text-center">
          <Stars value={stars} size={28} />
          <p className="mt-3 text-sm text-zinc-600">Tu reseña ya se ve en el perfil de {seller?.name}. Ayudás a que otros compren tranquilos.</p>
        </div>
        <Btn variant="dark" className="mt-5 w-full py-3" onClick={onClose}>Listo</Btn>
      </Sheet>
    );
  }
  return (
    <Sheet onClose={onClose} title={`¿Cómo te fue con ${seller?.name.split(" ")[0]}?`}>
      <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
        <ProductThumb product={product} size="h-11 w-11" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{product.title}</p>
          <p className="text-xs text-zinc-500">{fmt(offer.finalAmount ?? offer.amount)} · compra verificada</p>
        </div>
      </div>
      <div className="mt-5 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} estrellas`} className="p-1 transition active:scale-90">
            <Star size={40} className={n <= stars ? "fill-[#E8A33D] text-[#E8A33D]" : "text-zinc-300"} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-center text-sm font-semibold">{labels[stars]}</p>
      {stars > 0 && (
        <>
          <p className="mt-3 text-[13px] font-semibold">¿Qué destacás? (opcional)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REVIEW_TAGS.map((t) => (
              <button key={t} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${tags.includes(t) ? "bg-ink text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"}`}>{t}</button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} rows={3} placeholder="Contá cómo fue (opcional)"
            className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
        </>
      )}
      <Btn className="mt-3 w-full py-3.5" disabled={!stars}
        onClick={() => { const r = actions.leaveReview(offer.id, stars, tags, text.trim()); if (r.error) actions.toast("error", "No se pudo", r.error); else setDone(true); }}>
        Publicar reseña
      </Btn>
    </Sheet>
  );
}

function SellerReputation({ seller, reviews, actions }) {
  const rep = repOf(reviews, seller.id);
  const [replying, setReplying] = useState(null);
  const [txt, setTxt] = useState("");
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Star size={13} /> Tu reputación</p>
      <div className="mt-3"><RepSummary rep={rep} /></div>
      {rep.count === 0 ? (
        <p className="mt-3 text-[12px] text-zinc-500">Cuando cierres tu primera venta, el comprador te va a poder calificar. Las estrellas hacen que te ofrezcan más rápido.</p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100">
          {rep.list.slice(0, 5).map((r) => (
            <ReviewItem key={r.id} r={r}>
              {!r.reply && replying !== r.id && (
                <button onClick={() => { setReplying(r.id); setTxt(""); }} className="mt-1.5 text-[12px] font-semibold text-ink underline">Responder</button>
              )}
              {replying === r.id && (
                <div className="mt-2">
                  <textarea value={txt} onChange={(e) => setTxt(e.target.value.slice(0, 200))} rows={2} placeholder="Gracias por tu compra…"
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[13px] outline-none focus:border-zinc-900" />
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <Btn variant="outline" className="py-1.5 text-[13px]" onClick={() => setReplying(null)}>Cancelar</Btn>
                    <Btn className="py-1.5 text-[13px]" disabled={!txt.trim()} onClick={() => { actions.replyReview(r.id, txt.trim()); setReplying(null); }}>Publicar</Btn>
                  </div>
                </div>
              )}
            </ReviewItem>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-zinc-400">Las reseñas no se pueden borrar. Si una es ofensiva o falsa, escribinos y la revisamos.</p>
    </div>
  );
}


/* ============================================================
   TRATO ACORDADO: resumen claro del cierre, para copiar y mandar
   ============================================================ */
const hhmm = (t) => new Date(t).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const SAFETY_NOTE = "Recordá verificar el dinero acreditado en tu cuenta antes de entregar el producto o brindar el servicio.";
function dealSummary(o, p, sellerName, now) {
  const amount = o.finalAmount ?? o.amount;
  const vence = o.expiresAt ? `Vigente hasta las ${hhmm(o.expiresAt)} h (quedan ${mmss(o.expiresAt - now)})` : "Trato cerrado";
  return [
    "🤝 TRATO ACORDADO · Haceme Precio",
    `Producto: ${p.title}`,
    `Monto final: ${fmt(amount)}`,
    `Vendedor: ${sellerName || "—"} · Comprador: ${o.buyerName.replace(" (vos)", "")}`,
    `Entrega: ${o.delivery || (p.pickupPoints[0] ? "Retiro en " + p.pickupPoints[0] : "A coordinar")}`,
    `Pago: ${o.closeMode === "externo" ? "en persona o transferencia" : o.status === "CERRADA_PAGADA" ? "Mercado Pago (verificado)" : "a elegir: Mercado Pago o en persona"}`,
    vence,
    `N° ${o.id.toUpperCase()}`,
    "",
    `⚠️ ${SAFETY_NOTE}`,
  ].join("\n");
}

function DealCard({ offer: o, product: p, sellerName, now, actions, compact = false }) {
  const amount = o.finalAmount ?? o.amount;
  const left = o.expiresAt ? o.expiresAt - now : 0;
  return (
    <div className={`overflow-hidden rounded-2xl bg-white ring-2 ring-ink ${compact ? "mt-3" : ""}`}>
      <div className="flex items-center justify-between bg-ink px-4 py-2.5 text-white">
        <p className="font-display text-[15px] font-extrabold">🤝 Trato acordado</p>
        {o.expiresAt && <span className="rounded-lg bg-white/15 px-2 py-0.5 font-mono text-[12px]">vence en {mmss(left)}</span>}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-3">
          <ProductThumb product={p} size="h-12 w-12" />
          <div className="min-w-0">
            <p className="text-[12px] text-zinc-500">Producto</p>
            <p className="truncate text-[14px] font-semibold">{p.title}</p>
          </div>
        </div>
        <div className="flex items-end justify-between border-t border-dashed border-zinc-200 pt-2">
          <div>
            <p className="text-[12px] text-zinc-500">Monto final</p>
            <p className="text-[26px] font-extrabold leading-tight">{fmt(amount)}</p>
          </div>
          {amount < p.listPrice && <p className="mb-1 text-[12px] text-zinc-400 line-through">{fmt(p.listPrice)}</p>}
        </div>
        <p className="text-[12px] text-zinc-600">
          {o.expiresAt
            ? <>Tienen hasta las <b>{hhmm(o.expiresAt)} h</b> para pagar o coordinar. Si no, se cancela solo y el producto vuelve a estar disponible.</>
            : "Trato cerrado."}
        </p>
        <Btn variant="outline" className="w-full py-2.5 text-[14px]"
          onClick={async () => {
            const ok = await copyText(dealSummary(o, p, sellerName, now));
            actions.toast(ok ? "success" : "error", ok ? "Resumen copiado" : "No se pudo copiar", ok ? "Pegalo en WhatsApp o Messenger." : "Probá desde «Ver recibo del acuerdo».");
          }}>
          <Copy size={15} /> Copiar resumen para WhatsApp/Messenger
        </Btn>
      </div>
      <p className="flex items-start gap-1.5 bg-amber-50 px-4 py-2.5 text-[12px] leading-snug text-amber-900">
        <ShieldCheck size={14} className="mt-px shrink-0" /> {SAFETY_NOTE}
      </p>
    </div>
  );
}

/* ============================================================
   MODO TIENDA (locales con precio fijo: ej. AURA)
   ============================================================ */
const waLink = (num, text) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`;

/* --- Marca de la tienda: logo, portada y color (los carga el dueño; si no, se arma solo con el nombre) --- */
const BRAND_COLORS = ["#111111", "#C8102E", "#B5654A", "#2F6B4F", "#2B4C9B", "#7A3FA0", "#D17A00", "#D14D8A"];
const brandColor = (store) => store?.store?.color || "#111111";
function StoreAvatar({ store, size = 64, logo, color, name }) {
  const src = logo !== undefined ? logo : store?.store?.logo;
  const bg = color || brandColor(store);
  const nm = name || store?.name || "?";
  const ring = size >= 48 ? "ring-4 ring-white shadow-sm" : "ring-1 ring-zinc-200";
  return src
    ? <img src={src} alt={`Logo de ${nm}`} style={{ width: size, height: size }} className={`shrink-0 rounded-2xl bg-white object-cover ${ring}`} />
    : <span style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.42 }} className={`flex shrink-0 items-center justify-center rounded-2xl font-display font-black text-white ${ring}`}>{nm.trim().charAt(0).toUpperCase()}</span>;
}
function StoreBanner({ store, banner, color, h = "h-32" }) {
  const src = banner !== undefined ? banner : store?.store?.banner;
  const bg = color || brandColor(store);
  return src
    ? <img src={src} alt="" className={`${h} w-full object-cover`} />
    : <div className={`${h} w-full`} style={{ background: `linear-gradient(135deg, ${bg} 0%, ${bg}CC 55%, #00000055 100%)` }} />;
}
// Recorta una foto al tamaño pedido (centrada, sin deformar) y la comprime
async function cropImage(file, w, h) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.max(w / img.width, h / img.height);
    const sw = w / k, sh = h / k;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function BrandEditor({ name, value, onChange, tagline }) {
  const logoRef = useRef(null);
  const bannerRef = useRef(null);
  const pick = async (e, kind) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const data = kind === "logo" ? await cropImage(f, 400, 400) : await cropImage(f, 1200, 400);
    onChange({ ...value, [kind]: data });
  };
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <button type="button" onClick={() => bannerRef.current?.click()} className="relative block w-full" aria-label="Cambiar portada">
          <StoreBanner banner={value.banner || null} color={value.color} h="h-24" />
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white"><Camera size={12} /> {value.banner ? "Cambiar portada" : "Subir portada"}</span>
        </button>
        <div className="flex items-end gap-3 px-3 pb-3">
          <button type="button" onClick={() => logoRef.current?.click()} className="relative -mt-8" aria-label="Cambiar logo">
            <StoreAvatar logo={value.logo || null} color={value.color} name={name} size={64} />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white ring-2 ring-white"><Camera size={12} /></span>
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
        <Btn variant="outline" className="py-2.5 text-[13px]" onClick={() => logoRef.current?.click()}><ImageIcon size={14} /> {value.logo ? "Cambiar logo" : "Subir logo"}</Btn>
        <Btn variant="outline" className="py-2.5 text-[13px]" onClick={() => bannerRef.current?.click()}><ImageIcon size={14} /> {value.banner ? "Cambiar portada" : "Subir portada"}</Btn>
      </div>
      <p className="text-[11px] text-zinc-500">Logo cuadrado, como el de tu Instagram. Portada horizontal: una foto del local o de tu ropa. Las recortamos solas.</p>
      {(value.logo || value.banner) && (
        <div className="flex gap-3 text-[12px]">
          {value.logo && <button type="button" onClick={() => onChange({ ...value, logo: null })} className="font-semibold text-zinc-500 underline">Quitar logo</button>}
          {value.banner && <button type="button" onClick={() => onChange({ ...value, banner: null })} className="font-semibold text-zinc-500 underline">Quitar portada</button>}
        </div>
      )}
      <div>
        <p className="text-[12px] font-semibold">Color de tu marca</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {BRAND_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => onChange({ ...value, color: c })} aria-label={`Color ${c}`}
              style={{ backgroundColor: c }} className={`h-9 w-9 rounded-full ring-offset-2 ${value.color === c ? "ring-2 ring-ink" : ""}`} />
          ))}
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">Se usa en los botones y en las categorías de tu tienda.</p>
      </div>
    </div>
  );
}

function StoreLogo({ name, size = "text-3xl" }) {
  return <span className={`font-display ${size} font-black lowercase tracking-tight`}>{name}</span>;
}

function StoreFront({ store, products, trust, cart, orders, onOpen, actions, onReviews, now = Date.now() }) {
  const promo = promoOf(store, now);
  const [col, setCol] = useState("Todo");
  const [size, setSize] = useState(null);
  const collections = ["Todo", ...new Set(products.map((p) => p.collection).filter(Boolean))];
  const sizes = [...new Set(products.flatMap((p) => (hasVariants(p) ? p.variants.filter((v) => v.stock > 0).map((v) => v.size) : [])))];
  const list = products
    .filter((p) => col === "Todo" || p.collection === col)
    .filter((p) => !size || (hasVariants(p) && p.variants.some((v) => v.size === size && v.stock > 0)));
  const myCart = cart.filter((c) => products.some((p) => p.id === c.productId));
  const cartTotal = myCart.reduce((s, c) => { const p = products.find((x) => x.id === c.productId); return s + (p ? priceNow(p, store, now) : 0) * c.qty; }, 0);
  const cartCount = myCart.reduce((s, c) => s + c.qty, 0);
  const lastOrder = orders[0];
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
        <Lock size={11} className="text-zinc-500" />
        <span className="truncate font-mono text-[11px] text-zinc-600">hacemeprecio.app/{sellerSlug(store)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white pb-24 hp-scroll">
        <StoreBanner store={store} />
        <div className="px-5 pb-4">
          <div className="-mt-11 flex items-end justify-between">
            <StoreAvatar store={store} size={88} />
            {store.phoneVerified && <span className="mb-1 flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700"><BadgeCheck size={13} /> Verificada</span>}
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight">{store.name}</h1>
          {store.store?.tagline && <p className="text-[13px] text-zinc-600">{store.store.tagline}</p>}
          <div className="mt-1.5"><RatingLine rep={trust?.rep} onClick={onReviews} /></div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-zinc-500"><MapPin size={13} className="shrink-0" /> {store.store?.address} · {store.store?.hours}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={waLink(store.store?.whatsapp || "", `Hola ${store.name}! Vi su tienda en Haceme Precio 🙂`)} target="_blank" rel="noopener noreferrer"
              style={{ backgroundColor: brandColor(store) }} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold text-white"><MessageCircle size={16} /> WhatsApp</a>
            <button onClick={onReviews} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl text-[14px] font-semibold text-ink ring-1 ring-zinc-300"><Star size={15} /> Reseñas</button>
          </div>
        </div>
        {promo && (
          <button onClick={() => setCol(promo.scope && promo.scope !== "Todo" ? promo.scope : "Todo")}
            className="mx-4 mt-3 block w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-hpred text-left text-white">
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">{promo.label || "Promo"}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">Ver productos ›</span>
            </div>
            <p className="px-4 font-display text-2xl font-extrabold leading-tight">{promo.pct}% OFF {promo.scope && promo.scope !== "Todo" ? `en ${promo.scope}` : "en toda la tienda"}</p>
            <div className="mt-2 flex items-center justify-between bg-black/20 px-4 py-2 text-[12px]">
              <span className="flex items-center gap-1.5"><Clock size={13} /> Termina en <b className="font-mono text-[13px]">{countdown(promo.endsAt - now)}</b></span>
              <span className="text-white/80">hasta el {fmtDate(promo.endsAt)} {hhmm(promo.endsAt)} h</span>
            </div>
          </button>
        )}
        {store.store?.freeShipFrom > 0 && (
          <p className="mx-4 mt-2 flex items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-2 text-[12px] text-zinc-700 ring-1 ring-zinc-200"><Truck size={14} className="shrink-0" /> Envío gratis en compras desde <b>{fmt(store.store.freeShipFrom)}</b></p>
        )}
        {lastOrder && (
          <button onClick={() => actions.setSheet({ type: "order", orderId: lastOrder.id })}
            className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center justify-between rounded-2xl bg-kraft-50 px-4 py-3 text-left ring-1 ring-kraft-200">
            <span className="text-[13px]"><b>Tu pedido {lastOrder.id}</b><span className="block text-[12px] text-zinc-600">{ORDER_STATUS[lastOrder.status].buyer}</span></span>
            <ChevronRight size={18} />
          </button>
        )}
        <div className="sticky top-0 z-10 space-y-2 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex gap-1.5 overflow-x-auto hp-scroll">
            {collections.map((c) => (
              <button key={c} onClick={() => setCol(c)} style={col === c ? { backgroundColor: brandColor(store) } : undefined} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${col === c ? "text-white" : "bg-zinc-100 text-zinc-700"}`}>
                {c === "Liquidación" ? "🔥 Liquidación" : c}
              </button>
            ))}
          </div>
          {sizes.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto hp-scroll">
              <span className="shrink-0 text-[11px] font-semibold text-zinc-500">Talle:</span>
              {sizes.map((z) => (
                <button key={z} onClick={() => setSize(size === z ? null : z)} className={`h-8 min-w-8 shrink-0 rounded-lg px-2 text-[12px] font-bold ${size === z ? "bg-hpred text-white" : "bg-white text-ink ring-1 ring-zinc-300"}`}>{z}</button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 px-4">
          {list.map((p) => {
            const out = totalStock(p) <= 0 || p.status === "vendido";
            const colors = hasVariants(p) ? [...new Set(p.variants.map((v) => v.color))] : [];
            return (
              <button key={p.id} onClick={() => onOpen(p.id)} className="relative overflow-hidden rounded-2xl bg-white text-left ring-1 ring-zinc-200 transition active:scale-[0.98]">
                <ProductThumb product={p} size="h-44 w-full !rounded-none" iconSize={40} />
                {p.liquidation ? <span className="absolute left-2 top-2 rounded-full bg-hpred px-2 py-0.5 text-[10px] font-bold text-white">🔥 Haceme precio</span>
                  : priceBefore(p, store, now) ? <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${promoApplies(p, promo) ? "bg-hpred" : "bg-ink"}`}>-{Math.round((1 - priceNow(p, store, now) / priceBefore(p, store, now)) * 100)}%{promoApplies(p, promo) ? " · promo" : ""}</span> : null}
                {out && <span className="absolute inset-x-0 top-16 mx-auto w-fit rounded-lg bg-white/90 px-3 py-1 text-[12px] font-bold">Agotado</span>}
                <div className="p-2.5">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug">{p.title}</p>
                  <p className="mt-1 text-base font-extrabold">{fmt(priceNow(p, store, now))} {priceBefore(p, store, now) && <span className="text-[12px] font-medium text-zinc-400 line-through">{fmt(priceBefore(p, store, now))}</span>}</p>
                  {colors.length > 0 && (
                    <div className="mt-1.5 flex gap-1">{colors.map((c) => <span key={c} title={c} className="h-3.5 w-3.5 rounded-full ring-1 ring-zinc-300" style={{ background: COLOR_HEX[c] || "#ccc" }} />)}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {list.length === 0 && <p className="px-6 py-8 text-center text-sm text-zinc-500">{products.length ? "No hay prendas con ese filtro." : "Esta tienda todavía no cargó productos. ¡Volvé pronto!"}</p>}
        <div className="mt-6" />
        <FaqList title={`Preguntas frecuentes · ${store.name}`} Icon={MessageSquareOff} items={store.store?.faq?.length ? store.store.faq : defaultStoreFaq(store)} />
        <FaqList title="Cómo comprar con Haceme Precio" Icon={ShieldCheck} dark items={PLATFORM_FAQ.tienda} />
        <p className="mt-6 px-6 text-center text-[10px] leading-relaxed text-zinc-400">Tienda hecha con Haceme Precio. Haceme Precio es una herramienta de gestión de ventas entre partes; no actúa como intermediario financiero ni garantiza entregas físicas.</p>
      </div>
      {cartCount > 0 && (
        <div className="absolute inset-x-0 bottom-0 border-t border-zinc-200 bg-white p-3">
          <Btn className="w-full py-3.5" style={{ backgroundColor: brandColor(store) }} onClick={() => actions.setSheet({ type: "cart", storeId: store.id })}>
            <ShoppingBag size={17} /> Ver carrito ({cartCount}) · {fmt(cartTotal)}
          </Btn>
        </div>
      )}
    </div>
  );
}

function StoreProduct({ product: p, store, cart, actions, onBack, now = Date.now() }) {
  const promo = promoOf(store, now);
  const unit = priceNow(p, store, now);
  const before = priceBefore(p, store, now);
  const colors = [...new Set(p.variants.map((v) => v.color))];
  const firstColor = colors.find((c) => p.variants.some((v) => v.color === c && v.stock > 0)) || colors[0];
  const [color, setColor] = useState(firstColor);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const vs = p.variants.filter((v) => v.color === color);
  const sel = vs.find((v) => v.size === size);
  const inCart = cart.filter((c) => c.productId === p.id).reduce((s, c) => s + c.qty, 0);
  const cartAll = cart.filter((c) => c.productId && true);
  const shown = { ...p, photos: photosFor(p, color) };
  const ask = `Hola ${store?.name}! Consulta por «${p.title}»${color ? ` color ${color}` : ""}${size ? ` talle ${size}` : ""}: ¿`;
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5">
        <Lock size={11} className="text-zinc-500" />
        <span className="truncate font-mono text-[11px] text-zinc-600">hacemeprecio.app/{sellerSlug(store)}/{p.slug}</span>
      </div>
      <BackBar label={`la tienda ${store?.name}`} onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-white pb-6 hp-scroll">
        <Gallery key={color} product={shown} sold={totalStock(p) <= 0} reserved={false} />
        <div className="px-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-zinc-400"><StoreAvatar store={store} size={22} /> {store?.name} · {p.collection}</p>
          <h1 className="mt-0.5 text-xl font-bold leading-snug">{p.title}</h1>
          <p className="mt-1 text-2xl font-extrabold">{fmt(unit)} {before && <span className="text-base font-medium text-zinc-400 line-through">{fmt(before)}</span>}</p>
          <p className="text-[12px] text-zinc-500">Precio fijo · nuevo con etiqueta</p>
          {promoApplies(p, promo) && (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-hpred/10 px-3 py-2 text-[12px] font-semibold text-hpred">
              <Clock size={14} className="shrink-0" /> {promo.pct}% OFF · termina en <span className="font-mono">{countdown(promo.endsAt - now)}</span>
            </p>
          )}

          {colors.length > 1 || colors[0] ? (
            <div className="mt-4">
              <p className="text-sm font-semibold">Color: <span className="font-normal text-zinc-600">{color}</span></p>
              <div className="mt-2 flex gap-2">
                {colors.map((c) => (
                  <button key={c} onClick={() => { setColor(c); setSize(null); setQty(1); }} aria-label={c}
                    className={`h-10 w-10 rounded-full ring-2 ring-offset-2 ${color === c ? "ring-hpred" : "ring-transparent"}`} style={{ background: COLOR_HEX[c] || "#ccc", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="text-sm font-semibold">Talle</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {vs.map((v) => (
                <button key={v.id} disabled={v.stock <= 0} onClick={() => { setSize(v.size); setQty(1); }}
                  className={`relative h-12 min-w-12 rounded-xl px-3 text-[15px] font-bold transition ${size === v.size ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-zinc-300"} disabled:text-zinc-300 disabled:ring-zinc-200`}>
                  {v.size}
                  {v.stock <= 0 && <span className="absolute inset-x-1 top-1/2 h-0.5 -rotate-12 bg-zinc-300" />}
                </button>
              ))}
            </div>
            {sel && <p className={`mt-2 text-[12px] font-semibold ${sel.stock <= 2 ? "text-hpred" : "text-zinc-500"}`}>{sel.stock === 1 ? "¡Queda 1!" : `Quedan ${sel.stock}`}</p>}
            {vs.some((v) => v.stock <= 0) && <p className="mt-1 text-[11px] text-zinc-400">Los talles tachados están agotados.</p>}
          </div>

          {sel && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-semibold">Cantidad</span>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-10 rounded-xl text-xl font-bold ring-1 ring-zinc-300">−</button>
              <span className="w-6 text-center text-lg font-bold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(sel.stock, q + 1))} className="h-10 w-10 rounded-xl text-xl font-bold ring-1 ring-zinc-300">+</button>
            </div>
          )}

          <Btn className="mt-4 w-full py-3.5 text-base" disabled={!sel} onClick={() => actions.addToCart(p.id, sel.id, qty)}>
            <ShoppingBag size={18} /> {sel ? `Lo quiero · ${fmt(unit * qty)}` : "Elegí tu talle"}
          </Btn>
          <a href={waLink(store?.store?.whatsapp || "", ask)} target="_blank" rel="noopener noreferrer"
            className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-ink ring-1 ring-zinc-300">
            <MessageCircle size={17} /> Consultar por WhatsApp
          </a>
          {inCart > 0 && (
            <button onClick={() => actions.setSheet({ type: "cart", storeId: store.id })} className="mt-2 w-full text-center text-[13px] font-semibold text-hpred underline">
              Ya tenés {inCart} en el carrito · Ver carrito
            </button>
          )}

          <section className="mt-5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
            <ul className="space-y-1.5 text-[13px]">{p.highlights.map((h) => <li key={h} className="flex gap-2"><Check size={14} className="mt-0.5 text-hpred" /> {h}</li>)}</ul>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{p.description}</p>
          </section>
          <section className="mt-3 space-y-1.5 rounded-2xl bg-zinc-50 p-4 text-[13px] ring-1 ring-zinc-100">
            <p className="flex gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-zinc-500" /> Retiro gratis en {store?.store?.address} · {store?.store?.hours}</p>
            {p.shipping.enabled && <p className="flex gap-2"><Truck size={15} className="mt-0.5 shrink-0 text-zinc-500" /> Envíos: {p.shipping.note}{store?.store?.freeShipFrom > 0 ? ` · gratis desde ${fmt(store.store.freeShipFrom)}` : ""}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

function CartSheet({ store, cart, productById, actions, onClose, now = Date.now() }) {
  const [delivery, setDelivery] = useState("retiro");
  const [pay, setPay] = useState("mp");
  const [stage, setStage] = useState("form");
  const promo = promoOf(store, now);
  const total = cart.reduce((s, c) => { const p = productById(c.productId); return s + (p ? priceNow(p, store, now) : 0) * c.qty; }, 0);
  const fullTotal = cart.reduce((s, c) => s + (productById(c.productId)?.listPrice || 0) * c.qty, 0);
  const canShip = cart.some((c) => productById(c.productId)?.shipping?.enabled);
  const freeFrom = store?.store?.freeShipFrom || 0;
  const missing = Math.max(0, freeFrom - total);
  const confirm = () => {
    const deliveryLabel = delivery === "retiro" ? `Retiro en el local (${store?.store?.address})` : "Envío a domicilio (se coordina con la tienda)";
    const go = () => {
      const r = actions.placeOrder({ storeId: store.id, delivery: deliveryLabel, pay: delivery === "envio" ? "mp" : pay });
      if (r.error) { setStage("form"); return actions.toast("error", "No se pudo", r.error); }
      actions.setSheet({ type: "order", orderId: r.order.id });
    };
    if (pay === "mp" || delivery === "envio") { setStage("waiting"); setTimeout(go, 1500); } else go();
  };
  if (!cart.length) {
    return (
      <Sheet onClose={onClose} title="Tu carrito">
        <p className="py-6 text-center text-sm text-zinc-500">Tu carrito está vacío.</p>
        <Btn variant="dark" className="w-full py-3" onClick={onClose}>Seguir mirando</Btn>
      </Sheet>
    );
  }
  return (
    <Sheet onClose={stage === "waiting" ? () => {} : onClose} title={`Tu pedido en ${store?.name}`}>
      <ul className="divide-y divide-zinc-100">
        {cart.map((c) => {
          const p = productById(c.productId);
          const v = p.variants?.find((x) => x.id === c.variantId);
          return (
            <li key={c.productId + c.variantId} className="flex items-center gap-3 py-2.5">
              <ProductThumb product={{ ...p, photos: photosFor(p, v?.color) }} size="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{p.title}</p>
                <p className="text-[12px] text-zinc-500">{v ? variantLabel(v) : "Talle único"} · {fmt(priceNow(p, store, now))}{priceNow(p, store, now) < p.listPrice && <span className="ml-1 text-zinc-400 line-through">{fmt(p.listPrice)}</span>}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => actions.setCartQty(c.productId, c.variantId, c.qty - 1)} className="h-8 w-8 rounded-lg font-bold ring-1 ring-zinc-300" aria-label="Uno menos">{c.qty === 1 ? <Trash2 size={13} className="mx-auto" /> : "−"}</button>
                <span className="w-5 text-center font-bold">{c.qty}</span>
                <button onClick={() => actions.setCartQty(c.productId, c.variantId, c.qty + 1)} className="h-8 w-8 rounded-lg font-bold ring-1 ring-zinc-300" aria-label="Uno más">+</button>
              </div>
            </li>
          );
        })}
      </ul>

      {freeFrom > 0 && canShip && (
        <div className="mt-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Truck size={15} className={missing === 0 ? "text-hpred" : "text-zinc-500"} />
            {missing === 0 ? "¡Tenés envío gratis!" : <>Te faltan <b>{fmt(missing)}</b> para el envío gratis</>}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full rounded-full bg-hpred transition-all" style={{ width: `${Math.min(100, (total / freeFrom) * 100)}%` }} />
          </div>
          {missing > 0 && <button onClick={onClose} className="mt-1.5 text-[12px] font-semibold text-hpred underline">Seguir mirando</button>}
        </div>
      )}
      {promo && fullTotal > total && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-hpred"><Tag size={13} className="shrink-0" /> Ahorrás {fmt(fullTotal - total)} con la promo · termina en <span className="font-mono">{countdown(promo.endsAt - now)}</span></p>
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">¿Cómo lo recibís?</p>
      <div className="mt-2 space-y-2">
        <Choice active={delivery === "retiro"} onClick={() => setDelivery("retiro")} Icon={MapPin} title="Lo retiro en el local · gratis" sub={`${store?.store?.address} · ${store?.store?.hours}`} />
        {canShip && <Choice active={delivery === "envio"} onClick={() => { setDelivery("envio"); setPay("mp"); }} Icon={Truck} title={freeFrom > 0 && missing === 0 ? "Envío a domicilio · gratis" : "Envío a domicilio"} sub={freeFrom > 0 && missing === 0 ? "Lo cubre la tienda" : "El costo lo coordinás con la tienda"} />}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">¿Cómo pagás?</p>
      <div className="mt-2 space-y-2">
        <Choice active={pay === "mp"} onClick={() => setPay("mp")} Icon={Wallet} title="Mercado Pago, ahora" sub="El pedido se confirma cuando la pasarela verifica el pago" />
        {delivery === "retiro" && <Choice active={pay === "local"} onClick={() => setPay("local")} Icon={Store} title="Pago en el local al retirar" sub={`Te lo reservamos ${RESERVE_HOURS} h`} />}
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-zinc-100 pt-3">
        <span className="text-sm text-zinc-500">Total</span>
        <span className="text-2xl font-extrabold">{fmt(total)}</span>
      </div>
      <Btn className="mt-3 w-full py-3.5 text-base" disabled={stage === "waiting"} onClick={confirm}>
        {stage === "waiting" ? "Esperando confirmación de Mercado Pago…" : pay === "mp" || delivery === "envio" ? `Pagar ${fmt(total)}` : "Reservar y pagar al retirar"}
      </Btn>
    </Sheet>
  );
}

function Choice({ active, onClick, Icon, title, sub }) {
  return (
    <button onClick={onClick} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${active ? "border-hpred bg-kraft-50/50 ring-1 ring-hpred" : "border-zinc-200"}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-zinc-500">{sub}</span></span>
    </button>
  );
}

const ORDER_STATUS = {
  nuevo: { label: "Nuevo", cls: "bg-hpred text-white ring-hpred", buyer: "Recibido · la tienda lo está preparando" },
  preparado: { label: "Listo", cls: "bg-kraft-100 text-ink ring-kraft-200", buyer: "¡Listo! Ya podés retirarlo" },
  entregado: { label: "Entregado", cls: "bg-ink text-white ring-ink", buyer: "Entregado · ¡gracias por tu compra!" },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200", buyer: "Cancelado por la tienda" },
  vencido: { label: "Reserva vencida", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200", buyer: "La reserva venció sin retirar" },
};

function orderSummary(o, store, productById) {
  return [
    `🛍️ PEDIDO ${o.id} · ${store?.name} (Haceme Precio)`,
    ...o.items.map((i) => { const p = productById(i.productId); const v = p?.variants?.find((x) => x.id === i.variantId); return `• ${i.qty}× ${p?.title}${v ? ` (${variantLabel(v)})` : ""} — ${fmt(i.price * i.qty)}`; }),
    `Total: ${fmt(o.total)}`,
    `Entrega: ${o.delivery}`,
    `Pago: ${o.paid ? (o.paidExternal ? "cobrado en el local" : "Mercado Pago (verificado)") : "en el local al retirar"}`,
    "",
    `⚠️ ${SAFETY_NOTE}`,
  ].join("\n");
}

function OrderSheet({ order: o, store, productById, now, onClose, actions }) {
  const st = ORDER_STATUS[o.status];
  return (
    <Sheet onClose={onClose} title="Tu pedido">
      <div className="overflow-hidden rounded-2xl ring-2 ring-ink">
        <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
          <div><p className="text-[11px] uppercase tracking-wider text-zinc-400">{store?.name}</p><p className="font-display text-lg font-extrabold">{st.buyer}</p></div>
          <BadgeCheck size={26} className="text-kraft" />
        </div>
        <div className="p-4">
          <p className="text-[12px] text-zinc-500">Número de pedido</p>
          <p className="font-mono text-2xl font-bold tracking-widest">{o.id}</p>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            {o.items.map((i) => { const p = productById(i.productId); const v = p?.variants?.find((x) => x.id === i.variantId); return (
              <li key={i.productId + i.variantId} className="flex justify-between gap-2"><span>{i.qty}× {p?.title} <span className="text-zinc-500">{v ? `(${variantLabel(v)})` : ""}</span></span><b>{fmt(i.price * i.qty)}</b></li>
            ); })}
          </ul>
          <div className="mt-2 flex justify-between border-t border-dashed border-zinc-200 pt-2"><span className="text-sm">Total</span><b className="text-lg">{fmt(o.total)}</b></div>
          <p className="mt-2 text-[12px] text-zinc-600">{o.delivery}</p>
          <p className="mt-1 text-[12px] font-semibold">
            {o.paid ? (o.paidExternal ? "Cobrado en el local" : "✅ Pagado · verificado por Mercado Pago") : <>Pagás al retirar · reserva vence en <span className="font-mono">{mmss((o.reservedUntil || now) - now)}</span></>}
          </p>
        </div>
        <p className="flex items-start gap-1.5 bg-amber-50 px-4 py-2.5 text-[12px] leading-snug text-amber-900"><ShieldCheck size={14} className="mt-px shrink-0" /> Mostrá el número de pedido al retirar. {SAFETY_NOTE}</p>
      </div>
      <Btn variant="outline" className="mt-3 w-full py-3"
        onClick={async () => { const ok = await copyText(orderSummary(o, store, productById)); actions.toast(ok ? "success" : "error", ok ? "Resumen copiado" : "No se pudo copiar", ok ? "Pegalo en WhatsApp." : ""); }}>
        <Copy size={15} /> Copiar resumen para WhatsApp
      </Btn>
      <a href={waLink(store?.store?.whatsapp || "", `Hola ${store?.name}! Te escribo por mi pedido ${o.id}`)} target="_blank" rel="noopener noreferrer"
        className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-semibold text-white">
        <MessageCircle size={17} /> Hablar con {store?.name} por WhatsApp
      </a>
    </Sheet>
  );
}

function OrdersPanel({ orders, productById, now, actions }) {
  const [filter, setFilter] = useState("activos");
  const list = orders.filter((o) => (filter === "activos" ? ["nuevo", "preparado"].includes(o.status) : true)).sort((a, b) => b.at - a.at);
  return (
    <div className="px-4 pb-4 pt-3">
      <div className="mb-3 flex items-center gap-2">
        <Filter size={13} className="text-zinc-400" />
        {[{ k: "activos", l: "Para preparar" }, { k: "todos", l: "Todos" }].map(({ k, l }) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === k ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>{l}</button>
        ))}
      </div>
      {list.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">No hay pedidos para preparar.</div>}
      <div className="space-y-3">{list.map((o) => <OrderCard key={o.id} o={o} productById={productById} now={now} actions={actions} />)}</div>
    </div>
  );
}

function OrderCard({ o, productById, now, actions }) {
  const [closing, setClosing] = useState(false);
  const [verified, setVerified] = useState(false);
  const st = ORDER_STATUS[o.status];
  return (
    <div className={`rounded-2xl bg-white p-3.5 ring-1 ${o.status === "nuevo" ? "ring-2 ring-hpred" : "ring-zinc-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[13px] font-bold">{o.id}</p>
          <p className="text-[13px] font-semibold">{o.buyerName} <span className="font-normal text-zinc-500">· {clockTime(o.at).slice(0, 5)}</span></p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${st.cls}`}>{st.label}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {o.items.map((i) => { const p = productById(i.productId); const v = p?.variants?.find((x) => x.id === i.variantId); return (
          <li key={i.productId + i.variantId} className="flex items-center gap-2.5">
            {p && <ProductThumb product={{ ...p, photos: photosFor(p, v?.color) }} size="h-11 w-11" />}
            <div className="min-w-0 flex-1 text-[13px]"><p className="truncate font-medium">{i.qty}× {p?.title}</p><p className="text-[12px] text-zinc-500">{v ? variantLabel(v) : "Talle único"}</p></div>
            <b className="text-[13px]">{fmt(i.price * i.qty)}</b>
          </li>
        ); })}
      </ul>
      <div className="mt-2 flex items-end justify-between border-t border-dashed border-zinc-200 pt-2">
        <div className="text-[12px] text-zinc-600"><p>{o.delivery}</p>
          <p className={`font-semibold ${o.paid ? "text-ink" : "text-amber-700"}`}>{o.paid ? (o.paidExternal ? "Cobrado en el local" : "✅ Pagado · Mercado Pago verificado") : <>Paga al retirar · reserva {o.status === "nuevo" || o.status === "preparado" ? <span className="font-mono">{mmss((o.reservedUntil || now) - now)}</span> : "—"}</>}</p>
        </div>
        <p className="text-xl font-extrabold">{fmt(o.total)}</p>
      </div>
      {["nuevo", "preparado"].includes(o.status) && !closing && (
        <div className="mt-3 space-y-2">
          {o.status === "nuevo" ? (
            <Btn className="w-full py-3" onClick={() => actions.setOrderStatus(o.id, "preparado")}><Package size={16} /> Ya lo preparé</Btn>
          ) : (
            <Btn variant="dark" className="w-full py-3" onClick={() => (o.paid ? actions.setOrderStatus(o.id, "entregado") : setClosing(true))}><Check size={16} /> Lo entregué</Btn>
          )}
          <Btn variant="danger" className="w-full py-2 text-[13px]" onClick={() => actions.setOrderStatus(o.id, "cancelado")}><X size={14} /> Cancelar pedido (vuelve el stock)</Btn>
        </div>
      )}
      {closing && (
        <div className="mt-3 rounded-xl border-2 border-hpred p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-hpred"><AlertTriangle size={14} /> Antes de entregar</p>
          <p className="mt-1 text-[12px]">{SAFETY_NOTE} No te guíes solo por capturas de pantalla.</p>
          <label className="mt-2 flex items-start gap-2 text-[12px]"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5 accent-hpred" /> Cobré {fmt(o.total)} (vi el dinero acreditado o lo recibí en mano).</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Btn variant="outline" className="py-1.5 text-[12px]" onClick={() => setClosing(false)}>Volver</Btn>
            <Btn className="py-1.5 text-[12px]" disabled={!verified} onClick={() => { actions.setOrderStatus(o.id, "entregado"); setClosing(false); }}>Entregado</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function VariantStockEditor({ product: p, actions }) {
  const colors = [...new Set(p.variants.map((v) => v.color))];
  const setStock = (id, n) => actions.updateProduct(p.id, { variants: p.variants.map((v) => (v.id === id ? { ...v, stock: Math.max(0, n) } : v)), status: "activo" });
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
      {colors.map((c) => (
        <div key={c}>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold"><span className="h-3.5 w-3.5 rounded-full ring-1 ring-zinc-300" style={{ background: COLOR_HEX[c] || "#ccc" }} /> {c}</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {p.variants.filter((v) => v.color === c).map((v) => (
              <div key={v.id} className={`flex items-center justify-between rounded-lg bg-white px-2 py-1.5 ring-1 ${v.stock === 0 ? "ring-hpred/40" : "ring-zinc-200"}`}>
                <span className="text-[12px] font-bold">{v.size}</span>
                <span className="flex items-center gap-1">
                  <button onClick={() => setStock(v.id, v.stock - 1)} className="h-6 w-6 rounded-md text-sm font-bold ring-1 ring-zinc-200" aria-label={`Menos ${v.size}`}>−</button>
                  <span className={`w-5 text-center text-[12px] font-bold ${v.stock === 0 ? "text-hpred" : ""}`}>{v.stock}</span>
                  <button onClick={() => setStock(v.id, v.stock + 1)} className="h-6 w-6 rounded-md text-sm font-bold ring-1 ring-zinc-200" aria-label={`Más ${v.size}`}>+</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-zinc-500">Cuando un talle llega a 0 aparece como agotado. Si vendés en el local, descontalo acá.</p>
    </div>
  );
}

/* ============================================================
   PÁGINA DE INICIO (hacemeprecio.app) — para que se registren solos
   ============================================================ */
function LandingPage({ actions, onExample, onExampleStore, onLogin }) {
  const [faq, setFaq] = useState(0);
  const plans = [
    { k: "pase", e: "🏷️", t: "Vendo una sola cosa", p: `${fmt(PASS_PRICE)}`, per: "pago único", d: `1 publicación por ${PASS_DAYS} días. Ideal para vender el sillón o la bici.`, cta: "Empezar" },
    { k: "mensual", e: "🛍️", t: "Vendo seguido", p: fmt(SUB_PRICE), per: "/mes", d: "Publicaciones sin límite, tu vidriera y varias unidades del mismo producto.", cta: `Probar ${TRIAL_DAYS} días gratis`, star: true },
    { k: "tienda", e: "🏬", t: "Tengo un local", p: fmt(TIENDA_PRICE), per: "/mes", d: "Precio fijo, talles y colores, carrito y pedidos con retiro o envío.", cta: `Probar ${TRIAL_DAYS} días gratis` },
    { k: "pro", e: "✨", t: "Pro · con IA", p: fmt(PRO_PRICE), per: "/mes", d: "Todo lo de Vendo seguido + la IA arma tus publicaciones desde las fotos.", cta: `Probar ${TRIAL_DAYS} días gratis`, tag: "Nuevo" },
  ];
  const faqs = [
    ["¿Tengo que dejar Marketplace, Instagram o WhatsApp?", "No. Seguís publicando donde siempre y compartís tu link. Haceme Precio se encarga de las ofertas, los pedidos y las preguntas repetidas."],
    ["¿El comprador tiene que descargar algo?", "No. Toca el link, ve fotos y precio, y oferta o compra desde el navegador. Sin cuenta ni contraseña."],
    ["¿Cómo cobro?", "Con Mercado Pago dentro de la app (se confirma solo cuando el pago está verificado) o en persona. Nunca te pedimos capturas de pantalla como comprobante."],
    ["¿Puedo cancelar cuando quiera?", "Sí, desde «Mi cuenta», con un botón. Seguís usando lo que pagaste hasta el final del mes."],
    ["¿Y si necesito ayuda?", "Tenés preguntas frecuentes y un formulario de ayuda dentro de la app. Te respondemos ahí mismo."],
  ];
  return (
    <div className="h-full overflow-y-auto bg-kraft-50 hp-scroll">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-7 w-auto" />
        <button onClick={onLogin} className="rounded-xl px-3 py-2 text-[13px] font-semibold text-ink ring-1 ring-zinc-300">Ingresar</button>
      </div>

      <section className="px-5 pb-6 pt-6">
        <h1 className="font-display text-[34px] font-black leading-[1.05] tracking-tight">
          Vendé sin contestar 40 veces <span className="relative inline-block">“¿sigue disponible?”<span className="absolute inset-x-0 top-[55%] h-[6px] -rotate-3 rounded bg-hpred" /></span>
        </h1>
        <p className="mt-3 text-[15px] leading-snug text-zinc-600">Por WhatsApp, Instagram, Marketplace o en tu local: compartís un link y te llegan <b className="text-ink">ofertas en serio y pedidos</b>, no charlas eternas.</p>
        <Btn className="mt-5 w-full py-4 text-base" onClick={() => actions.startSignup("mensual")}>Empezar gratis</Btn>
        <p className="mt-2 text-center text-[12px] text-zinc-500">{TRIAL_DAYS} días gratis · sin tarjeta · cancelás cuando quieras</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onExample} className="rounded-2xl bg-white py-3 text-[13px] font-semibold ring-1 ring-zinc-200">👀 Ver un producto</button>
          <button onClick={onExampleStore} className="rounded-2xl bg-white py-3 text-[13px] font-semibold ring-1 ring-zinc-200">🏬 Ver una tienda</button>
        </div>
      </section>

      <section className="bg-white px-5 py-7">
        <h2 className="font-display text-xl font-extrabold">Así de simple</h2>
        <ol className="mt-4 space-y-4">
          {[
            ["📸", "Sacás una foto", "Le ponés precio y lo mínimo que aceptás. Listo en menos de un minuto."],
            ["🔗", "Compartís tu link", "En tu estado de WhatsApp, en Instagram, en Marketplace o en un grupo."],
            ["📲", "Te llega lo que vale la pena", "Las ofertas bajas se frenan solas. Las buenas te avisan al celu y decidís con un botón."],
          ].map(([e, t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-kraft-100 text-xl">{e}</span>
              <div><p className="text-[15px] font-bold">{i + 1}. {t}</p><p className="text-[13px] text-zinc-600">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-5 py-7">
        <h2 className="font-display text-xl font-extrabold">¿Qué vendés?</h2>
        <p className="mt-1 text-[13px] text-zinc-600">Elegí tu plan. Lo podés cambiar cuando quieras.</p>
        <div className="mt-4 space-y-3">
          {plans.map((pl) => (
            <div key={pl.k} className={`rounded-2xl bg-white p-4 ${pl.star ? "ring-2 ring-hpred" : "ring-1 ring-zinc-200"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[16px] font-bold">{pl.e} {pl.t}</p>
                {pl.star && <span className="rounded-full bg-hpred px-2 py-0.5 text-[10px] font-bold text-white">El más elegido</span>}
                {pl.tag && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">{pl.tag}</span>}
              </div>
              <p className="mt-1"><span className="font-display text-2xl font-extrabold">{pl.p}</span> <span className="text-[13px] text-zinc-500">{pl.per}</span></p>
              <p className="mt-1 text-[13px] text-zinc-600">{pl.d}</p>
              <Btn variant={pl.star ? "primary" : "outline"} className="mt-3 w-full py-3" onClick={() => actions.startSignup(pl.k)}>{pl.cta}</Btn>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink px-5 py-7 text-white">
        <h2 className="font-display text-xl font-extrabold">Vendé tranquilo</h2>
        <ul className="mt-3 space-y-2.5 text-[14px] text-zinc-200">
          <li>🛡️ «Pagado» solo cuando Mercado Pago lo confirma. Nada de comprobantes truchos.</li>
          <li>🤝 Cada trato queda por escrito, con resumen para mandar por WhatsApp.</li>
          <li>⭐ Reseñas solo de gente que te compró de verdad.</li>
          <li>🚫 Nadie puede ver tu precio mínimo.</li>
        </ul>
      </section>

      <section className="px-5 py-7">
        <h2 className="font-display text-xl font-extrabold">Preguntas frecuentes</h2>
        <div className="mt-3 divide-y divide-zinc-200 rounded-2xl bg-white ring-1 ring-zinc-200">
          {faqs.map(([q, a], i) => (
            <button key={q} onClick={() => setFaq(faq === i ? -1 : i)} className="block w-full px-4 py-3 text-left">
              <span className="flex items-center justify-between gap-2 text-[14px] font-semibold">{q}<ChevronDown size={16} className={`shrink-0 text-zinc-400 ${faq === i ? "rotate-180" : ""}`} /></span>
              {faq === i && <span className="mt-1.5 block text-[13px] text-zinc-600">{a}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 pb-10">
        <div className="rounded-3xl bg-hpred p-5 text-center text-white">
          <p className="font-display text-2xl font-extrabold">¿Vendés por internet?</p>
          <p className="mt-1 text-[14px] text-white/90">Creá tu cuenta en un minuto, sin hablar con nadie.</p>
          <button onClick={() => actions.startSignup("mensual")} className="mt-4 w-full rounded-2xl bg-white py-3.5 text-[15px] font-bold text-hpred">Empezar gratis</button>
        </div>
        <p className="mt-6 text-center text-[10px] leading-relaxed text-zinc-400">Haceme Precio es una herramienta de gestión de ofertas y condiciones comerciales entre partes. No actúa como intermediario financiero ni garantiza entregas físicas.</p>
      </section>
    </div>
  );
}

/* --- Alta de tienda en 3 pasos, sin hablar con nadie --- */
function StoreSetup({ seller, actions }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [tagline, setTagline] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("Lun a Sáb de 10 a 19 h");
  const [whatsapp, setWhatsapp] = useState("");
  const [pickup, setPickup] = useState(true);
  const [ship, setShip] = useState(false);
  const [shipNote, setShipNote] = useState("");
  const [brand, setBrand] = useState({ logo: null, banner: null, color: BRAND_COLORS[0] });
  const finalSlug = slugEdited ? slugify(slug) : slugify(name);
  const taken = finalSlug && actions.slugTaken(finalSlug, seller.id);
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-900";
  const done = () => actions.setupStore(seller.id, {
    name: name.trim(),
    store: { slug: finalSlug, tagline: tagline.trim(), ...brand, address: address.trim(), hours: hours.trim(), whatsapp: whatsapp.replace(/\D/g, ""), pickup, shipping: { enabled: ship, note: shipNote.trim() || "A coordinar" } },
  });
  return (
    <div className="h-full overflow-y-auto bg-white px-5 pb-8 pt-6 hp-scroll">
      <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-6 w-auto" />
      <div className="mt-5 flex gap-1.5">{[1, 2, 3, 4].map((n) => <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-hpred" : "bg-zinc-200"}`} />)}</div>
      {step === 1 && (
        <div className="mt-6">
          <h1 className="font-display text-2xl font-extrabold">¿Cómo se llama tu tienda?</h1>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Aura" className={input} autoFocus />
          <label className="mt-4 block text-sm font-semibold">Tu link</label>
          <div className={`mt-1 flex items-center rounded-xl border bg-zinc-50 px-3 py-3 text-sm ${taken ? "border-hpred" : "border-zinc-300"}`}>
            <span className="text-zinc-500">hacemeprecio.app/</span>
            <input value={slugEdited ? slug : finalSlug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }} className="min-w-0 flex-1 bg-transparent font-semibold outline-none" aria-label="Link de la tienda" />
          </div>
          <p className={`mt-1 text-[12px] ${taken ? "font-semibold text-hpred" : "text-zinc-500"}`}>{!finalSlug ? "Lo armamos con el nombre." : taken ? "Ese link ya está en uso. Probá con otro." : "✓ Disponible"}</p>
          <label className="mt-4 block text-sm font-semibold">Una frase corta <span className="font-normal text-zinc-500">(opcional)</span></label>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Ej: Ropa de mujer · Palermo" className={input} />
          <Btn className="mt-6 w-full py-3.5" disabled={name.trim().length < 2 || !finalSlug || taken} onClick={() => setStep(2)}>Siguiente</Btn>
        </div>
      )}
      {step === 2 && (
        <div className="mt-6">
          <h1 className="font-display text-2xl font-extrabold">Ponele tu cara a la tienda</h1>
          <p className="mt-1 text-sm text-zinc-600">Tu logo, una portada y tu color. Así tus clientes te reconocen al toque.</p>
          <div className="mt-4"><BrandEditor name={name.trim()} tagline={tagline.trim()} value={brand} onChange={setBrand} /></div>
          <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
            <Btn variant="outline" className="py-3.5" onClick={() => setStep(1)}>Atrás</Btn>
            <Btn className="py-3.5" onClick={() => setStep(3)}>{brand.logo || brand.banner ? "Siguiente" : "Lo hago después"}</Btn>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="mt-6">
          <h1 className="font-display text-2xl font-extrabold">¿Dónde te encuentran?</h1>
          <label className="mt-4 block text-sm font-semibold">Dirección del local</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: Honduras 4800, Palermo" className={input} />
          <label className="mt-4 block text-sm font-semibold">Horario</label>
          <input value={hours} onChange={(e) => setHours(e.target.value)} className={input} />
          <label className="mt-4 block text-sm font-semibold">WhatsApp para consultas</label>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="Ej: 11 5555 0000" className={input} />
          <p className="mt-1 text-[12px] text-zinc-500">Tus clientes lo usan para preguntar por talles. No se publica tu número completo en la página.</p>
          <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
            <Btn variant="outline" className="py-3.5" onClick={() => setStep(2)}>Atrás</Btn>
            <Btn className="py-3.5" disabled={address.trim().length < 4 || whatsapp.replace(/\D/g, "").length < 8} onClick={() => setStep(4)}>Siguiente</Btn>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="mt-6">
          <h1 className="font-display text-2xl font-extrabold">¿Cómo entregás?</h1>
          <div className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
            <Toggle label="Retiro en el local" checked={pickup} onChange={setPickup} />
            <Toggle label="Hago envíos" checked={ship} onChange={setShip} />
            {ship && <input value={shipNote} onChange={(e) => setShipNote(e.target.value)} placeholder="Ej: Moto en CABA o correo a todo el país" className={input} />}
          </div>
          <div className="mt-4 rounded-2xl bg-kraft-50 p-4 text-[13px] ring-1 ring-kraft-200">
            <p className="font-semibold">Tu tienda va a quedar en:</p>
            <p className="mt-1 font-mono text-[13px]">hacemeprecio.app/{finalSlug}</p>
            <p className="mt-2 text-zinc-600">Después cargás tus productos con foto, talles y stock, y compartís el link en tu Instagram o WhatsApp.</p>
          </div>
          <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
            <Btn variant="outline" className="py-3.5" onClick={() => setStep(3)}>Atrás</Btn>
            <Btn className="py-3.5" disabled={!pickup && !ship} onClick={done}><Check size={16} /> Crear mi tienda</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Cambiar o cancelar el plan solo --- */
function PlanManager({ seller, now, actions }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const current = seller.plan || "mensual";
  const options = ["mensual", "pro", "tienda"].filter((k) => k !== current && (k !== "tienda" || seller.isStore) && !(seller.isStore && k !== "tienda"));
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Settings2 size={13} /> Tu plan</p>
      {seller.cancelAt ? (
        <div className="mt-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
          Cancelaste tu plan. Lo seguís usando hasta el <b>{fmtDate(seller.cancelAt)}</b>.
          <Btn className="mt-2 w-full py-2.5 text-sm" onClick={() => actions.resumePlan(seller.id)}>Quiero seguir</Btn>
        </div>
      ) : (
        <>
          {options.length > 0 && (
            <button onClick={() => setOpen(!open)} className="mt-2 flex w-full items-center justify-between rounded-xl bg-zinc-50 px-3 py-3 text-left text-[14px] font-semibold ring-1 ring-zinc-200">
              Cambiar de plan <ChevronDown size={16} className={open ? "rotate-180" : ""} />
            </button>
          )}
          {open && (
            <div className="mt-2 space-y-2">
              {options.map((k) => (
                <button key={k} onClick={() => { actions.upgradePlan(seller.id, k); setOpen(false); }} className="flex w-full items-center justify-between rounded-xl p-3 text-left ring-1 ring-zinc-200">
                  <span><span className="block text-[14px] font-bold">{PLANS[k].name}</span><span className="block text-[12px] text-zinc-500">{PLANS[k].desc}</span></span>
                  <span className="shrink-0 pl-2 text-[13px] font-bold">{fmt(PLANS[k].price)}{PLANS[k].per}</span>
                </button>
              ))}
            </div>
          )}
          {current !== "pase" && !confirm && (
            <button onClick={() => setConfirm(true)} className="mt-3 w-full text-center text-[13px] font-medium text-zinc-500 underline">Cancelar mi plan</button>
          )}
          {confirm && (
            <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-[13px] ring-1 ring-zinc-200">
              <p>¿Seguro? Vas a poder usarlo hasta el <b>{fmtDate(seller.periodEnd)}</b>. Después tus links se pausan, pero tus productos quedan guardados.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn variant="outline" className="py-2 text-sm" onClick={() => setConfirm(false)}>No, volver</Btn>
                <Btn variant="danger" className="py-2 text-sm" onClick={() => { actions.cancelPlan(seller.id); setConfirm(false); }}>Sí, cancelar</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* --- Verificar el teléfono solo (código por SMS) --- */
function PhoneVerify({ seller, actions }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Phone size={13} /> Verificá tu teléfono</p>
      <p className="mt-1 text-[13px] text-zinc-600">Los compradores confían más en vendedores con el teléfono verificado.</p>
      {!sent ? (
        <div className="mt-2 flex gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="11 5555 0000" className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-900" />
          <Btn className="px-4 py-2.5 text-sm" disabled={phone.replace(/\D/g, "").length < 8} onClick={() => setSent(true)}>Enviar código</Btn>
        </div>
      ) : (
        <div className="mt-2">
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••" className="min-w-0 flex-1 rounded-xl border-2 border-zinc-900 px-3 py-2.5 text-center font-mono tracking-[0.4em] outline-none" aria-label="Código SMS" />
            <Btn className="px-4 py-2.5 text-sm" disabled={code.length !== 6}
              onClick={() => (code === DEMO_OTP ? actions.verifyPhone(seller.id, phone) : actions.toast("error", "Código incorrecto", "Revisalo e intentá de nuevo."))}>Verificar</Btn>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Demo: el código es <b className="font-mono">{DEMO_OTP}</b>. <button onClick={() => setSent(false)} className="underline">Cambiar número</button></p>
        </div>
      )}
    </div>
  );
}

/* --- Datos de la tienda, editables por el dueño --- */
function StoreProfileEditor({ seller, actions }) {
  const st = seller.store || {};
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ tagline: st.tagline || "", address: st.address || "", hours: st.hours || "", whatsapp: st.whatsapp || "" });
  const [brand, setBrand] = useState({ logo: st.logo || null, banner: st.banner || null, color: st.color || BRAND_COLORS[0] });
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-900";
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 text-left">
        <StoreAvatar store={seller} size={44} />
        <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Store size={13} /> Tu tienda: logo, portada y datos</span>
          <span className="mt-1 block truncate font-mono text-[12px] text-zinc-600">hacemeprecio.app/{sellerSlug(seller)}</span></span>
        <ChevronDown size={16} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <BrandEditor name={seller.name} tagline={f.tagline} value={brand} onChange={setBrand} />
          <div className="border-t border-zinc-100" />
          {[["tagline", "Frase corta"], ["address", "Dirección"], ["hours", "Horario"], ["whatsapp", "WhatsApp"]].map(([k, l]) => (
            <div key={k}><label className="text-[12px] font-semibold">{l}</label><input value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className={input} /></div>
          ))}
          <Btn className="w-full py-3" onClick={() => { actions.updateStore(seller.id, { ...f, ...brand, whatsapp: f.whatsapp.replace(/\D/g, "") }); setOpen(false); }}>Guardar</Btn>
        </div>
      )}
    </div>
  );
}


/* --- Promo con fecha + envío gratis (solo plan Tienda). El contador es real: al llegar a cero la promo termina sola. --- */
function toLocalInput(t) {
  const d = new Date(t);
  const p2 = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function nextSundayEnd(now) {
  const d = new Date(now);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}
function PromoEditor({ seller, products, now, actions }) {
  const st = seller.store || {};
  const live = promoOf(seller, now);
  const ended = st.promo?.active && st.promo.endsAt && now >= st.promo.endsAt;
  const collections = ["Todo", ...new Set(products.filter((p) => p.sellerId === seller.id && !p.liquidation).map((p) => p.collection).filter(Boolean))];
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ pct: live?.pct || 15, scope: live?.scope || "Todo", label: live?.label || "", ends: toLocalInput(live?.endsAt || nextSundayEnd(now)) });
  const [ship, setShip] = useState(st.freeShipFrom ? String(st.freeShipFrom) : "");
  const [err, setErr] = useState("");
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-900";
  const save = () => {
    const endsAt = new Date(f.ends).getTime();
    const pct = Number(f.pct);
    if (!(pct >= 5 && pct <= 70)) return setErr("El descuento tiene que ser entre 5% y 70%.");
    if (!endsAt || endsAt <= now + 30 * MIN) return setErr("Elegí una fecha de fin que sea al menos dentro de 30 minutos.");
    if (endsAt > now + 31 * DAY) return setErr("La promo puede durar hasta 31 días.");
    setErr("");
    actions.updateStore(seller.id, { promo: { active: true, pct, scope: f.scope, label: f.label.trim(), endsAt } });
    setOpen(false);
  };
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><Percent size={13} /> Promos y envío gratis</p>
      {live ? (
        <div className="mt-2 rounded-xl bg-hpred p-3 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{live.label || "Promo activa"}</p>
          <p className="font-display text-xl font-extrabold">{live.pct}% OFF {live.scope && live.scope !== "Todo" ? `en ${live.scope}` : "en toda la tienda"}</p>
          <p className="mt-1 text-[12px]">Termina en <b className="font-mono">{countdown(live.endsAt - now)}</b> · {fmtDate(live.endsAt)} {hhmm(live.endsAt)} h</p>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-zinc-600">{ended ? `Tu última promo terminó el ${fmtDate(st.promo.endsAt)}. ` : "No tenés promos activas. "}Armá una con fecha de fin: tus clientes ven un contador y el precio rebajado se aplica solo.</p>
      )}
      {!open ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn className="py-2.5 text-[13px]" onClick={() => setOpen(true)}><Pencil size={14} /> {live ? "Editar promo" : "Crear promo"}</Btn>
          {live ? <Btn variant="outline" className="py-2.5 text-[13px]" onClick={() => actions.updateStore(seller.id, { promo: { ...st.promo, active: false } })}><X size={14} /> Terminarla ya</Btn>
            : <span />}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-[12px] font-semibold">Descuento</label>
            <div className="mt-1 flex gap-1.5">
              {[10, 15, 20, 30].map((n) => (
                <button key={n} onClick={() => setF((x) => ({ ...x, pct: n }))} className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${Number(f.pct) === n ? "bg-hpred text-white" : "bg-zinc-100"}`}>{n}%</button>
              ))}
              <input type="number" min={5} max={70} value={f.pct} onChange={(e) => setF((x) => ({ ...x, pct: e.target.value }))} className="w-16 rounded-xl border border-zinc-300 px-2 text-center text-sm" aria-label="Otro porcentaje" />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold">¿En qué productos?</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {collections.map((c) => (
                <button key={c} onClick={() => setF((x) => ({ ...x, scope: c }))} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${f.scope === c ? "bg-ink text-white" : "bg-zinc-100 text-zinc-700"}`}>{c === "Todo" ? "Toda la tienda" : c}</button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Lo que está en liquidación no entra: ahí ya negocian con ofertas.</p>
          </div>
          <div><label className="text-[12px] font-semibold">Nombre de la promo (opcional)</label>
            <input value={f.label} maxLength={30} placeholder="Ej: Finde largo" onChange={(e) => setF((x) => ({ ...x, label: e.target.value }))} className={input} /></div>
          <div><label className="text-[12px] font-semibold">¿Hasta cuándo?</label>
            <input type="datetime-local" value={f.ends} onChange={(e) => setF((x) => ({ ...x, ends: e.target.value }))} className={input} /></div>
          <p className="flex gap-1.5 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-900"><Info size={13} className="mt-px shrink-0" /> El contador es real: cuando llega a cero, la promo termina sola y vuelven los precios normales. Así tus clientes confían (y cumplís la ley de publicidad).</p>
          {err && <p className="text-[12px] font-semibold text-hpred">{err}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="outline" className="py-2.5" onClick={() => { setOpen(false); setErr(""); }}>Cancelar</Btn>
            <Btn className="py-2.5" onClick={save}>Publicar promo</Btn>
          </div>
        </div>
      )}
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <label className="flex items-center gap-1.5 text-[12px] font-semibold"><Truck size={14} /> Envío gratis desde</label>
        <div className="mt-1 flex gap-2">
          <input inputMode="numeric" value={ship} placeholder="Ej: 60000 (vacío = sin envío gratis)" onChange={(e) => setShip(e.target.value.replace(/\D/g, ""))} className={input + " !mt-0"} />
          <Btn variant="dark" className="shrink-0 px-4 py-2" onClick={() => actions.updateStore(seller.id, { freeShipFrom: ship ? Number(ship) : null })}>Guardar</Btn>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">{st.freeShipFrom ? `Ahora: gratis desde ${fmt(st.freeShipFrom)}. En el carrito ven cuánto les falta.` : "En el carrito el cliente ve una barrita con cuánto le falta para el envío gratis."}</p>
      </div>
    </div>
  );
}

/* --- Preguntas frecuentes propias de la tienda (solo plan Tienda) --- */
function StoreFaqEditor({ seller, actions }) {
  const current = seller.store?.faq?.length ? seller.store.faq : defaultStoreFaq(seller);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(current);
  const input = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900";
  const set = (i, k, v) => setList((l) => l.map((x, j) => (j === i ? (k === 0 ? [v, x[1]] : [x[0], v]) : x)));
  const clean = list.map(([q, a]) => [q.trim(), a.trim()]).filter(([q, a]) => q && a);
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <button onClick={() => { setList(current); setOpen(!open); }} className="flex w-full items-center justify-between text-left">
        <span><span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><MessageSquareOff size={13} /> Preguntas de tu tienda</span>
          <span className="mt-1 block text-[13px] text-zinc-600">{current.length} preguntas · las ven al final de tu tienda</span></span>
        <ChevronDown size={16} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[12px] text-zinc-500">Respondé una vez lo que te preguntan siempre (cambios, talles, envíos). Te ahorrás mensajes.</p>
          {list.map(([q, a], i) => (
            <div key={i} className="space-y-1.5 rounded-xl bg-zinc-50 p-2.5 ring-1 ring-zinc-200">
              <div className="flex gap-2">
                <input value={q} placeholder="Pregunta" maxLength={80} onChange={(e) => set(i, 0, e.target.value)} className={input + " font-semibold"} />
                <button onClick={() => setList((l) => l.filter((_, j) => j !== i))} className="shrink-0 rounded-lg px-2 text-zinc-400 hover:text-hpred" aria-label="Borrar pregunta"><Trash2 size={16} /></button>
              </div>
              <textarea value={a} placeholder="Respuesta" rows={2} maxLength={300} onChange={(e) => set(i, 1, e.target.value)} className={input} />
            </div>
          ))}
          {list.length < 8 && <Btn variant="outline" className="w-full py-2.5" onClick={() => setList((l) => [...l, ["", ""]])}><Plus size={15} /> Agregar pregunta</Btn>}
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="outline" className="py-2.5 text-[13px]" onClick={() => setList(defaultStoreFaq(seller))}>Volver a las sugeridas</Btn>
            <Btn className="py-2.5" disabled={!clean.length} onClick={() => { actions.updateStore(seller.id, { faq: clean }); setOpen(false); }}>Guardar</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Ayuda dentro de la app (en vez de WhatsApp personal) --- */
const HELP_FAQ = [
  ["¿Cómo comparto mi producto?", "En «Mis cosas» → Gestionar → Compartir tu link. Elegí si es para WhatsApp, Instagram o Marketplace y copiá el texto."],
  ["¿Cómo cambio lo mínimo que acepto?", "En «Mis cosas» → Gestionar → Mínimo y venta automática. Los cambios aplican a las próximas ofertas."],
  ["¿Cómo cargo talles y colores?", "Solo en el plan Tienda: en «Cargar», elegí los talles, los colores y cuántas tenés de cada uno."],
  ["¿Cuándo me pagan?", "Si cobrás con Mercado Pago, se confirma cuando la pasarela verifica el pago. Si cobrás en persona, verificá el dinero antes de entregar."],
  ["¿Cómo cancelo mi plan?", "En «Mi cuenta» → Tu plan → Cancelar mi plan. Lo seguís usando hasta el fin del período pagado."],
];
function HelpCenter({ seller, tickets, actions }) {
  const [q, setQ] = useState(-1);
  const [topic, setTopic] = useState("Uso de la app");
  const [text, setText] = useState("");
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400"><LifeBuoy size={13} /> Ayuda</p>
      <div className="mt-2 divide-y divide-zinc-100">
        {HELP_FAQ.map(([qq, a], i) => (
          <button key={qq} onClick={() => setQ(q === i ? -1 : i)} className="block w-full py-2.5 text-left">
            <span className="flex items-center justify-between gap-2 text-[13px] font-semibold">{qq}<ChevronDown size={15} className={`shrink-0 text-zinc-400 ${q === i ? "rotate-180" : ""}`} /></span>
            {q === i && <span className="mt-1 block text-[12px] text-zinc-600">{a}</span>}
          </button>
        ))}
      </div>
      {tickets.length > 0 && (
        <div className="mt-3 space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl bg-zinc-50 p-3 text-[12px] ring-1 ring-zinc-100">
              <p className="flex justify-between"><b>{t.id} · {t.topic}</b><span className={t.status === "abierto" ? "text-amber-700" : "font-semibold text-ink"}>{t.status === "abierto" ? "Esperando respuesta" : "Respondido"}</span></p>
              <p className="mt-1 text-zinc-600">{t.text}</p>
              {t.answer && <p className="mt-1.5 rounded-lg bg-white p-2 ring-1 ring-zinc-200"><b>Haceme Precio:</b> {t.answer}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[13px] font-semibold">¿No encontraste lo que buscabas?</p>
      <select value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm">
        {["Uso de la app", "Pagos", "Mi plan", "Problema con un comprador", "Otro"].map((x) => <option key={x}>{x}</option>)}
      </select>
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} rows={3} placeholder="Contanos qué pasó…" className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900" />
      <Btn className="mt-2 w-full py-3" disabled={text.trim().length < 5}
        onClick={() => { const tk = actions.createTicket(seller.id, topic, text.trim()); setText(""); actions.toast("success", `Recibimos tu consulta ${tk.id}`, "Te respondemos acá y te llega un aviso."); }}>
        Enviar consulta
      </Btn>
    </div>
  );
}

function AdminTickets({ tickets, sellers, actions }) {
  const [answering, setAnswering] = useState(null);
  const [txt, setTxt] = useState("");
  const open = tickets.filter((t) => t.status === "abierto");
  return (
    <>
      <p className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        <LifeBuoy size={13} /> Pedidos de ayuda
        {open.length > 0 && <span className="ml-auto rounded-full bg-hpred px-2 py-0.5 text-[10px] font-bold text-white">{open.length} sin responder</span>}
      </p>
      {tickets.length === 0 ? <p className="px-4 py-4 text-[12px] text-zinc-400">Sin consultas.</p> : (
        <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto">
          {tickets.map((t) => (
            <li key={t.id} className="px-4 py-3 text-[12px]">
              <p className="flex justify-between gap-2"><b>{t.id} · {sellers.find((x) => x.id === t.sellerId)?.name}</b><span className="text-zinc-400">{t.topic}</span></p>
              <p className="mt-0.5 text-zinc-700">{t.text}</p>
              {t.answer && <p className="mt-1 text-zinc-500">↳ {t.answer}</p>}
              {t.status === "abierto" && answering !== t.id && <button onClick={() => { setAnswering(t.id); setTxt(""); }} className="mt-1 text-[12px] font-semibold text-hpred underline">Responder</button>}
              {answering === t.id && (
                <div className="mt-2">
                  <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={2} className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-[12px]" placeholder="Tu respuesta…" />
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => setAnswering(null)} className="text-[12px] text-zinc-500 underline">Cancelar</button>
                    <button disabled={!txt.trim()} onClick={() => { actions.answerTicket(t.id, txt.trim()); setAnswering(null); }} className="text-[12px] font-semibold text-hpred underline disabled:opacity-40">Enviar</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
