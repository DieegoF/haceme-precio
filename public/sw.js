// Service worker de Haceme Precio: recibe los avisos push aunque la página esté cerrada.
// No guarda nada en caché (la app siempre se carga de la red).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Haceme Precio", body: event.data?.text() || "" }; }
  const title = d.title || "Haceme Precio";
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icono-192.png",
    badge: "/icono-192.png",
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    data: { url: d.url || "/panel" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/panel", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin) && "focus" in c) { await c.focus(); if ("navigate" in c) c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
