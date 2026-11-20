import { supabase } from "./supabase.js";

const BUCKET = "product-photos";

// Achica la foto en el celular antes de subirla (más rápido y más barato): lado mayor 1280 px, JPG 82%.
export async function compressImage(file, max = 1280) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Sube a "<id del vendedor>/<uuid>.jpg" (las reglas de Storage solo dejan escribir en tu carpeta).
export async function uploadPhoto(file, userId) {
  const blob = await compressImage(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const pathFromUrl = (url) => { const i = url.indexOf(`/${BUCKET}/`); return i === -1 ? null : decodeURIComponent(url.slice(i + BUCKET.length + 2)); };

export async function removePhotos(urls) {
  const paths = (urls || []).map(pathFromUrl).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
