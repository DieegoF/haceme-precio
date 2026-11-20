import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "./supabase.js";

const AuthCtx = createContext({ session: null, loading: true });

// Guarda la sesión de Supabase y la mantiene al día (login, logout, renovación del token).
export function AuthProvider({ children }) {
  const [state, setState] = useState({ session: null, loading: Boolean(supabase) });
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

// Envuelve páginas que necesitan sesión: si no hay, manda a /ingresar y vuelve después.
export function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="p-8 text-center text-sm text-zinc-500">Cargando…</p>;
  if (!session) return <Navigate to={`/ingresar?volver=${encodeURIComponent(loc.pathname)}`} replace />;
  return children;
}
