// Edge Function: avisa por email al vendedor que entró un pedido en su tienda.
// Recibe solo { order_id }. No confía en nada más: vuelve a leer todo con service role.
// Cada aviso sale una sola vez (order_notifications). Requiere el secreto RESEND_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const FROM = Deno.env.get("EMAIL_FROM") ?? "Haceme Precio <avisos@mail.diegodev.com.ar>";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { order_id } = await req.json().catch(() => ({}));
  if (typeof order_id !== "string" || !/^[0-9a-f-]{36}$/i.test(order_id)) return json({ error: "order_id" }, 400);

  const { data: o } = await sb.from("orders")
    .select("id, code, status, buyer_name, delivery, address, note, total, seller_id, order_items(title, color, size, qty, unit_price, photo)")
    .eq("id", order_id).maybeSingle();
  if (!o) return json({ skipped: "no_order" });

  const { error: dup } = await sb.from("order_notifications").insert({ order_id, kind: "nuevo" });
  if (dup) return json({ skipped: "already_sent" });

  const [{ data: acc }, { data: cfg }] = await Promise.all([
    sb.from("seller_accounts").select("email").eq("seller_id", o.seller_id).single(),
    sb.from("app_settings").select("value").eq("key", "app_url").single(),
  ]);
  const items = (o as any).order_items as any[];
  const units = items.reduce((t, i) => t + i.qty, 0);
  const rows = items.map((i) => {
    const v = [i.color, i.size && `talle ${i.size}`].filter(Boolean).join(", ");
    return `<tr><td style="padding:6px 0;font-size:14px">${i.qty} × ${esc(i.title)}${v ? `<br><span style="color:#6B675F;font-size:12px">${esc(v)}</span>` : ""}</td>
      <td style="padding:6px 0;font-size:14px;text-align:right;white-space:nowrap">${money(i.unit_price * i.qty)}</td></tr>`;
  }).join("");
  const entrega = o.delivery === "envio" ? `Envío a: <b>${esc(o.address)}</b>` : "Retira en el local";

  const html = `<!doctype html><html><body style="margin:0;background:#FAF9F7;font-family:Arial,Helvetica,sans-serif;color:#1C1B19">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <p style="font-weight:800;font-size:18px;margin:0 0 16px">Haceme <span style="color:#2443B5">Precio</span></p>
    <div style="background:#fff;border-radius:16px;padding:20px;border:1px solid #E5E2DC">
      <p style="font-size:12px;font-weight:bold;color:#6B675F;margin:0">PEDIDO #${esc(o.code)}</p>
      <h1 style="font-size:20px;margin:4px 0 8px">${esc(o.buyer_name)} te hizo un pedido de ${money(o.total)}</h1>
      <table style="width:100%;border-collapse:collapse;margin:8px 0 12px">${rows}
        <tr><td style="padding-top:8px;border-top:1px solid #eee;font-weight:bold">Total</td><td style="padding-top:8px;border-top:1px solid #eee;font-weight:bold;text-align:right">${money(o.total)}</td></tr></table>
      <p style="font-size:14px;margin:0 0 6px">${entrega}</p>
      ${o.note ? `<p style="font-size:14px;margin:0 0 6px">Nota: ${esc(o.note)}</p>` : ""}
      <p style="font-size:14px;line-height:1.5;margin:12px 0 20px;color:#45423D">Le guardamos el stock por <b>24 h</b>. Confirmalo desde tu panel y escribile por WhatsApp para coordinar el pago y la entrega.</p>
      <a href="${cfg?.value ?? ""}/panel" style="display:inline-block;background:#2443B5;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:14px">Ver el pedido</a>
    </div>
    <p style="font-size:12px;color:#6B675F;margin-top:16px">Recordá verificar el dinero acreditado en tu cuenta antes de entregar. No te guíes solo por capturas.</p>
  </div></body></html>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [acc!.email], subject: `Nuevo pedido #${o.code} · ${units} ${units === 1 ? "producto" : "productos"} · ${money(o.total)}`, html }),
  });
  if (!r.ok) {
    await sb.from("order_notifications").delete().eq("order_id", order_id).eq("kind", "nuevo");
    return json({ error: "resend", status: r.status, detail: await r.text() }, 502);
  }
  return json({ sent: "nuevo" });
});
