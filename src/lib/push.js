import { supabase } from "./supabase.js";

// Avisos push (Web Push). La clave pública VAPID es pública (va al navegador); la privada vive solo en Supabase.
// Se pide al servidor (edge push-key), así coincide siempre con la cargada en los secretos. VITE_VAPID_PUBLIC_KEY la pisa si existe.
let keyPromise = null;
export function getVapidKey() {
  if (import.meta.env.VITE_VAPID_PUBLIC_KEY) return Promise.resolve(import.meta.env.VITE_VAPID_PUBLIC_KEY);
  if (!keyPromise) keyPromise = supabase.functions.invoke("push-key", { method: "GET" })
    .then(({ data }) => data?.publicKey || "").catch(() => "")
    .then((k) => { if (!k) keyPromise = null; return k; });
  return keyPromise;
}

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);
export const isIOS = () => /iPad|iPhone|iPod/.test(ua()) || (ua().includes("Mac") && typeof document !== "undefined" && "ontouchend" in document);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => null); });
}

function keyToBytes(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Estado en ESTE dispositivo: "no-soportado" | "ios-instalar" | "sin-configurar" | "bloqueado" | "activo" | "apagado"
export async function pushState() {
  if (isIOS() && !isStandalone()) return "ios-instalar";
  if (!pushSupported()) return "no-soportado";
  if (!(await getVapidKey())) return "sin-configurar";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub || Notification.permission !== "granted") return "apagado";
  // El navegador guarda un solo registro por dispositivo: confirmamos que sea de ESTA cuenta (si entraste con otra, hay que activarlo de nuevo).
  const { data } = await supabase.from("push_subscriptions").select("id").eq("endpoint", sub.endpoint).maybeSingle();
  return data ? "activo" : "apagado";
}

// Cerrar sesión: primero se borra el aviso de este dispositivo (así la cuenta no le sigue llegando a otra persona).
export async function signOutAndForgetDevice() {
  try { await Promise.race([disablePush(), new Promise((r) => setTimeout(r, 4000))]); } catch { /* nada */ }
  await supabase.auth.signOut();
}

export async function enablePush() {
  const VAPID_PUBLIC_KEY = await getVapidKey();
  if (!VAPID_PUBLIC_KEY) throw new Error("SIN_CLAVE");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(perm === "denied" ? "BLOQUEADO" : "SIN_PERMISO");
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && b64(sub.options?.applicationServerKey || new ArrayBuffer(0)) !== VAPID_PUBLIC_KEY) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: ua() });
  if (error) throw error;
}

export async function disablePush() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function testPush() {
  const { data, error } = await supabase.functions.invoke("push-test", { body: {} });
  if (error) throw error;
  return data;
}
