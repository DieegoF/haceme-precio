import { supabase } from "./supabase.js";
import { buyerToken } from "./offers.js";

// Resumen público de opiniones de un vendedor: { count, avg, items }.
export async function getSellerReviews(sellerId, limit = 10) {
  const { data } = await supabase.rpc("seller_reviews", { p_seller: sellerId, p_limit: limit });
  return data || { count: 0, avg: null, items: [] };
}

// ¿Este comprador puede calificar este trato (oferta) o pedido? kind: "oferta" | "pedido".
export async function reviewStatus(kind, id) {
  const { data } = await supabase.rpc("review_status", { p_kind: kind, p_id: id, p_token: buyerToken() });
  return data;
}

export async function submitReview(kind, id, stars, comment) {
  const { data, error } = await supabase.rpc("submit_review", { p_kind: kind, p_id: id, p_token: buyerToken(), p_stars: stars, p_comment: comment || null });
  if (error) throw error;
  return data;
}

export const avgText = (avg) => Number(avg).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
