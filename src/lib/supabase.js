import { createClient } from "@supabase/supabase-js";

// Solo claves PÚBLICAS acá (URL + publishable key). Nunca la service_role key en el frontend.
// La base se elige por la dirección: los dominios de producción (VITE_PROD_HOSTS) usan la base real;
// las vistas previas de los PR, la dirección de Railway y la compu local siguen en la base de pruebas (dev).
const prodHosts = (import.meta.env.VITE_PROD_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
export const isProdHost = Boolean(
  prodHosts.includes(host) && import.meta.env.VITE_SUPABASE_URL_PROD && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY_PROD
);
const url = isProdHost ? import.meta.env.VITE_SUPABASE_URL_PROD : import.meta.env.VITE_SUPABASE_URL;
const key = isProdHost ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY_PROD : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key) : null;
export const supabaseUrl = url;
export const supabaseKey = key;
