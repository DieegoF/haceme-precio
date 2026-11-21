import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { DEMO_SLUGS, isDemoEmail, stripHidden, hideStrip } from "../lib/demo.js";

// Franja arriba de todo en las páginas de la demo pública y en el panel demo.
export default function DemoStrip() {
  const { pathname } = useLocation();
  const { session } = useAuth();
  const nav = useNavigate();
  const [hidden, setHidden] = useState(() => stripHidden());
  const first = pathname.split("/")[1] || "";
  const inPanel = pathname.startsWith("/panel") && isDemoEmail(session?.user?.email);
  const onDemoPage = DEMO_SLUGS.includes(first) || inPanel;
  if (!onDemoPage || hidden) return null;
  const salir = async () => { await supabase.auth.signOut(); nav("/demo"); };
  return (
    <div className="flex items-center gap-2 bg-amber-300 px-3 py-2 text-[12px] font-semibold text-amber-950">
      <span className="min-w-0 flex-1">
        🎬 {inPanel ? "Estás en el panel de prueba" : "Esto es una demo"} de Haceme Precio · se reinicia cada noche.{" "}
        {inPanel ? <button onClick={salir} className="underline">Salir de la demo</button> : <Link to="/demo" className="underline">Ver la demo completa</Link>}
        {" · "}<Link to="/ingresar" onClick={inPanel ? (e) => { e.preventDefault(); salir().then(() => nav("/ingresar")); } : undefined} className="underline">Crear mi cuenta gratis</Link>
      </span>
      <button aria-label="Ocultar franja" onClick={() => { hideStrip(); setHidden(true); }} className="shrink-0 rounded-full p-1 hover:bg-amber-400"><X size={14} /></button>
    </div>
  );
}
