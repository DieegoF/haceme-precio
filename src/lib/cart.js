import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { buyerToken } from "./offers.js";

// Carrito del comprador: vive en su navegador, uno por tienda. Precio y stock los vuelve a decidir el servidor.
const KEY = (sellerId) => `hp_cart_${sellerId}`;
const EVT = "hp-cart";
const read = (sellerId) => { try { return JSON.parse(localStorage.getItem(KEY(sellerId)) || "[]"); } catch { return []; } };
const write = (sellerId, items) => {
  try { localStorage.setItem(KEY(sellerId), JSON.stringify(items)); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: sellerId }));
};
export const lineKey = (i) => `${i.product_id}|${i.color || ""}|${i.size || ""}`;

export function useCart(sellerId) {
  const [items, setItems] = useState(() => (sellerId ? read(sellerId) : []));
  useEffect(() => {
    if (!sellerId) return undefined;
    setItems(read(sellerId));
    const sync = (e) => { if (!e.detail || e.detail === sellerId) setItems(read(sellerId)); };
    const storage = (e) => { if (e.key === KEY(sellerId)) setItems(read(sellerId)); };
    window.addEventListener(EVT, sync); window.addEventListener("storage", storage);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", storage); };
  }, [sellerId]);

  const add = (line) => {
    const list = read(sellerId);
    const k = lineKey(line);
    const found = list.find((i) => lineKey(i) === k);
    if (found) found.qty = Math.min(found.max || 20, found.qty + line.qty);
    else list.push(line);
    write(sellerId, list);
  };
  const setQty = (k, qty) => write(sellerId, read(sellerId).map((i) => (lineKey(i) === k ? { ...i, qty: Math.max(1, Math.min(i.max || 20, qty)) } : i)));
  const remove = (k) => write(sellerId, read(sellerId).filter((i) => lineKey(i) !== k));
  const clear = () => write(sellerId, []);
  const count = items.reduce((t, i) => t + i.qty, 0);
  const total = items.reduce((t, i) => t + i.qty * i.price, 0);
  return { items, add, setQty, remove, clear, count, total };
}

// Pedidos del comprador
export async function placeOrder(sellerId, { name, contact, delivery, address, note }, items) {
  const { data, error } = await supabase.rpc("place_order", {
    p_seller: sellerId, p_token: buyerToken(), p_name: name, p_contact: contact, p_delivery: delivery,
    p_address: address || null, p_note: note || null,
    p_items: items.map((i) => ({ product_id: i.product_id, color: i.color || "", size: i.size || "", qty: i.qty })),
  });
  if (error) throw error;
  return data;
}
export async function getMyOrders() {
  const { data, error } = await supabase.rpc("get_my_orders", { p_token: buyerToken() });
  if (error) throw error;
  return data || [];
}
export async function cancelMyOrder(id) {
  const { data, error } = await supabase.rpc("cancel_my_order", { p_order: id, p_token: buyerToken() });
  if (error) throw error;
  return data;
}
// Pedidos del vendedor
export async function sellerOrderAction(id, action) {
  const { data, error } = await supabase.rpc("seller_order_action", { p_order: id, p_action: action });
  if (error) throw error;
  return data;
}

const MSG = {
  FALTA_NOMBRE: "Escribí tu nombre.",
  FALTA_CONTACTO: "Escribí tu WhatsApp con código de área (ej: 11 5555 1234).",
  FALTA_DIRECCION: "Escribí la dirección para el envío.",
  CARRITO_VACIO: "Tu carrito está vacío.",
  CARRITO_GRANDE: "Son muchos productos para un pedido. Dividilo en dos.",
  ENTREGA: "Elegí cómo lo recibís.",
  MUCHOS_PEDIDOS: "Ya tenés 3 pedidos esperando en esta tienda. Esperá que te confirmen.",
  NO_TIENDA: "Esta tienda no está tomando pedidos ahora.",
  YA_NO_VALE: "Este pedido ya cambió de estado. Actualizá la página.",
  NO_ENCONTRADO: "No encontramos ese pedido.",
};
export function orderError(e) {
  const m = e?.message || "";
  const stock = m.match(/SIN_STOCK: (.+)/);
  if (stock) return `Ya no queda stock de ${stock[1]}. Sacalo o bajá la cantidad.`;
  const gone = m.match(/NO_DISPONIBLE: (.+)/);
  if (gone) return `«${gone[1]}» ya no está disponible. Sacalo del carrito.`;
  const k = Object.keys(MSG).find((key) => m.includes(key));
  return k ? MSG[k] : "No pudimos mandar el pedido. Revisá tu conexión y probá de nuevo.";
}

export const ORDER_STATUS = {
  reservado: { label: "Esperando confirmación", tone: "bg-amber-100 text-amber-800" },
  confirmado: { label: "Confirmado", tone: "bg-emerald-100 text-emerald-800" },
  entregado: { label: "Entregado", tone: "bg-zinc-200 text-zinc-700" },
  cancelado: { label: "Cancelado", tone: "bg-rose-100 text-rose-700" },
  vencido: { label: "Vencido", tone: "bg-zinc-200 text-zinc-600" },
};
