// Edge Function: recordatorio antes de que venza un plan pago (3 días antes y el día anterior), por mail y push.
// La llama pg_cron una vez por día. No recibe datos: los candidatos salen de plan_reminder_candidates()
// y cada aviso se reserva en plan_reminders, así nunca sale dos veces (es inofensiva si alguien la llama).
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush } from "./_push.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const FROM = Deno.env.get("EMAIL_FROM") ?? "Haceme Precio <avisos@mail.diegodev.com.ar>";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const TZ = "America/Argentina/Buenos_Aires";
const dia = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const NAME: Record<string, string> = { mensual: "Básico", pro: "Pro con IA", tienda: "Tienda" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const [{ data: list, error }, { data: cfg }] = await Promise.all([
    sb.rpc("plan_reminder_candidates"),
    sb.from("app_settings").select("key, value").in("key", ["app_url", "commission_pct", "commission_from"]),
  ]);
  if (error) return json({ error: "candidatos", detail: error.message }, 500);
  const conf = Object.fromEntries((cfg ?? []).map((x: any) => [x.key, x.value]));
  const appUrl = conf.app_url ?? "";
  const pct = conf.commission_pct ?? "3";
  const desde = conf.commission_from && new Date(conf.commission_from) > new Date()
    ? ` (desde el ${new Date(conf.commission_from).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ })})` : "";

  const sent: string[] = [];
  for (const c of (list ?? []) as any[]) {
    const { error: dup } = await sb.from("plan_reminders").insert({ seller_id: c.seller_id, due_day: c.due_day, kind: c.kind });
    if (dup) continue;
    const plan = NAME[c.plan] ?? c.plan;
    const cuando = c.kind === "manana" ? "mañana" : `el ${dia(c.due)}`;
    const { data: price } = await sb.rpc("plan_price", { p_plan: c.plan });
    const prueba = c.status === "prueba";
    const titulo = prueba ? `Tu prueba gratis del plan ${plan} termina ${cuando}` : `Tu plan ${plan} vence ${cuando}`;
    const queHacer = c.plan === "tienda"
      ? "Si no pagás, tenés 3 días más y después tus publicaciones se pausan. No se borran: vuelven solas apenas pagás."
      : `Si no pagás, pasás solo al plan Gratis: tus publicaciones siguen activas, pero las ventas que cobrás con Mercado Pago pagan ${pct}% de comisión${desde}.`;

    await sendPush(sb, c.seller_id, { title: titulo, body: `Pagá ${money(Number(price))} desde Mi cuenta para seguir igual.`, url: "/panel/cuenta", tag: "plan" }).catch(() => null);

    const html = `<!doctype html><html><body style="margin:0;background:#FAF9F7;font-family:Arial,Helvetica,sans-serif;color:#1C1B19">
  <div style="max-width:480px;margin:0 auto;padding:24px">
    <p style="font-weight:800;font-size:18px;margin:0 0 16px">Haceme <span style="color:#2443B5">Precio</span></p>
    <div style="background:#fff;border-radius:16px;padding:20px;border:1px solid #E5E2DC">
      <h1 style="font-size:20px;margin:0 0 8px">${esc(titulo)}</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 12px;color:#45423D">Hola${c.name ? ` ${esc(c.name)}` : ""}: para seguir con el plan <b>${esc(plan)}</b> pagá <b>${money(Number(price))}</b> desde «Mi cuenta» con Mercado Pago. No hay débito automático: solo pagás si querés seguir.</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#45423D">${esc(queHacer)}</p>
      <a href="${appUrl}/panel/cuenta" style="display:inline-block;background:#2443B5;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:14px">Pagar mi plan</a>
    </div>
    <p style="font-size:12px;color:#6B675F;margin-top:16px">Te escribimos porque tenés una cuenta en Haceme Precio. ¿Dudas? Escribinos por WhatsApp al 11 2455-5499.</p>
  </div></body></html>`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [c.email], subject: titulo, html }),
    });
    if (!r.ok) { await sb.from("plan_reminders").delete().eq("seller_id", c.seller_id).eq("due_day", c.due_day).eq("kind", c.kind); continue; }
    sent.push(c.kind);
  }
  return json({ candidates: list?.length ?? 0, sent: sent.length });
});
