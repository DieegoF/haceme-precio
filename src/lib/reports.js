import { supabase } from "./supabase.js";
import { buyerToken } from "./offers.js";

export const REPORT_REASONS = [
  ["estafa", "Parece una estafa"],
  ["prohibido", "Es algo que no se puede vender"],
  ["ofensivo", "Tiene contenido ofensivo"],
  ["falso", "Las fotos o los datos son falsos"],
  ["otro", "Otro motivo"],
];

// kind: "producto" | "vendedor" | "resena". Devuelve "OK" o "YA_DENUNCIADO".
export async function submitReport(kind, target, reason, detail) {
  const { data, error } = await supabase.rpc("submit_report", { p_kind: kind, p_target: target, p_reason: reason, p_detail: detail || null, p_token: buyerToken() });
  if (error) throw error;
  return data;
}
