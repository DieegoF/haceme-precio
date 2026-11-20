import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Status from "./Status.jsx";
// Fase 0: la interfaz es el prototipo tal cual (datos de ejemplo en memoria).
// En las fases 1 a 5 se separa en componentes y se conecta a Supabase.
import PrototypeApp from "./prototype/App.jsx";

const Page = window.location.pathname.replace(/\/+$/, "") === "/estado" ? Status : PrototypeApp;
createRoot(document.getElementById("root")).render(<Page />);
