import { RESERVED_SLUGS } from "./reserved.js";
// "Luna Ropa" -> "luna-ropa" (sin tildes, solo letras, números y guiones)
export const slugify = (s) =>
  (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export const validSlug = (s) => /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(s || "") && !RESERVED_SLUGS.includes(s);
