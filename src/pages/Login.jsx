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

  const google = async () => {
    setErr("");
    try { if (plan) localStorage.setItem("hp_plan_elegido", plan); } catch { /* sin almacenamiento */ }
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${volver}` } });
    if (error) setErr("No pudimos abrir Google. Probá de nuevo o entrá con tu email.");
  };

  return (
    <Phone>
      <BrandBar />
      <main className="px-5 pb-10 pt-8">
        {plan && <p className="mb-3 inline-block rounded-full bg-kraft-50 px-3 py-1 text-[12px] font-semibold text-kraft-700 ring-1 ring-kraft-200">Plan elegido: {PLANS[plan]}</p>}
        {step === "email" ? (
          <form onSubmit={sendCode}>
            <h1 className="font-display text-2xl font-extrabold">Entrá a Haceme Precio</h1>
            <button type="button" onClick={google} className="mt-5 flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-white text-[16px] font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50">
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              Continuar con Google
            </button>
            <div className="my-5 flex items-center gap-3 text-[12px] text-zinc-400"><span className="h-px flex-1 bg-zinc-200" /> o con tu email <span className="h-px flex-1 bg-zinc-200" /></div>
            <p className="text-sm text-zinc-600">Te mandamos un código de 6 números. Sin contraseñas.</p>
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
