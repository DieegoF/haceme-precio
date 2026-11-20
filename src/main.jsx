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
import OrderPage from "./pages/public/OrderPage.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProductPage from "./pages/public/ProductPage.jsx";
import SellerPage from "./pages/public/SellerPage.jsx";
import Status from "./Status.jsx";

// La demo es pesada: se carga solo si alguien la abre.
const Demo = lazy(() => import("./pages/Demo.jsx"));

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <BrowserRouter>
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
            <Route path="*" element={<Navigate to="/panel" replace />} />
          </Route>
          <Route path="/demo" element={<Demo />} />
          <Route path="/estado" element={<Status />} />
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
