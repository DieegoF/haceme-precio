import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Download } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { ORDER_STATUS } from "../../lib/cart.js";
import PanelWidgets from "../../components/widgets/PanelWidgets.jsx";

const PERIODS = [["hoy", "Hoy"], ["7d", "7 días"], ["mes", "Este mes"]];
const PERIOD_FILE = { hoy: "hoy", "7d": "ultimos-7-dias", mes: "este-mes" };

// Desde cuándo cuenta cada período (igual que en la base, con la hora de Argentina).
function periodStart(period) {
  const now = new Date();
  const ar = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
  const offset = now - ar; // diferencia entre la hora local del navegador y la de Argentina
  if (period === "7d") return new Date(now - 7 * 86400000);
  const start = new Date(ar.getFullYear(), ar.getMonth(), period === "mes" ? 1 : ar.getDate());
  return new Date(start.getTime() + offset);
}

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Métricas pro de la tienda: negociación, lo más visto, de dónde vienen y pedidos por estado.
export default function Metricas() {
  const { seller } = useOutletContext();
  const [period, setPeriod] = useState("mes");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const exportCsv = async () => {
    setBusy(true); setMsg("");
    const { data, error } = await supabase.from("orders")
      .select("code, status, payment_status, buyer_name, buyer_contact, delivery, address, total, created_at, order_items(title, color, size, qty, unit_price)")
      .gte("created_at", periodStart(period).toISOString())
      .order("created_at", { ascending: true }).limit(2000);
    setBusy(false);
    if (error) return setMsg("No pudimos armar el archivo. Probá de nuevo.");
    if (!data.length) return setMsg("No hay pedidos en este período.");
    const head = ["Fecha", "Pedido", "Estado", "Pago", "Comprador", "WhatsApp", "Entrega", "Dirección", "Producto", "Color", "Talle", "Cantidad", "Precio unitario", "Total del pedido"];
    const rows = data.flatMap((o) => (o.order_items.length ? o.order_items : [{}]).map((i) => [
      new Date(o.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
      o.code, ORDER_STATUS[o.status]?.label || o.status, o.payment_status === "pagado" ? "Pagado" : o.payment_status,
      o.buyer_name, o.buyer_contact, o.delivery === "envio" ? "Envío" : "Retiro", o.address,
      i.title, i.color, i.size, i.qty, i.unit_price, o.total,
    ]));
    // «;» y BOM para que Excel en español lo abra bien de una.
    const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `pedidos-${seller.slug}-${PERIOD_FILE[period]}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg(`Listo: ${data.length} ${data.length === 1 ? "pedido" : "pedidos"} en el archivo.`);
  };

  return (
    <main className="px-5 pb-8 pt-5">
      <h1 className="font-display text-2xl font-extrabold">Métricas</h1>
      <div className="mt-3 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {PERIODS.map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k)} className={`flex-1 rounded-lg py-1.5 text-[13px] font-semibold ${period === k ? "bg-white shadow-sm" : "text-zinc-500"}`}>{l}</button>
        ))}
      </div>
      <PanelWidgets seller={seller} period={period} />
      <button onClick={exportCsv} disabled={busy}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-semibold text-white disabled:opacity-50 sm:w-auto sm:px-6">
        <Download size={18} /> {busy ? "Armando el archivo…" : "Descargar pedidos (Excel)"}
      </button>
      {msg && <p className="mt-2 text-[13px] font-semibold text-zinc-600">{msg}</p>}
    </main>
  );
}
