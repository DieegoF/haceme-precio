import React from "react";
import { Link } from "react-router-dom";
import { LOGO_HORIZ } from "../prototype/brand.js";

export function BrandBar({ right }) {
  return (
    <header className="flex items-center justify-between px-5 pt-5">
      <Link to="/" aria-label="Haceme Precio, inicio"><img src={LOGO_HORIZ} alt="Haceme Precio" className="h-7 w-auto" /></Link>
      {right}
    </header>
  );
}

// Contenedor con ancho de celular: la app está pensada primero para el teléfono.
// Marco de la app. Mobile first: columna angosta. En compu (lg), «wide» usa el ancho de pantalla;
// las pantallas angostas (ingreso, pedido) se ven como una tarjeta centrada sobre fondo gris.
// wide="full": usa todo el ancho (panel). wide (true): fondo blanco a todo el ancho y contenido centrado (tienda, producto).
export function Phone({ children, className = "", wide = false }) {
  if (wide === "full") return <div className={`mx-auto min-h-screen max-w-md bg-white lg:max-w-none ${className}`}>{children}</div>;
  if (wide) return <div className="min-h-screen bg-white"><div className={`mx-auto min-h-screen max-w-md lg:max-w-6xl ${className}`}>{children}</div></div>;
  return <div className={`mx-auto min-h-screen max-w-md bg-white lg:my-8 lg:min-h-[calc(100vh-4rem)] lg:rounded-3xl lg:shadow-sm lg:ring-1 lg:ring-zinc-200 ${className}`}>{children}</div>;
}
