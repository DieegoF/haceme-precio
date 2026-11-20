import React from "react";
import { useNavigate } from "react-router-dom";
import { LandingPage } from "../prototype/App.jsx";
import { Phone } from "../components/Brand.jsx";

// Página de inicio pública. Reaprovecha la del prototipo; los botones ahora llevan a páginas reales.
export default function Landing() {
  const nav = useNavigate();
  return (
    <Phone className="sm:my-6 sm:min-h-0 sm:overflow-hidden sm:rounded-3xl sm:shadow-xl sm:ring-1 sm:ring-zinc-200">
      <LandingPage
        actions={{ startSignup: (plan) => nav(`/ingresar?plan=${encodeURIComponent(plan)}`) }}
        onLogin={() => nav("/ingresar")}
        onExample={() => nav("/demo")}
        onExampleStore={() => nav("/demo")}
      />
    </Phone>
  );
}
