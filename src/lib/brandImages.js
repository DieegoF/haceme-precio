import { supabase } from "./supabase.js";

const BUCKET = "store-assets";

// Recorta centrado al tamaño pedido (sin deformar) y comprime a JPG.
export async function cropToBlob(file, w, h) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.max(w / img.width, h / img.height);
    const sw = w / k, sh = h / k;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
    return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// kind: "logo" (400x400) o "banner" (1200x400)
export async function uploadBrandImage(file, userId, kind) {
  const blob = kind === "logo" ? await cropToBlob(file, 400, 400) : await cropToBlob(file, 1200, 400);
  const path = `${userId}/${kind}-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
