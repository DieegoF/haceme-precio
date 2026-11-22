import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, MessageCircle, Search } from "lucide-react";
import { BrandBar, Phone } from "../components/Brand.jsx";
import { waLink } from "../lib/offers.js";

export const SUPPORT_WHATSAPP = "1124555499";
export const supportLink = (text = "¡Hola! Necesito ayuda con Haceme Precio.") => waLink(SUPPORT_WHATSAPP, text);

// Preguntas frecuentes. Respuestas cortas, como se las contarías a alguien que no sabe de tecnología.
const VENDO = [
  ["¿Qué es Haceme Precio?", "Una página para tus cosas en venta, con un solo link. El que entra ve tus productos y te hace una oferta. Vos ponés lo mínimo que aceptás y la app se encarga: rechaza sola lo que está por debajo y, si querés, acepta sola lo que te sirve."],
  ["¿Cómo empiezo?", "Tocá «Crear mi cuenta» y entrá con tu cuenta de Google. Ponés tu nombre, elegís tu link y listo. Para publicar: sacás una foto, ponés el precio y lo mínimo que aceptás."],
  ["¿Cuánto sale?", "Empezar es gratis: publicás sin límite y solo pagás el 3% de las ventas que cobrás con Mercado Pago dentro de la app (sin comisión hasta el 31 de diciembre de 2026). Lo que cobrás en efectivo o por transferencia no paga nada. Si vendés seguido, el plan Básico ($10.000 por mes) y el plan Tienda para locales ($40.000 por mes) no tienen comisión; los dos tienen 15 días de prueba."],
  ["¿El comprador ve mi precio mínimo?", "No. Lo mínimo que aceptás queda guardado en privado y solo lo usa la app para responder. El comprador nunca lo ve."],
  ["¿Qué pasa si me ofertan de madrugada?", "Si la oferta es más baja que tu mínimo, se rechaza sola con un mensaje amable. Si es buena y activaste «aceptar sola», queda el trato hecho. Si no, tenés 12 horas para responder."],
  ["¿Cómo contraoferto?", "En «Ofertas» tocás la oferta y «Contraofertar», ponés tu precio y listo. El comprador tiene 12 horas para aceptarlo."],
  ["¿Cómo cobro?", "Si conectás tu Mercado Pago (en «Mi cuenta»), el comprador paga con un botón y la plata va directo a tu cuenta. Si no, coordinan por WhatsApp como siempre. Nunca entregues sin ver la plata acreditada: no te guíes por capturas."],
  ["¿Cómo pago mi plan?", "En «Mi cuenta» tocás «Pagar 1 mes» y pagás con Mercado Pago. Si el Básico se vence y no pagás, pasás solo al plan Gratis: no se pausa nada. En la Tienda tenés 3 días para pagar; después tus publicaciones se pausan, pero no se borran y vuelven solas apenas pagás."],
  ["¿Puedo usarlo en la compu?", "Sí. Funciona en el celular y en la compu, entrando a la misma página con tu cuenta de Google."],
  ["Me olvidé cómo entré", "Entrás siempre con «Continuar con Google», con el mismo mail. No necesitás contraseña nueva. Si no te acordás qué mail usaste, escribinos por WhatsApp."],
];
const COMPRO = [
  ["¿Cómo hago una oferta?", "Entrás al producto, tocás «Hacer mi oferta», ponés cuánto ofrecés, tu nombre y tu WhatsApp. Tenés 3 intentos por producto."],
  ["¿Necesito crear una cuenta?", "No. Para comprar no hace falta cuenta. Te recomendamos tocar «Guardar mi oferta en WhatsApp»: así podés volver a verla desde cualquier celular."],
  ["Cerré la página, ¿perdí mi oferta?", "No. Si guardaste el link en WhatsApp, abrilo y la ves de nuevo. Si entrás desde el mismo celular y navegador, también aparece sola."],
  ["¿Cuánto tarda la respuesta?", "Si tu oferta llega al mínimo del vendedor, puede aceptarse al instante. Si no, el vendedor tiene 12 horas para responder."],
  ["¿Cómo pago?", "Si el vendedor tiene Mercado Pago conectado, te aparece el botón «Pagar con Mercado Pago». Si no, te escribe por WhatsApp para coordinar."],
  ["¿Es seguro?", "Pagá dentro de la app con Mercado Pago o en persona, en un lugar público y revisando el producto antes. Nunca pagues por adelantado a alguien que te escribe por fuera. Si algo te parece raro, tocá «Denunciar»."],
  ["¿Cómo dejo una opinión?", "Cuando el vendedor marca la venta como hecha (o tu pedido como entregado), en la misma página te aparece «¿Cómo te fue?» para calificar con estrellas."],
];

export default function Ayuda() {
  const [tab, setTab] = useState("vendo");
  const [q, setQ] = useState("");
  const list = tab === "vendo" ? VENDO : COMPRO;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const shown = useMemo(() => (q.trim() ? [...VENDO, ...COMPRO].filter(([a, b]) => norm(a + " " + b).includes(norm(q.trim()))) : list), [q, list]);
  return (
    <Phone wide className="min-h-screen">
      <BrandBar />
      <main className="px-5 pb-14 pt-6 lg:mx-auto lg:max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold">¿En qué te ayudamos?</h1>
        <label className="mt-4 flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3">
          <Search size={18} className="text-zinc-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá: cobrar, oferta, plan…" className="min-h-[50px] w-full bg-transparent text-base outline-none" />
        </label>
        {!q.trim() && (
          <div className="mt-4 flex gap-1 rounded-xl bg-zinc-100 p-1">
            {[["vendo", "Vendo"], ["compro", "Compro"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2.5 text-[15px] font-semibold ${tab === k ? "bg-white shadow-sm" : "text-zinc-500"}`}>{l}</button>
            ))}
          </div>
        )}
        <ul className="mt-4 space-y-2">
          {shown.map(([qq, a]) => <Item key={qq} q={qq} a={a} />)}
          {!shown.length && <li className="rounded-2xl bg-white p-4 text-[15px] text-zinc-600 ring-1 ring-zinc-200">No encontramos eso. Escribinos y te ayudamos.</li>}
        </ul>

        <section className="mt-8 rounded-3xl bg-ink p-5 text-white">
          <p className="font-display text-xl font-extrabold">¿No encontraste lo que buscabas?</p>
          <p className="mt-1 text-[14px] text-zinc-300">Escribinos por WhatsApp. Te responde una persona, no un robot.</p>
          <a href={supportLink()} target="_blank" rel="noreferrer" className="mt-4 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-[16px] font-semibold text-white">
            <MessageCircle size={19} /> Escribir por WhatsApp
          </a>
        </section>
        <p className="mt-6 text-center text-[13px]"><Link to="/demo" className="font-semibold text-hpred underline">Probar la demo</Link> · <Link to="/" className="text-zinc-500 underline">Inicio</Link></p>
      </main>
    </Phone>
  );
}

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-2xl bg-white ring-1 ring-zinc-200">
      <button onClick={() => setOpen(!open)} className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 text-left text-[15px] font-semibold">
        {q} <ChevronDown size={18} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="px-4 pb-4 text-[15px] leading-relaxed text-zinc-700">{a}</p>}
    </li>
  );
}
