import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store, User, ShoppingBag, Handshake } from "lucide-react";
import { BrandBar, Phone } from "../components/Brand.jsx";
import { enterDemo } from "../lib/demo.js";

// Demo pública: ver como comprador y entrar al panel del vendedor sin registrarse.
export default function Demo() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const go = async (who) => {
    setBusy(who); setErr("");
    try { await enterDemo(who); nav("/panel"); }
    catch { setErr("No pudimos abrir la demo. Probá de nuevo en un momento."); setBusy(null); }
  };
  return (
    <Phone wide className="min-h-screen">
      <BrandBar />
      <main className="px-5 pb-12 pt-6 lg:mx-auto lg:max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold leading-tight">Probá Haceme Precio</h1>
        <p className="mt-1 text-[15px] text-zinc-600">Sin registrarte. Mirá cómo lo ve el que compra y cómo lo maneja el que vende.</p>

        <h2 className="mt-7 text-[13px] font-bold uppercase tracking-wide text-zinc-500">Como comprador</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Card to="/vendedor-demo" Icon={Handshake} title="Hacé una oferta" text="Un vendedor de usados: ofertá por una bici o un joystick y mirá qué pasa." />
          <Card to="/tienda-demo" Icon={ShoppingBag} title="Comprá en una tienda" text="Talles, carrito, promo 20% OFF, liquidación y una prenda usada para regatear." />
        </div>

        <h2 className="mt-7 text-[13px] font-bold uppercase tracking-wide text-zinc-500">Como vendedor</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <PanelButton Icon={User} title="Panel del vendedor" text="Respondé ofertas, contraofertá y mirá cómo se aceptan solas." busy={busy === "vendedor"} onClick={() => go("vendedor")} />
          <PanelButton Icon={Store} title="Panel de la tienda" text="Pedidos, métricas, productos con stock y tu tienda armada." busy={busy === "tienda"} onClick={() => go("tienda")} />
        </div>
        {err && <p className="mt-3 text-[13px] font-semibold text-rose-700">{err}</p>}

        <p className="mt-6 text-[12px] text-zinc-500">Es una demo compartida: lo que hagas lo pueden ver otras personas, así que no pongas datos reales. Todo vuelve a como estaba cada noche.</p>
        <Link to="/ingresar" className="mt-6 flex min-h-[52px] items-center justify-center rounded-2xl bg-hpred text-[16px] font-semibold text-white">Crear mi cuenta gratis</Link>
        <p className="mt-2 text-center text-[12px] text-zinc-500">15 días de prueba, sin tarjeta.</p>
      </main>
    </Phone>
  );
}

function Card({ to, Icon, title, text }) {
  return (
    <Link to={to} className="block rounded-2xl bg-white p-4 ring-1 ring-zinc-200 hover:ring-zinc-400">
      <Icon size={22} className="text-hpred" />
      <p className="mt-2 font-display text-lg font-extrabold">{title}</p>
      <p className="text-[13px] text-zinc-600">{text}</p>
    </Link>
  );
}

function PanelButton({ Icon, title, text, busy, onClick }) {
  return (
    <button onClick={onClick} disabled={busy} className="block rounded-2xl bg-ink p-4 text-left text-white disabled:opacity-60">
      <Icon size={22} />
      <p className="mt-2 font-display text-lg font-extrabold">{busy ? "Entrando…" : title}</p>
      <p className="text-[13px] text-zinc-300">{text}</p>
    </button>
  );
}
