// Servidor de la web en Railway.
// - Sirve la app (carpeta dist).
// - Para los links públicos (/vendedor y /vendedor/producto) agrega las etiquetas Open Graph
//   con foto, título y precio, así WhatsApp, Instagram y Facebook muestran la vista previa.
//   Esas apps no ejecutan JavaScript: por eso se arma acá y no en el navegador.
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");
const INDEX = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // clave pública: solo lee lo que RLS deja ver a cualquiera
const RESERVED = new Set(["panel", "ingresar", "demo", "estado", "assets", "admin", "api", "ayuda", "terminos", "privacidad", "planes", "precios", "login", "app", "www", "hacemeprecio", "haceme-precio", "soporte", "contacto", "baja", "arrepentimiento"]);
const SLUG = /^[a-z0-9-]{3,80}$/;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");

// Cache corto en memoria para no consultar Supabase en cada vista previa.
const cache = new Map();
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn().catch(() => null);
  cache.set(key, { value, until: Date.now() + 60_000 });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return value;
}

async function rest(q) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, signal: AbortSignal.timeout(2500) });
  if (!r.ok) return null;
  return r.json();
}

async function metaFor(urlPath) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const parts = urlPath.split("/").filter(Boolean).map((p) => decodeURIComponent(p).toLowerCase());
  if (!parts.length || parts.length > 2 || RESERVED.has(parts[0]) || !parts.every((p) => SLUG.test(p))) return null;
  const [sellerSlug, productSlug] = parts;
  if (productSlug) {
    const rows = await cached(`p:${sellerSlug}/${productSlug}`, () =>
      rest(`products?select=title,list_price,photos,description,status,sellers!inner(name,slug)&slug=eq.${productSlug}&sellers.slug=eq.${sellerSlug}&limit=1`));
    const p = rows?.[0];
    if (!p) return null;
    const sold = p.status === "vendida";
    return {
      title: `${p.title} · ${sold ? "Vendido" : money(p.list_price)}`,
      description: sold ? `Ya se vendió. Mirá lo que tiene ${p.sellers.name} en Haceme Precio.` : `Hacé tu oferta sin vueltas. Lo vende ${p.sellers.name}.${p.description ? " " + p.description.replace(/\s+/g, " ").slice(0, 140) : ""}`,
      image: p.photos?.[0],
    };
  }
  const rows = await cached(`s:${sellerSlug}`, () => rest(`sellers?select=name,slug,stores(tagline,logo_url,banner_url)&slug=eq.${sellerSlug}&limit=1`));
  const s = rows?.[0];
  if (!s) return null;
  const st = Array.isArray(s.stores) ? s.stores[0] : s.stores;
  return { title: `${s.name} · Haceme Precio`, description: st?.tagline || `Mirá lo que vende ${s.name} y hacé tu oferta.`, image: st?.banner_url || st?.logo_url };
}

function render(meta, url) {
  if (!meta) return INDEX;
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Haceme Precio" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    meta.image && `<meta property="og:image" content="${esc(meta.image)}" />`,
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}" />`,
  ].filter(Boolean).join("\n    ");
  return INDEX
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(meta.description)}" />`)
    .replace("</head>", `    ${tags}\n  </head>`);
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true); // Railway termina HTTPS adelante: así req.protocol da "https"
app.use("/assets", express.static(path.join(DIST, "assets"), { immutable: true, maxAge: "1y" }));
app.use(express.static(DIST, { index: false, maxAge: "1h" }));
app.get("/healthz", (_req, res) => res.type("text").send("ok"));
app.get("*", async (req, res) => {
  const meta = await metaFor(req.path).catch(() => null);
  res.set("Cache-Control", "no-cache").type("html").send(render(meta, `${req.protocol}://${req.get("host")}${req.originalUrl}`));
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`Haceme Precio escuchando en el puerto ${port}`));
