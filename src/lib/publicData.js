import { supabase } from "./supabase.js";

// Lecturas públicas (sin sesión). RLS solo deja ver vendedores con perfil y productos activos o vendidos.
export async function getSellerBySlug(slug) {
  const { data } = await supabase.from("sellers")
    .select("id, name, slug, is_store, phone_verified, created_at, stores(tagline, address, hours, whatsapp, logo_url, banner_url, color, pickup, shipping_enabled, shipping_note, free_ship_from, promo, faq, ready)")
    .eq("slug", slug).maybeSingle();
  if (!data) return null;
  const store = Array.isArray(data.stores) ? data.stores[0] : data.stores;
  return { ...data, store: data.is_store && store?.ready ? store : null };
}

export async function getProduct(sellerId, slug) {
  const { data } = await supabase.from("products")
    .select("id, slug, title, description, category, collection, condition, mode, list_price, compare_at, photos, color_photos, has_variants, liquidation, stock, location, shipping_enabled, shipping_note, status, created_at, product_variants(color, size, stock)")
    .eq("seller_id", sellerId).eq("slug", slug).in("status", ["activa", "vendida"]).maybeSingle();
  return data;
}

export async function getSellerProducts(sellerId) {
  const { data } = await supabase.from("products")
    .select("id, slug, title, list_price, compare_at, photos, status, condition, mode, collection, liquidation, stock")
    .eq("seller_id", sellerId).in("status", ["activa", "vendida"])
    .order("status", { ascending: true }).order("created_at", { ascending: false });
  return data || [];
}
