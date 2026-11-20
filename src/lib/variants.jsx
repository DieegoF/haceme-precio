import React from "react";
// Colores con nombre en castellano -> color para mostrar la muestrita.
export const COLOR_HEX = {
  Negro: "#111111", Blanco: "#FFFFFF", Gris: "#9CA3AF", "Gris melange": "#B8B8B8", Azul: "#1E3A8A", "Azul marino": "#1E2A44", Celeste: "#7DD3FC",
  Jean: "#4A75A3", Rojo: "#DC2626", Bordó: "#7F1D1D", Rosa: "#F9A8D4", Fucsia: "#DB2777", Verde: "#15803D", "Verde militar": "#4B5320",
  Beige: "#E8D7B9", Crudo: "#F2EAD8", Natural: "#EFE6D6", Marrón: "#7C4A2D", Camel: "#C19A6B", Amarillo: "#FACC15", Naranja: "#F97316", Violeta: "#7C3AED", Lila: "#C4B5FD",
};
export const QUICK_COLORS = ["Negro", "Blanco", "Gris", "Azul", "Jean", "Beige", "Rosa", "Verde", "Rojo", "Marrón"];
export const colorHex = (name) => COLOR_HEX[name] || "#D4D4D8";

export const SIZE_SETS = {
  Letras: ["XS", "S", "M", "L", "XL", "XXL"],
  Números: ["36", "38", "40", "42", "44", "46"],
  Calzado: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44"],
  "Talle único": ["Único"],
};
export const COLLECTIONS = ["Remeras", "Camisas", "Buzos", "Camperas", "Pantalones", "Jeans", "Vestidos", "Polleras", "Calzado", "Accesorios"];

// Orden natural de talles (XS < S < M… y números de menor a mayor).
const ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Único"];
export const sortSizes = (a) => [...a].sort((x, y) => {
  const ix = ORDER.indexOf(x), iy = ORDER.indexOf(y);
  if (ix !== -1 && iy !== -1) return ix - iy;
  if (!isNaN(x) && !isNaN(y)) return Number(x) - Number(y);
  return String(x).localeCompare(String(y));
});

// Muestrita de color (con borde para que el blanco se vea).
export function Swatch({ name, size = 28, selected, onClick, disabled }) {
  const hex = colorHex(name);
  const El = onClick ? "button" : "span";
  return (
    <El type={onClick ? "button" : undefined} onClick={onClick} disabled={disabled} aria-label={name} title={name}
      style={{ width: size, height: size, backgroundColor: hex }}
      className={`inline-block shrink-0 rounded-full ring-1 ring-zinc-300 ${selected ? "ring-2 ring-ink ring-offset-2" : ""} ${disabled ? "opacity-30" : ""}`} />
  );
}
