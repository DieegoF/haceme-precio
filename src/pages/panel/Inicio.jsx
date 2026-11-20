import React from "react";
import { useOutletContext } from "react-router-dom";
import Ofertas from "./Ofertas.jsx";
import Pedidos from "./Pedidos.jsx";

// La primera pestaña del panel: la tienda vende a precio fijo (Pedidos); el resto negocia (Ofertas).
export default function Inicio() {
  const { seller } = useOutletContext();
  return seller.is_store ? <Pedidos /> : <Ofertas />;
}
