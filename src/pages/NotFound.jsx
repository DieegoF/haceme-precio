import React from "react";
import { Link } from "react-router-dom";
import { BrandBar, Phone } from "../components/Brand.jsx";

export default function NotFound() {
  return (
    <Phone>
      <BrandBar />
      <main className="px-5 py-16 text-center">
        <h1 className="font-display text-2xl font-extrabold">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-zinc-600">Puede que el link esté mal escrito o que la publicación ya no exista.</p>
        <Link to="/" className="mt-6 inline-block font-semibold text-hpred underline">Ir al inicio</Link>
      </main>
    </Phone>
  );
}
