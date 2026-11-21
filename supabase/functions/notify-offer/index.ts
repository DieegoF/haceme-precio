// Edge Function: manda al vendedor el aviso por email de una oferta.
// Recibe solo { offer_id }. No confía en nada más: vuelve a leer todo con service role.
// Cada aviso sale una sola vez (offer_notifications). Requiere el secreto RESEND_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const FROM = Deno.env.get("EMAIL_FROM") ?? "Haceme Precio <avisos@mail.diegodev.com.ar>";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" });
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { offer_id } = await req.json().catch(() => ({}));
  if (typeof offer_id !== "string" || !/^[0-9a-f-]{36}$/i.test(offer_id)) return json({ error: "offer_id" }, 400);

  const { data: o } = await sb.from("offers")
    .select("id, status, reason, amount, expires_at, close_by, buyer_name, seller_id, products(title, slug, photos, list_price)")
    .eq("id", offer_id).maybeSingle();
  if (!o) return json({ skipped: "no_offer" });

  const kind = o.status === "pendiente" ? "nueva" : o.status === "aceptada" && o.reason === "auto" ? "auto" : o.status === "aceptada" && o.reason === "contraoferta_aceptada" ? "contra_aceptada" : null;
  if (!kind) return json({ skipped: "no_event" });

  // Reserva el aviso: si ya existía, no se manda de nuevo.
  const { error: dup } = await sb.from("offer_notifications").insert({ offer_id, kind });
  if (dup) return json({ skipped: "already_sent" });

  const [{ data: acc }, { data: cfg }] = await Promise.all([
    sb.from("seller_accounts").select("email").eq("seller_id", o.seller_id).single(),
    sb.from("app_settings").select("value").eq("key", "app_url").single(),
  ]);
  const p = (o as any).products;
  const appUrl = cfg?.value ?? "";
  const panel = `${appUrl}/panel`;

  const copy = {
    nueva: {
      subject: `Nueva oferta: ${money(o.amount)} por ${p.title}`,
      title: `${esc(o.buyer_name)} ofrece ${money(o.amount)}`,
      body: `Por <b>${esc(p.title)}</b> (publicado a ${money(p.list_price)}). Tenés hasta las <b>${hora(o.expires_at)} h</b> para responder; si no, se vence sola.`,
      cta: "Responder ahora",
    },
    auto: {
      subject: `¡Vendiste! Trato hecho por ${money(o.amount)}`,
      title: `Se aceptó sola la oferta de ${esc(o.buyer_name)}`,
      body: `Ofreció <b>${money(o.amount)}</b> por <b>${esc(p.title)}</b>, cerca de tu precio, así que se aceptó sola. Escribile por WhatsApp desde tu panel para coordinar. El trato queda reservado hasta las <b>${hora(o.close_by)} h</b>.`,
      cta: "Ver el trato y escribirle",
    },
    contra_aceptada: {
      subject: `Aceptaron tu contraoferta de ${money(o.amount)}`,
      title: `${esc(o.buyer_name)} aceptó ${money(o.amount)}`,
      body: `Trato hecho por <b>${esc(p.title)}</b>. Escribile por WhatsApp desde tu panel para coordinar. Queda reservado hasta las <b>${hora(o.close_by)} h</b>.`,
      cta: "Ver el trato y escribirle",
    },
  }[kind];

  const html = `<!doctype html><html><body style="margin:0;background:#FAF9F7;font-family:Arial,Helvetica,sans-serif;color:#1C1B19">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <p style="font-weight:800;font-size:18px;margin:0 0 16px">Haceme <span style="color:#2443B5">Precio</span></p>
    <div style="background:#fff;border-radius:16px;padding:20px;border:1px solid #E5E2DC">
      ${p.photos?.[0] ? `<img src="${esc(p.photos[0])}" alt="" width="96" height="96" style="border-radius:12px;object-fit:cover;display:block;margin-bottom:12px">` : ""}
      <h1 style="font-size:20px;margin:0 0 8px">${copy.title}</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#45423D">${copy.body}</p>
      <a href="${panel}" style="display:inline-block;background:#2443B5;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:14px">${copy.cta}</a>
    </div>
    <p style="font-size:12px;color:#6B675F;margin-top:16px">Recordá verificar el dinero acreditado en tu cuenta antes de entregar. No te guíes solo por capturas.</p>
  </div></body></html>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [acc!.email], subject: copy.subject, html }),
  });
  if (!r.ok) {
    await sb.from("offer_notifications").delete().eq("offer_id", offer_id).eq("kind", kind); // permite reintentar
    return json({ error: "resend", status: r.status, detail: await r.text() }, 502);
  }
  return json({ sent: kind });
});
