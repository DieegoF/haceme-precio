export const fmt = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
export const parseMoney = (s) => Number(String(s ?? "").replace(/\D/g, "")) || 0;
export const moneyInput = (s) => { const n = parseMoney(s); return n ? n.toLocaleString("es-AR") : ""; };
