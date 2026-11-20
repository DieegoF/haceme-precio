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
export function Phone({ children, className = "" }) {
  return <div className={`mx-auto min-h-screen max-w-md bg-white ${className}`}>{children}</div>;
}
