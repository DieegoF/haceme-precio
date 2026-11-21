// Compartido: consulta la order a Mercado Pago con el token del vendedor y, si está pagada, marca el pedido.
// El estado del pago SIEMPRE sale de MP, nunca del aviso ni del navegador.
export async function syncMpOrder(admin: any, mpOrderId: string) {
  const { data: o } = await admin.from("orders").select("id, seller_id, total, payment_status").eq("mp_order_id", mpOrderId).maybeSingle();
  if (!o) return "NO_ES_NUESTRA";
  if (o.payment_status === "pagado") return "YA_PAGADO";
  const { data: c } = await admin.from("mp_connections").select("access_token").eq("seller_id", o.seller_id).maybeSingle();
  if (!c) return "SIN_CONEXION";
  const r = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(mpOrderId)}`, { headers: { Authorization: `Bearer ${c.access_token}` } });
  if (!r.ok) return `MP_${r.status}`;
  const m = await r.json();
  if (m.external_reference !== o.id) return "REFERENCIA_DISTINTA";
  const paidAmount = Number(m.total_paid_amount) > 0 ? Number(m.total_paid_amount) : Number(m.total_amount);
  const paid = m.status === "processed" && (m.status_detail === "accredited" || Number(m.total_paid_amount) >= Number(m.total_amount));
  if (!paid) return `NO_PAGADO_${m.status}_${m.status_detail}`;
  const { data, error } = await admin.rpc("mark_order_paid", { p_order: o.id, p_mp_order: mpOrderId, p_amount: paidAmount });
  return error ? "ERROR_MARCAR" : data;
}
