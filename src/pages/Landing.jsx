import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Link2, BellRing, Lock, Zap, Repeat2, Share2, Store, ShieldCheck, Check, ChevronDown, MessageCircle, ShoppingBag, Clock3, X } from "lucide-react";
import { LOGO_HORIZ } from "../prototype/brand.js";

// Landing pública (responsive). No depende del prototipo: carga liviana.
const PLANS = [
  { k: "gratis", e: "🏷️", t: "Gratis", p: "$0", per: "/mes", d: "Publicás sin límite y pagás solo cuando vendés: 3% de las ventas que cobrás con Mercado Pago en la app. 0% de comisión hasta fin de año.", f: ["Publicaciones sin límite", "Ofertas con mínimo oculto", "Tu vidriera con un link"], cta: "Empezar gratis", star: true },
  { k: "mensual", e: "🛍️", t: "Básico", p: "$10.000", per: "/mes", d: "Para el que vende seguido: sin comisión, todo lo que vendés es tuyo.", f: ["Todo lo del Gratis", "0% de comisión", "Conviene si vendés más de $330.000 por mes con Mercado Pago"], cta: "Probar 15 días gratis" },
  { k: "tienda", e: "🏬", t: "Tienda", p: "$40.000", per: "/mes", d: "Para locales: tu ventana de venta sin armar un e-commerce.", f: ["Talles, colores y stock", "Carrito y pedidos", "Promos, logo y portada · 0% de comisión"], cta: "Probar 15 días gratis" },
  { k: "pro", e: "✨", t: "Pro con IA", p: "$30.000", per: "/mes", d: "Todo lo del Básico, y la IA arma tus publicaciones desde las fotos.", f: ["Todo lo del Básico", "Título y descripción con IA", "Próximamente"], cta: "Anotarme", soon: true },
];
const FAQS = [
  ["¿Tengo que dejar Marketplace, Instagram o WhatsApp?", "No. Seguís publicando donde siempre y compartís tu link. Haceme Precio se encarga de las ofertas y de las preguntas repetidas."],
  ["¿El comprador tiene que descargar algo o crear una cuenta?", "No. Toca el link, ve fotos y precio, y oferta desde el navegador. Sin cuenta ni contraseña."],
  ["¿Alguien puede ver mi precio mínimo?", "No. Lo mínimo que aceptás queda guardado en el servidor y nunca le llega al comprador. Las ofertas más bajas se frenan solas."],
  ["¿Cómo cobro?", "Conectás tu Mercado Pago y el comprador paga con un botón: la plata va directo a tu cuenta y se confirma sola. También podés coordinar por WhatsApp como siempre. Nunca aceptes capturas como comprobante."],
  ["¿Cobran comisión por venta?", "Solo en el plan Gratis: 3% de las ventas que cobrás con Mercado Pago dentro de la app (y recién desde el 1 de enero de 2027). Lo que cobrás en efectivo no paga nada. Con el Básico o la Tienda no pagás comisión."],
  ["¿Puedo cancelar cuando quiera?", "Sí, con un botón desde «Mi cuenta». Seguís usando lo que pagaste hasta el final del período."],
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white font-sans text-ink">
      <Nav />
      <Hero />
      <Problem />
      <How />
      <Features />
      <ForWho />
      <Plans />
      <Safety />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

const wrap = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const btnRed = "inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-hpred px-7 text-[16px] font-semibold text-white shadow-sm transition hover:bg-hpred-dark";
const btnGhost = "inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-white px-6 text-[15px] font-semibold text-ink ring-1 ring-zinc-300 transition hover:bg-zinc-50";

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-kraft-200/60 bg-kraft-50/90 backdrop-blur">
      <div className={`${wrap} flex h-16 items-center justify-between`}>
        <Link to="/" aria-label="Haceme Precio"><img src={LOGO_HORIZ} alt="Haceme Precio" className="h-8 w-auto" /></Link>
        <nav className="hidden items-center gap-7 text-[14px] font-medium text-zinc-700 md:flex">
          <a href="#como-funciona" className="hover:text-ink">Cómo funciona</a>
          <a href="#planes" className="hover:text-ink">Planes</a>
          <a href="#preguntas" className="hover:text-ink">Preguntas</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/ingresar" className="rounded-xl px-3 py-2 text-[14px] font-semibold text-zinc-700 hover:bg-white">Ingresar</Link>
          <Link to="/ingresar?plan=gratis" className="hidden rounded-xl bg-hpred px-4 py-2 text-[14px] font-semibold text-white sm:inline-flex">Empezar gratis</Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="overflow-hidden bg-kraft-50">
      <div className={`${wrap} grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-16`}>
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-zinc-700 ring-1 ring-kraft-200">🇦🇷 Para los que venden por WhatsApp, Instagram, Marketplace o en su local</p>
          <h1 className="mt-5 font-display text-[34px] font-black leading-[1.05] tracking-tight sm:text-[52px] lg:text-[62px]">
            Vendé sin contestar 40 veces{" "}
            <span className="relative inline-block sm:whitespace-nowrap">
              “¿sigue disponible?”
              <span aria-hidden className="absolute left-0 right-0 top-[55%] h-[6px] -rotate-2 rounded-full bg-hpred" />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-zinc-700 sm:text-[19px]">
            Compartís un link y te llegan <b>ofertas en serio</b>, no charlas eternas. Las ofertas bajas se frenan solas, las buenas se aceptan con un botón y tu precio mínimo no lo ve nadie.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/ingresar?plan=gratis" className={btnRed}>Empezar gratis</Link>
            <Link to="/demo" className={btnGhost}>Ver cómo funciona</Link>
          </div>
          <p className="mt-3 text-[13px] text-zinc-500">Gratis para empezar · sin tarjeta · pagás solo cuando vendés</p>
        </div>
        <HeroPhone />
      </div>
    </section>
  );
}

// Celular dibujado con HTML: muestra cómo llegan las ofertas.
function HeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="absolute -inset-6 -z-0 rounded-[48px] bg-hpred/10 blur-2xl" aria-hidden />
      <div className="relative rounded-[42px] bg-ink p-3 shadow-2xl">
        <div className="overflow-hidden rounded-[32px] bg-white">
          <div className="flex items-center justify-between bg-white px-5 pb-2 pt-3 text-[11px] font-semibold text-zinc-500"><span>09:41</span><span className="h-5 w-20 rounded-full bg-ink" /><span>5G</span></div>
          <div className="px-4 pb-5">
            <p className="text-[12px] text-zinc-500">Tus ofertas de hoy</p>
            <p className="font-display text-xl font-extrabold">Bici rodado 26</p>
            <p className="text-[12px] text-zinc-500">Publicada a $150.000 · <Lock size={10} className="inline" /> mínimo $125.000</p>
            <div className="mt-3 space-y-2">
              <Bubble tone="zinc" icon={<ShieldCheck size={15} />} title="Oferta de $60.000" sub="Frenada sola: muy baja" />
              <Bubble tone="amber" icon={<Clock3 size={15} />} title="Lucía ofrece $135.000" sub="Te quedan 12:40 para responder" actions />
              <Bubble tone="emerald" icon={<Check size={15} />} title="¡Trato hecho con Ana!" sub="$145.000 · aceptada sola" />
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-[13px] font-semibold text-white"><MessageCircle size={14} /> Escribirle por WhatsApp</div>
          </div>
        </div>
      </div>
      <div className="absolute -left-40 top-[30%] hidden rotate-[-6deg] lg:block rounded-2xl bg-white px-3 py-2 text-[12px] font-semibold shadow-lg ring-1 ring-zinc-200">🛡️ 9 ofertas bajas frenadas</div>
      <div className="absolute -right-28 bottom-[18%] hidden rotate-[5deg] lg:block rounded-2xl bg-white px-3 py-2 text-[12px] font-semibold shadow-lg ring-1 ring-zinc-200">⚡ Aceptada sola</div>
    </div>
  );
}
function Bubble({ tone, icon, title, sub, actions }) {
  const c = { zinc: "bg-zinc-50 ring-zinc-200 text-zinc-700", amber: "bg-amber-50 ring-amber-300 text-amber-900", emerald: "bg-emerald-50 ring-emerald-300 text-emerald-900" }[tone];
  return (
    <div className={`rounded-2xl p-3 ring-1 ${c}`}>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">{icon} {title}</p>
      <p className="mt-0.5 text-[11px] opacity-80">{sub}</p>
      {actions && (
        <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] font-semibold text-ink">
          <span className="rounded-lg bg-white py-1.5 text-center ring-1 ring-zinc-200">Rechazar</span>
          <span className="rounded-lg bg-white py-1.5 text-center ring-1 ring-zinc-200">Contraofertar</span>
          <span className="rounded-lg bg-hpred py-1.5 text-center text-white">Aceptar</span>
        </div>
      )}
    </div>
  );
}

function Problem() {
  const before = ["«¿Sigue disponible?» 40 veces por día", "Te ofrecen la mitad y discuten", "Te clavan el visto después de reservar", "Tu mejor precio queda expuesto"];
  const after = ["Un link con fotos, precio y estado", "Lo bajo se frena solo, sin que contestes", "Cada oferta tiene tiempo para responder", "Tu mínimo no lo ve nadie"];
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className={wrap}>
        <h2 className="max-w-2xl font-display text-3xl font-black leading-tight sm:text-4xl">Vender por chat te come el día. Con un link, lo resolvés en minutos.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl bg-zinc-50 p-6 ring-1 ring-zinc-200 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Antes</p>
            <ul className="mt-4 space-y-3">{before.map((t) => <li key={t} className="flex gap-2.5 text-[16px] text-zinc-600"><X size={20} className="mt-0.5 shrink-0 text-zinc-400" /> {t}</li>)}</ul>
          </div>
          <div className="rounded-3xl bg-ink p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-kraft">Con Haceme Precio</p>
            <ul className="mt-4 space-y-3">{after.map((t) => <li key={t} className="flex gap-2.5 text-[16px]"><Check size={20} className="mt-0.5 shrink-0 text-kraft" /> {t}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    [Camera, "Sacás una foto", "Le ponés precio y lo mínimo que aceptás. Listo en menos de un minuto."],
    [Link2, "Compartís tu link", "En tu estado de WhatsApp, en Instagram, en Marketplace o en un grupo. Se ve con foto y precio."],
    [BellRing, "Te llega lo que vale la pena", "Las ofertas bajas se frenan solas. Las buenas las aceptás con un botón y coordinás por WhatsApp."],
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-kraft-50 py-16 lg:py-24">
      <div className={wrap}>
        <p className="text-sm font-semibold uppercase tracking-wider text-hpred">Cómo funciona</p>
        <h2 className="mt-2 font-display text-3xl font-black sm:text-4xl">Así de simple</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map(([Icon, t, d], i) => (
            <li key={t} className="rounded-3xl bg-white p-6 ring-1 ring-kraft-200">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-hpred text-white"><Icon size={20} /></span>
                <span className="font-display text-4xl font-black text-kraft-200">{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-extrabold">{t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-600">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    [Lock, "Mínimo oculto", "Ponés lo mínimo que aceptás. Nadie lo ve, y las ofertas más bajas se frenan solas."],
    [Zap, "Venta automática", "Si ofrecen cerca de tu precio, se acepta sola y te avisamos. Vendés mientras dormís."],
    [Repeat2, "Sin regateo eterno", "Cada comprador tiene 2 intentos. Podés contraofertar una vez y listo."],
    [Clock3, "Todo con tiempo", "12 horas para responder y 12 para cerrar. Si la oferta te sirve, se acepta sola aunque estés durmiendo."],
    [Share2, "Link que se ve bien", "Al pegarlo en WhatsApp o Instagram aparece la foto, el título y el precio."],
    [Store, "Tu vidriera o tu tienda", "Todo lo que vendés en un link. Si tenés local: talles, colores, carrito y pedidos."],
  ];
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className={wrap}>
        <h2 className="max-w-2xl font-display text-3xl font-black sm:text-4xl">Lo que hace por vos</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(([Icon, t, d]) => (
            <div key={t} className="rounded-3xl p-6 ring-1 ring-zinc-200 transition hover:ring-zinc-300">
              <Icon size={24} className="text-hpred" />
              <h3 className="mt-3 font-display text-lg font-extrabold">{t}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForWho() {
  const who = [
    ["📱", "Vendés en Marketplace", "Muebles, tecnología, lo que sea. Dejás de contestar lo mismo y filtrás a los que regatean de más."],
    ["💬", "Vendés por WhatsApp o Instagram", "Ropa, emprendimientos, reventa. Un link para tu estado o tu bio con todo lo que tenés."],
    ["🏬", "Tenés un local", "Tu ventana de venta online sin armar un e-commerce: precio fijo, talles, colores, carrito y retiro."],
  ];
  return (
    <section className="bg-ink py-16 text-white lg:py-24">
      <div className={wrap}>
        <h2 className="max-w-2xl font-display text-3xl font-black sm:text-4xl">Para cualquiera que venda productos</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {who.map(([e, t, d]) => (
            <div key={t} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <p className="text-4xl">{e}</p>
              <h3 className="mt-3 font-display text-xl font-extrabold">{t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-300">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Plans() {
  return (
    <section id="planes" className="scroll-mt-20 bg-kraft-50 py-16 lg:py-24">
      <div className={wrap}>
        <p className="text-sm font-semibold uppercase tracking-wider text-hpred">Planes</p>
        <h2 className="mt-2 font-display text-3xl font-black sm:text-4xl">¿Qué vendés?</h2>
        <p className="mt-2 text-[16px] text-zinc-600">Empezá gratis y pagá solo cuando vendés. Si vendés seguido, un plan te saca la comisión.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.k} className={`relative flex flex-col rounded-3xl bg-white p-6 ${p.star ? "ring-2 ring-hpred" : "ring-1 ring-kraft-200"}`}>
              {p.star && <span className="absolute -top-3 left-6 rounded-full bg-hpred px-3 py-0.5 text-[11px] font-bold text-white">El más elegido</span>}
              {p.soon && <span className="absolute -top-3 left-6 rounded-full bg-ink px-3 py-0.5 text-[11px] font-bold text-white">Muy pronto</span>}
              <p className="text-3xl">{p.e}</p>
              <h3 className="mt-2 font-display text-lg font-extrabold">{p.t}</h3>
              <p className="mt-1"><span className="font-display text-3xl font-black">{p.p}</span> <span className="text-[13px] text-zinc-500">{p.per}</span></p>
              <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{p.d}</p>
              <ul className="mt-4 flex-1 space-y-1.5">{p.f.map((f) => <li key={f} className="flex gap-2 text-[14px]"><Check size={16} className="mt-0.5 shrink-0 text-hpred" /> {f}</li>)}</ul>
              <Link to={`/ingresar?plan=${p.k}`} className={`mt-6 flex min-h-[48px] items-center justify-center rounded-2xl text-[15px] font-semibold ${p.star ? "bg-hpred text-white" : "bg-ink text-white"}`}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Safety() {
  const items = ["Tu mínimo y tus reglas se guardan en el servidor: el comprador nunca los ve.", "Un producto no se puede vender dos veces: un solo trato a la vez.", "El WhatsApp del comprador lo ves recién cuando hay trato.", "Nunca te pedimos capturas como comprobante de pago."];
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className={`${wrap} grid items-center gap-10 lg:grid-cols-2`}>
        <div>
          <ShieldCheck size={36} className="text-hpred" />
          <h2 className="mt-3 font-display text-3xl font-black sm:text-4xl">Vendé tranquilo</h2>
          <p className="mt-3 text-[16px] text-zinc-600">Pensado para que no te quieran correr con el precio ni con el pago.</p>
        </div>
        <ul className="space-y-3">{items.map((t) => <li key={t} className="flex gap-3 rounded-2xl bg-zinc-50 p-4 text-[15px] ring-1 ring-zinc-200"><Check size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {t}</li>)}</ul>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="preguntas" className="scroll-mt-20 bg-kraft-50 py-16 lg:py-24">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <h2 className="font-display text-3xl font-black sm:text-4xl">Preguntas frecuentes</h2>
        <div className="mt-8 divide-y divide-kraft-200 rounded-3xl bg-white ring-1 ring-kraft-200">
          {FAQS.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-[16px] font-semibold">
                {q}<ChevronDown size={18} className={`shrink-0 text-zinc-400 transition ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && <p className="-mt-2 px-6 pb-5 text-[15px] leading-relaxed text-zinc-600">{a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-hpred py-16 text-white lg:py-20">
      <div className={`${wrap} flex flex-col items-start justify-between gap-6 md:flex-row md:items-center`}>
        <div>
          <h2 className="font-display text-3xl font-black sm:text-4xl">Empezá gratis hoy</h2>
          <p className="mt-2 text-[16px] text-white/85">Cargás tu primer producto en un minuto. Sin tarjeta y sin costo fijo.</p>
        </div>
        <Link to="/ingresar?plan=gratis" className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-white px-8 text-[17px] font-semibold text-hpred"><ShoppingBag size={18} /> Empezar ahora</Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink py-10 text-zinc-400">
      <div className={`${wrap} flex flex-col gap-4 text-[13px] md:flex-row md:items-center md:justify-between`}>
        <img src={LOGO_HORIZ} alt="Haceme Precio" className="h-7 w-auto rounded bg-white p-1" />
        <p className="max-w-xl leading-relaxed">Haceme Precio es una herramienta para gestionar ofertas y condiciones comerciales entre partes. No actúa como intermediario financiero ni garantiza entregas.</p>
        <div className="flex flex-col gap-2">
          <Link to="/arrepentimiento" className="inline-flex w-fit items-center rounded-lg bg-white px-3 py-1.5 font-semibold text-ink">Botón de arrepentimiento</Link>
          <p className="flex flex-wrap gap-x-4 gap-y-1"><Link to="/baja" className="underline">Botón de baja</Link><Link to="/terminos" className="underline">Términos</Link><Link to="/privacidad" className="underline">Privacidad</Link><Link to="/ayuda" className="underline">Ayuda</Link><Link to="/demo" className="underline">Demo</Link><span>© {new Date().getFullYear()} Haceme Precio</span></p>
        </div>
      </div>
    </footer>
  );
}
