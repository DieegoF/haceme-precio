import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { BrandBar, Phone } from "../components/Brand.jsx";

// Panel del vendedor. En esta etapa solo confirma que el login real funciona;
// productos, ofertas y pedidos se conectan en las próximas entregas de la fase 1 y 2.
export default function Panel() {
  const { session } = useAuth();
  const nav = useNavigate();
  const user = session.user;
  const salir = async () => { await supabase.auth.signOut(); nav("/", { replace: true }); };
  return (
    <Phone>
      <BrandBar right={<button onClick={salir} className="text-[13px] font-semibold text-zinc-500 underline">Cerrar sesión</button>} />
      <main className="px-5 pb-10 pt-8">
        <p className="text-sm text-zinc-500">Hola 👋</p>
        <h1 className="font-display text-2xl font-extrabold break-all">{user.email}</h1>
        <div className="mt-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <p className="font-semibold">✓ Entraste con tu cuenta real</p>
          <p className="mt-1">Tu cuenta quedó guardada en la base de datos. {user.user_metadata?.plan_elegido ? `Plan elegido: ${user.user_metadata.plan_elegido}.` : ""}</p>
        </div>
        <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200">
          <p className="font-semibold">Tu panel se está armando</p>
          <p className="mt-1">Acá van a aparecer tus productos, ofertas y pedidos. Mientras tanto, podés ver cómo va a quedar en la demo.</p>
          <button onClick={() => nav("/demo")} className="mt-3 text-[13px] font-semibold text-hpred underline">Ver la demo</button>
        </div>
      </main>
    </Phone>
  );
}
