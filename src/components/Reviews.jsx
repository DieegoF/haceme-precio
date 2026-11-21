import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getSellerReviews, reviewStatus, submitReview, avgText } from "../lib/reviews.js";

export function Stars({ value, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-zinc-300"} />)}
    </span>
  );
}

// Promedio chiquito para poner al lado del nombre del vendedor.
export function RatingBadge({ summary, onClick }) {
  if (!summary?.count) return null;
  return (
    <button type="button" onClick={onClick} className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-zinc-700">
      <Stars value={summary.avg} /> {avgText(summary.avg)} <span className="font-normal text-zinc-500">({summary.count} {summary.count === 1 ? "opinión" : "opiniones"})</span>
    </button>
  );
}

export function useSellerReviews(sellerId) {
  const [summary, setSummary] = useState(null);
  useEffect(() => { if (sellerId) getSellerReviews(sellerId).then(setSummary).catch(() => setSummary(null)); }, [sellerId]);
  return summary;
}

// Lista pública de opiniones.
export function ReviewList({ summary }) {
  if (!summary?.count) return null;
  return (
    <section id="opiniones" className="mx-5 mt-8 lg:mx-0">
      <h2 className="font-display text-xl font-extrabold">Opiniones</h2>
      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-zinc-600"><Stars value={summary.avg} size={16} /> <b>{avgText(summary.avg)}</b> de 5 · {summary.count} {summary.count === 1 ? "opinión" : "opiniones"} de gente que compró</p>
      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
        {summary.items.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-semibold">{r.buyer_name}</span>
              <Stars value={r.stars} size={13} />
            </div>
            {r.comment && <p className="mt-1 text-[14px] text-zinc-700">«{r.comment}»</p>}
            <p className="mt-1 text-[11px] text-zinc-500">{r.product_title ? `Compró: ${r.product_title} · ` : ""}{new Date(r.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Para el comprador, después de un trato vendido o un pedido entregado.
export function ReviewBox({ kind, id }) {
  const [st, setSt] = useState(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { reviewStatus(kind, id).then(setSt).catch(() => setSt(null)); }, [kind, id]);
  if (!st) return null;
  if (st.review) return (
    <div className="mt-3 rounded-2xl bg-white/70 p-3 text-[13px] ring-1 ring-emerald-200">
      <p className="flex items-center gap-1.5 font-semibold">¡Gracias por tu opinión! <Stars value={st.review.stars} /></p>
      {st.review.comment && <p className="mt-0.5 text-zinc-700">«{st.review.comment}»</p>}
    </div>
  );
  if (!st.can) return null;
  const send = async () => {
    setBusy(true); setErr("");
    try { const r = await submitReview(kind, id, stars, comment.trim()); setSt({ ...st, can: false, review: r }); }
    catch { setErr("No pudimos guardar tu opinión. Probá de nuevo."); }
    setBusy(false);
  };
  return (
    <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
      <p className="text-[14px] font-semibold text-zinc-900">¿Cómo te fue con {st.seller_name}?</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => setStars(i)} aria-label={`${i} estrellas`} className="p-1">
            <Star size={30} className={i <= stars ? "fill-amber-400 text-amber-400" : "text-zinc-300"} />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 280))} rows={2} placeholder="Contá en pocas palabras (opcional)"
            className="mt-2 w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px] outline-none focus:border-zinc-900" />
          <button disabled={busy} onClick={send} className="mt-2 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-50">
            {busy ? "Enviando…" : "Enviar mi opinión"}
          </button>
        </>
      )}
      {err && <p className="mt-1.5 text-[12px] font-semibold text-rose-700">{err}</p>}
    </div>
  );
}
