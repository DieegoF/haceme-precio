import React, { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { BrandBar, Phone } from "../components/Brand.jsx";

const PLANS = {
  pase: "Vendo una sola cosa · las 2 primeras publicaciones son gratis",
  mensual: "Básico · $10.000/mes",
  pro: "Pro con IA · $30.000/mes",
  tienda: "Tienda · $40.000/mes",
};

// Login sin contraseña: email → código de 6 números (plantilla con {{ .Token }} vía Resend). El link también funciona.
export default function Login() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const plan = PLANS[params.get("plan")] ? params.get("plan") : null;
  const volver = params.get("volver") || "/panel";
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";
  const btn = "mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-hpred text-[15px] font-semibold text-white disabled:opacity-40";

  // Con sesión abierta: si viene a elegir un plan, avisamos con qué cuenta está en vez de mandarlo al panel sin decir nada.
  if (session && !plan) return <Navigate to={volver} replace />;
  if (session && plan) return (
    <Phone>
      <BrandBar />
      <main className="px-5 pb-10 pt-8">
        <h1 className="font-display text-2xl font-extrabold">Ya entraste con otra cuenta</h1>
        <p className="mt-2 text-sm text-zinc-600">Estás como <b>{session.user.email}</b>. Para crear una cuenta nueva con el plan <b>{PLANS[plan]}</b>, primero cerrá esta sesión.</p>
        <button onClick={() => supabase.auth.signOut()} className={btn}>Cerrar sesión y crear otra cuenta</button>
        <button onClick={() => nav("/panel")} className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl text-[15px] font-semibold ring-1 ring-zinc-300">Seguir con mi cuenta</button>
      </main>
    </Phone>
  );


  const sendCode = async (e) => {
    e?.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        data: plan ? { plan_elegido: plan } : undefined,
        // El email trae un link que vuelve acá; al abrirlo, Supabase inicia la sesión sola.
        emailRedirectTo: `${window.location.origin}${volver}`,
      },
    });
    setBusy(false);
    if (error) return setErr(friendly(error));
    setStep("code");
  };
  const verify = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setErr("El código no es correcto o ya venció. Pedí uno nuevo.");
    nav(volver, { replace: true });
  };

  return (
    <Phone>
      <BrandBar />
      <main className="px-5 pb-10 pt-8">
        {plan && <p className="mb-3 inline-block rounded-full bg-kraft-50 px-3 py-1 text-[12px] font-semibold text-kraft-700 ring-1 ring-kraft-200">Plan elegido: {PLANS[plan]}</p>}
        {step === "email" ? (
          <form onSubmit={sendCode}>
            <h1 className="font-display text-2xl font-extrabold">Entrá con tu email</h1>
            <p className="mt-1 text-sm text-zinc-600">Te mandamos un código de 6 números. Sin contraseñas.</p>
            <label className="mt-6 block text-sm font-semibold" htmlFor="email">Tu email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@gmail.com" className={input} />
            {err && <p className="mt-2 text-sm font-semibold text-hpred">{err}</p>}
            <button className={btn} disabled={busy || !/^\S+@\S+\.\S+$/.test(email)}>{busy ? "Enviando…" : "Enviarme el código"}</button>
            <p className="mt-4 text-center text-[12px] text-zinc-500">Si es tu primera vez, se crea tu cuenta sola.</p>
          </form>
        ) : (
          <form onSubmit={verify}>
            <h1 className="font-display text-2xl font-extrabold">Revisá tu email</h1>
            <p className="mt-1 text-sm text-zinc-600">Te mandamos un código a <b>{email}</b>. Si no aparece, mirá en spam o promociones.</p>
            <label className="mt-6 block text-sm font-semibold" htmlFor="code">Código de 6 números</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className={input + " text-center font-mono text-2xl tracking-[0.4em]"} />
            {err && <p className="mt-2 text-sm font-semibold text-hpred">{err}</p>}
            <button className={btn} disabled={busy || code.length < 6}>{busy ? "Revisando…" : "Entrar"}</button>
            <div className="mt-4 flex justify-between text-[13px] font-semibold">
              <button type="button" onClick={() => { setStep("email"); setCode(""); setErr(""); }} className="text-zinc-500 underline">Cambiar email</button>
              <button type="button" onClick={sendCode} disabled={busy} className="text-hpred underline">Reenviar código</button>
            </div>
            <p className="mt-6 text-center text-[12px] text-zinc-500">¿Te llegó un link en vez de un código? Tocalo desde este mismo dispositivo y entrás igual.</p>
          </form>
        )}
      </main>
    </Phone>
  );
}

function friendly(error) {
  const m = (error?.message || "").toLowerCase();
  if (m.includes("rate") || error?.status === 429) return "Pediste muchos emails seguidos. Esperá un rato y probá de nuevo.";
  if (m.includes("not authorized") || m.includes("address not authorized")) return "Todavía no podemos mandar emails a esa dirección (la app está en prueba). Usá el email del equipo.";
  return "No pudimos mandar el email. Revisalo y probá de nuevo.";
}
