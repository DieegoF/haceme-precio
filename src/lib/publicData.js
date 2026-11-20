import { supabase } from "./supabase.js";

// Lecturas públicas (sin sesión). RLS solo deja ver vendedores con perfil y productos activos o vendidos.
export async function getSellerBySlug(slug) {
  const { data } = await supabase.from("sellers").select("id, name, slug, is_store, phone_verified, created_at").eq("slug", slug).maybeSingle();
  return data;
}

export async function getProduct(sellerId, slug) {
  const { data } = await supabase.from("products")
    .select("id, slug, title, description, category, condition, list_price, photos, stock, location, shipping_enabled, shipping_note, status, created_at")
    .eq("seller_id", sellerId).eq("slug", slug).in("status", ["activa", "vendida"]).maybeSingle();
  return data;
}

export async function getSellerProducts(sellerId) {
  const { data } = await supabase.from("products")
    .select("id, slug, title, list_price, photos, status, condition")
    .eq("seller_id", sellerId).in("status", ["activa", "vendida"])
    .order("status", { ascending: true }).order("created_at", { ascending: false });
  return data || [];
}
