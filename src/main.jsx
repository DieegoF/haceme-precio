import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { AuthProvider, RequireAuth } from "./lib/auth.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import PanelLayout from "./pages/panel/PanelLayout.jsx";
import Productos from "./pages/panel/Productos.jsx";
import ProductForm from "./pages/panel/ProductForm.jsx";
import Cuenta from "./pages/panel/Cuenta.jsx";
import Inicio from "./pages/panel/Inicio.jsx";
import Admin from "./pages/admin/Admin.jsx";
import MpConectado from "./pages/panel/MpConectado.jsx";
import OrderPage from "./pages/public/OrderPage.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProductPage from "./pages/public/ProductPage.jsx";
import SellerPage from "./pages/public/SellerPage.jsx";
import Status from "./Status.jsx";
import Ayuda from "./pages/Ayuda.jsx";
import { Terminos, Privacidad, Tramite } from "./pages/Legal.jsx";
import DemoStrip from "./components/DemoStrip.jsx";
import { adoptBuyerToken } from "./lib/offers.js";

adoptBuyerToken(); // si llegó con su link personal de oferta (?o=…), recupera sus ofertas en este navegador

// La demo es pesada: se carga solo si alguien la abre.
const Demo = lazy(() => import("./pages/Demo.jsx"));
const Prototipo = lazy(() => import("./prototype/App.jsx"));

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <BrowserRouter>
      <DemoStrip />
      <Suspense fallback={<p className="p-8 text-center text-sm text-zinc-500">Cargando…</p>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/ingresar" element={<Login />} />
          <Route path="/panel" element={<RequireAuth><PanelLayout /></RequireAuth>}>
            <Route index element={<Inicio />} />
            <Route path="productos" element={<Productos />} />
            <Route path="cargar" element={<ProductForm />} />
            <Route path="producto/:id" element={<ProductForm />} />
            <Route path="cuenta" element={<Cuenta />} />
            <Route path="mp/conectado" element={<MpConectado />} />
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
          <Route path="/demo" element={<Demo />} />
          <Route path="/demo/prototipo" element={<Prototipo />} />
          <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
          <Route path="/estado" element={<Status />} />
          <Route path="/ayuda" element={<Ayuda />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<Privacidad />} />
          <Route path="/arrepentimiento" element={<Tramite kind="arrepentimiento" />} />
          <Route path="/baja" element={<Tramite kind="baja" />} />
          <Route path="/pedido/:id" element={<OrderPage />} />
          {/* Links públicos: /vendedor y /vendedor/producto (van al final para no pisar las rutas de la app) */}
          <Route path="/:sellerSlug" element={<SellerPage />} />
          <Route path="/:sellerSlug/:productSlug" element={<ProductPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </AuthProvider>
);
