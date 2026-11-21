import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BrandBar, Phone } from "../components/Brand.jsx";
import { supabase } from "../lib/supabase.js";
import { supportLink } from "./Ayuda.jsx";

// Datos del responsable (los muestra la política de privacidad y los términos).
export const OWNER = {
  name: "Diego Fernandez",
  cuit: "20-37280762-9",
  email: "diegofernandez@gmail.com",
  place: "Berazategui, Provincia de Buenos Aires",
};
const UPDATED = "21 de noviembre de 2026";

function Page({ title, children }) {
  return (
    <Phone wide className="min-h-screen">
      <BrandBar />
      <main className="px-5 pb-14 pt-6 text-[15px] leading-relaxed text-zinc-800 lg:mx-auto lg:max-w-3xl">
        <h1 className="font-display text-3xl font-extrabold text-zinc-900">{title}</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Última actualización: {UPDATED}</p>
        {children}
        <p className="mt-10 text-center text-[13px]">
          <Link to="/terminos" className="underline">Términos</Link> · <Link to="/privacidad" className="underline">Privacidad</Link> · <Link to="/arrepentimiento" className="underline">Botón de arrepentimiento</Link> · <Link to="/baja" className="underline">Botón de baja</Link> · <Link to="/" className="underline">Inicio</Link>
        </p>
      </main>
    </Phone>
  );
}
const H = ({ children }) => <h2 className="mt-7 font-display text-xl font-extrabold text-zinc-900">{children}</h2>;
const P = ({ children, className = "" }) => <p className={`mt-2 ${className}`}>{children}</p>;
const L = ({ items }) => <ul className="mt-2 list-disc space-y-1 pl-5">{items.map((t) => <li key={t}>{t}</li>)}</ul>;

export function Terminos() {
  return (
    <Page title="Términos y condiciones">
      <P>Estos términos regulan el uso de Haceme Precio. Al crear una cuenta o usar la página aceptás estas condiciones. Si no estás de acuerdo, no la uses.</P>

      <H>1. Qué es Haceme Precio</H>
      <P>Haceme Precio es una herramienta web para que personas y comercios publiquen productos, reciban ofertas, contraofertas y pedidos, y los gestionen desde un panel. El servicio lo presta {OWNER.name} (CUIT {OWNER.cuit}), con domicilio en {OWNER.place}.</P>
      <P><b>Haceme Precio no es parte de las compraventas.</b> El contrato de compraventa es entre el vendedor y el comprador. Haceme Precio no vende los productos publicados, no es intermediario financiero, no recibe el dinero de las ventas y no garantiza la existencia, calidad o entrega de los productos ni el pago de los compradores.</P>

      <H>2. Cuentas</H>
      <L items={[
        "Para vender tenés que ser mayor de 18 años y entrar con tu cuenta de Google o con un código que te mandamos por mail.",
        "Sos responsable de lo que publiques y de que tus datos sean reales.",
        "Para comprar u ofertar no hace falta cuenta: dejás tu nombre y tu WhatsApp para que el vendedor te contacte.",
      ]} />

      <H>3. Planes y precios</H>
      <L items={[
        "«Una sola cosa»: las 2 primeras publicaciones son gratis. Desde la tercera, cada publicación cuesta $5.000 (pase).",
        "Básico: $10.000 por mes, con 15 días de prueba gratis. Si ya usaste tus 2 publicaciones gratis, el Básico se paga desde el primer día.",
        "Tienda: $40.000 por mes, con 15 días de prueba gratis.",
        "Los precios incluyen impuestos, si correspondieran. Si cambian, te avisamos con al menos 30 días de anticipación.",
        "Haceme Precio no cobra comisión por las ventas.",
      ]} />

      <H>4. Pagos del plan</H>
      <P>Los planes se pagan mes a mes con Mercado Pago, desde «Mi cuenta». <b>No hay débito automático ni renovación automática:</b> si no pagás, no se te cobra nada. Cuando vence la prueba o el mes pagado tenés 3 días para pagar sin cortes. Después, tus publicaciones se pausan (no se borran) y vuelven a estar activas apenas pagás.</P>

      <H>5. Cobros de las ventas</H>
      <P>Si el vendedor conecta su cuenta de Mercado Pago, el comprador paga directamente a esa cuenta. Mercado Pago procesa el pago según sus propios términos. Haceme Precio solo muestra como «pagado» lo que Mercado Pago confirma como acreditado.</P>

      <H>6. Arrepentimiento y baja</H>
      <P>Si contrataste un plan o un pase, podés arrepentirte dentro de los 10 días corridos desde la contratación, usando el <Link to="/arrepentimiento" className="underline">botón de arrepentimiento</Link>, sin registrarte ni hacer otro trámite. Te devolvemos lo pagado por el mismo medio. También podés pedir la baja del servicio cuando quieras desde el <Link to="/baja" className="underline">botón de baja</Link>. En ambos casos te damos un código de trámite en el momento.</P>
      <P>Si compraste un producto a un vendedor, el arrepentimiento de esa compra se gestiona con el vendedor, que es quien te lo vendió.</P>

      <H>7. Qué no se puede publicar</H>
      <L items={[
        "Productos ilegales, robados, falsificados o que infrinjan marcas o derechos de otros.",
        "Armas, municiones, drogas, medicamentos, alcohol o tabaco para menores, animales vivos y cualquier cosa cuya venta esté prohibida o requiera autorización.",
        "Contenido ofensivo, discriminatorio, sexual o engañoso, o fotos que no correspondan al producto.",
        "Publicaciones hechas para estafar o para sacar datos o pagos por fuera.",
      ]} />
      <P>Podemos pausar publicaciones, ocultar reseñas o suspender cuentas que no cumplan estas reglas, sobre todo si hay denuncias. Si creés que nos equivocamos, escribinos.</P>

      <H>8. Reseñas y denuncias</H>
      <P>Solo quien compró puede dejar una opinión, una por compra. Cualquiera puede denunciar una publicación, un vendedor o una reseña. Con varias denuncias, el contenido puede quedar pausado u oculto hasta que lo revisemos.</P>

      <H>9. Responsabilidad</H>
      <P>Hacemos lo posible para que el servicio funcione siempre y de forma segura, pero puede haber cortes o errores. Haceme Precio no responde por las operaciones entre vendedores y compradores, ni por el contenido que publican. Esto no limita los derechos que te da la Ley 24.240 de Defensa del Consumidor.</P>

      <H>10. Cambios y contacto</H>
      <P>Si cambiamos estos términos, publicamos la nueva versión acá con su fecha y, si es un cambio importante, te avisamos. Se aplican las leyes de la República Argentina. Para cualquier consulta: {OWNER.email} o por <a href={supportLink()} target="_blank" rel="noreferrer" className="underline">WhatsApp</a>.</P>
    </Page>
  );
}

export function Privacidad() {
  return (
    <Page title="Política de privacidad">
      <P>Acá te contamos qué datos guardamos, para qué y qué derechos tenés, según la Ley 25.326 de Protección de Datos Personales.</P>

      <H>Responsable</H>
      <P>{OWNER.name}, CUIT {OWNER.cuit}, {OWNER.place}. Contacto: {OWNER.email}.</P>

      <H>Qué datos guardamos</H>
      <L items={[
        "Si vendés: tu nombre y tu mail (el de Google o el que usás para entrar), el nombre y el link de tu vidriera o tienda, tu WhatsApp si lo cargás, tus productos y fotos, tus ventas y los pagos de tu plan.",
        "Si conectás Mercado Pago: un permiso (token) para crear cobros a tu nombre. Nunca vemos ni guardamos tus claves ni datos de tarjetas.",
        "Si comprás u ofertás: el nombre y el WhatsApp que dejás, tus ofertas, pedidos y opiniones, y un identificador al azar guardado en tu navegador para que puedas volver a ver tus ofertas.",
        "Datos de uso: cantidad de visitas a cada tienda, sin identificarte.",
      ]} />

      <H>Para qué los usamos</H>
      <L items={[
        "Para que la página funcione: mostrar productos, mandar las ofertas al vendedor y avisarte de las respuestas.",
        "Para cobrar los planes y confirmar pagos con Mercado Pago.",
        "Para seguridad y moderación: evitar estafas, spam y abusos.",
      ]} />
      <P><b>No vendemos tus datos ni los usamos para publicidad de terceros.</b></P>

      <H>Con quién se comparten</H>
      <L items={[
        "Con el vendedor: tu nombre y tu WhatsApp cuando le hacés una oferta o un pedido, para que puedan coordinar.",
        "Con los servicios que usamos para funcionar: Google (ingreso), Supabase (base de datos y archivos), Railway (servidor de la página), Mercado Pago (pagos) y Resend (mails de aviso). Algunos pueden guardar datos fuera de Argentina, con medidas de seguridad adecuadas.",
        "Con autoridades, solo si una ley u orden judicial lo exige.",
      ]} />

      <H>Cuánto tiempo los guardamos</H>
      <P>Mientras tengas tu cuenta o mientras sean necesarios para las operaciones y obligaciones legales (por ejemplo, registros de pagos). Si pedís la baja, borramos o anonimizamos lo que no estemos obligados a conservar.</P>

      <H>Tus derechos</H>
      <P>Podés pedir ver, corregir, actualizar o borrar tus datos escribiendo a {OWNER.email}. El acceso es gratuito a intervalos no menores a seis meses, salvo que acredites un interés legítimo. Te respondemos dentro de los plazos de la ley.</P>
      <P className="text-[13px] text-zinc-600">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</P>

      <H>Datos guardados en tu navegador</H>
      <P>Usamos el almacenamiento del navegador para mantener tu sesión, tu carrito y tu identificador de comprador. No usamos cookies de publicidad.</P>

      <H>Menores</H>
      <P>Haceme Precio no está pensado para menores de 18 años. No pedimos ni guardamos a sabiendas datos de menores.</P>
    </Page>
  );
}

// Botón de arrepentimiento y botón de baja: sin registrarse, con código de trámite al instante.
export function Tramite({ kind }) {
  const [form, setForm] = useState({ name: "", email: "", detail: "" });
  const [state, setState] = useState(null); // null | "enviando" | { code } | "error" | "muchas"
  const baja = kind === "baja";
  const send = async (e) => {
    e.preventDefault();
    setState("enviando");
    const { data, error } = await supabase.rpc("submit_consumer_request", { p_kind: kind, p_name: form.name, p_email: form.email, p_detail: form.detail });
    if (error) setState(error.message?.includes("DEMASIADAS") ? "muchas" : "error");
    else setState({ code: data });
  };
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";
  return (
    <Page title={baja ? "Botón de baja" : "Botón de arrepentimiento"}>
      {baja
        ? <P>Pedí la baja de tu plan o de tu cuenta de Haceme Precio. No hace falta que entres a tu cuenta. Como los planes se pagan mes a mes, a partir de la baja no se te cobra nada más.</P>
        : <P>Si contrataste un plan o un pase de Haceme Precio, podés arrepentirte dentro de los 10 días corridos desde que lo contrataste. Te devolvemos lo pagado por el mismo medio. No hace falta que entres a tu cuenta.</P>}
      {!baja && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[14px] text-amber-950 ring-1 ring-amber-200">Si compraste un producto a un vendedor de Haceme Precio, el arrepentimiento de esa compra lo gestionás directamente con ese vendedor.</p>}

      {state && typeof state === "object" ? (
        <section className="mt-6 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <p className="font-display text-xl font-extrabold text-emerald-900">Recibimos tu pedido</p>
          <p className="mt-1 text-[15px] text-emerald-900">Tu código de trámite es:</p>
          <p className="mt-2 font-mono text-3xl font-black tracking-wider text-emerald-950">{state.code}</p>
          <p className="mt-2 text-[14px] text-emerald-900">Guardalo (sacale una captura). Te vamos a escribir a {form.email} para terminar el trámite.</p>
        </section>
      ) : (
        <form onSubmit={send} className="mt-6 space-y-3">
          <label className="block text-[14px] font-semibold">Nombre y apellido
            <input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
          </label>
          <label className="block text-[14px] font-semibold">Mail
            <input required type="email" maxLength={120} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
          </label>
          <label className="block text-[14px] font-semibold">{baja ? "¿Qué querés dar de baja? (opcional)" : "¿Qué contrataste y cuándo? (opcional)"}
            <textarea rows={3} maxLength={500} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} className={input}
              placeholder={baja ? "Ej.: mi plan Básico / mi cuenta" : "Ej.: plan Básico, pagado el 20/11"} />
          </label>
          {state === "error" && <p className="text-[14px] font-semibold text-rose-700">No pudimos enviarlo. Revisá el mail y probá de nuevo.</p>}
          {state === "muchas" && <p className="text-[14px] font-semibold text-rose-700">Ya recibimos varios pedidos con este mail hoy. Escribinos por WhatsApp.</p>}
          <button disabled={state === "enviando"} className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-hpred text-[16px] font-semibold text-white disabled:opacity-50">
            {state === "enviando" ? "Enviando…" : baja ? "Pedir la baja" : "Me arrepiento"}
          </button>
        </form>
      )}
    </Page>
  );
}
