// Compartido: manda un aviso push (Web Push) a todos los dispositivos del vendedor que activaron los avisos.
// Secretos: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (y opcional VAPID_SUBJECT). Si faltan, no hace nada (los mails siguen igual).
// Las suscripciones que el navegador dio de baja (404/410) se borran solas.
import webpush from "npm:web-push@3.6.7";

const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

export type PushMsg = { title: string; body: string; url?: string; tag?: string };

export async function sendPush(sb: any, sellerId: string, msg: PushMsg) {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return { sent: 0, devices: 0, skipped: "SIN_VAPID" };
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:diegofernandez637@gmail.com";
  const { data: subs } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("seller_id", sellerId);
  let sent = 0;
  await Promise.all((subs ?? []).map(async (s: any) => {
    if (!PUSH_HOSTS.test(s.endpoint)) return;
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg),
        { vapidDetails: { subject, publicKey, privateKey }, TTL: 12 * 3600, urgency: "high" });
      sent++;
      await sb.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as any)?.statusCode;
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("id", s.id);
    }
  }));
  return { sent, devices: subs?.length ?? 0 };
}
