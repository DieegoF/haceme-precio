import { createClient } from "@supabase/supabase-js";

// Solo claves PÚBLICAS acá (URL + publishable key). Nunca la service_role key en el frontend.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key) : null;
export const supabaseUrl = url;
export const supabaseKey = key;
