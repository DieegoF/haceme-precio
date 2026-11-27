import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import Ofertas from "./Ofertas.jsx";
import Pedidos from "./Pedidos.jsx";
import Metricas from "./Metricas.jsx";

// Primera pestaña del panel. Vendedor común: Ofertas. Tienda: Pedidos y, para los productos
// que «aceptan ofertas» (feria americana, usados), también Ofertas, y las Métricas pro.
export default function Inicio() {
  const { seller } = useOutletContext();
  const [tab, setTab] = useState("pedidos");
  if (!seller.is_store) return <Ofertas />;
  return (
    <>
      <div className="mx-5 mt-4 flex gap-1 rounded-xl bg-zinc-100 p-1 lg:mx-0">
        {[["pedidos", "Pedidos"], ["ofertas", "Ofertas"], ["metricas", "Métricas"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg py-2 text-[14px] font-semibold ${tab === k ? "bg-white shadow-sm" : "text-zinc-500"}`}>{l}</button>
        ))}
      </div>
      {tab === "pedidos" ? <Pedidos /> : tab === "ofertas" ? <Ofertas /> : <Metricas />}
    </>
  );
}
