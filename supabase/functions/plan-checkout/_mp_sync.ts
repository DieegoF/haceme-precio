// Compartido: consulta la order a Mercado Pago con el token del vendedor y, si está pagada, marca
// el pedido de tienda, el trato de oferta o el pago del plan/pase. El estado del pago SIEMPRE sale de MP, nunca del aviso ni del navegador.
// Solo entorno de prueba: MP no deja pagar como invitado a una cuenta vendedora de prueba conectada
// por OAuth («una de las partes es de prueba»). Con MP_PRUEBA_TOKEN_APP=1 se cobra con el token de
// prueba de la app (MP_ACCESS_TOKEN), como indica la guía de pruebas de Checkout Pro. En producción NO se define.
export function mpToken(c: { access_token: string }) {
  return Deno.env.get("MP_PRUEBA_TOKEN_APP") === "1" ? Deno.env.get("MP_ACCESS_TOKEN")! : c.access_token;
}

export async function syncMpOrder(admin: any, mpOrderId: string) {
  let kind = "order";
  let { data: o } = await admin.from("orders").select("id, seller_id, payment_status").eq("mp_order_id", mpOrderId).maybeSingle();
  if (!o) {
    const r = await admin.from("offers").select("id, seller_id, payment_status").eq("mp_order_id", mpOrderId).maybeSingle();
    o = r.data; kind = "offer";
  }
  if (!o) {
    // Pago del plan o del pase: se cobra a la cuenta de Haceme Precio (token de la app).
    const r = await admin.from("plan_payments").select("id, seller_id, status").eq("mp_order_id", mpOrderId).maybeSingle();
    o = r.data ? { ...r.data, payment_status: r.data.status } : null; kind = "plan";
  }
  if (!o) return "NO_ES_NUESTRA";
  if (o.payment_status === "pagado") return "YA_PAGADO";
  let token = Deno.env.get("MP_ACCESS_TOKEN")!;
  if (kind !== "plan") {
    const { data: c } = await admin.from("mp_connections").select("access_token").eq("seller_id", o.seller_id).maybeSingle();
    if (!c) return "SIN_CONEXION";
    token = mpToken(c);
  }
  const r = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(mpOrderId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return `MP_${r.status}`;
  const m = await r.json();
  if (m.external_reference !== o.id) return "REFERENCIA_DISTINTA";
  const paidAmount = Number(m.total_paid_amount) > 0 ? Number(m.total_paid_amount) : Number(m.total_amount);
  const paid = m.status === "processed" && (m.status_detail === "accredited" || Number(m.total_paid_amount) >= Number(m.total_amount));
  if (!paid) return `NO_PAGADO_${m.status}_${m.status_detail}`;
  const fn = { order: "mark_order_paid", offer: "mark_offer_paid", plan: "mark_plan_paid" }[kind]!;
  const key = { order: "p_order", offer: "p_offer", plan: "p_payment" }[kind]!;
  const args = { [key]: o.id, p_mp_order: mpOrderId, p_amount: paidAmount };
  const { data, error } = await admin.rpc(fn, args);
  return error ? "ERROR_MARCAR" : data;
}
