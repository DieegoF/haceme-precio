import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ClipboardList, Flag, Package, Search, Star, Users } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { fmt } from "../../lib/format.js";

// Panel de administración (solo is_admin). Pensado para compu; en el celular se ve en columna.
const PLAN = { pase: "Una sola cosa", mensual: "Básico", pro: "Pro con IA", tienda: "Tienda" };
const STATUS = { prueba: "Prueba", activa: "Activa", gracia: "Pago pendiente", vencida: "Vencida", suspendida: "Suspendida", cancelada: "Cancelada" };
const TONE = { prueba: "bg-sky-100 text-sky-800", activa: "bg-emerald-100 text-emerald-800", gracia: "bg-amber-100 text-amber-800", vencida: "bg-zinc-200 text-zinc-700", suspendida: "bg-rose-100 text-rose-700", cancelada: "bg-zinc-200 text-zinc-600" };
const ACTION = { plan: "Cambió el plan", extender: "Extendió la prueba", estado: "Cambió el estado", pases: "Ajustó pases", pausar: "Pausó publicación", liberar: "Liberó publicación",
  ocultar_resena: "Ocultó una reseña", mostrar_resena: "Volvió a mostrar una reseña", denuncia_resuelto: "Resolvió una denuncia", denuncia_descartado: "Descartó una denuncia" };
const REASON = { estafa: "Estafa", prohibido: "No se puede vender", ofensivo: "Ofensivo", falso: "Falso", otro: "Otro" };
const date = (d) => (d ? new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "2-digit" }) : "—");

export default function Admin() {
  const [tab, setTab] = useState("resumen");
  const [denied, setDenied] = useState(false);
  const [pending, setPending] = useState(0);
  useEffect(() => { supabase.rpc("admin_overview").then(({ error }) => error && setDenied(true)); }, []);
  useEffect(() => { supabase.rpc("admin_reports_count").then(({ data }) => setPending(data || 0)); }, [tab]);
  if (denied) return <main className="px-6 py-24 text-center"><h1 className="font-display text-2xl font-extrabold">No tenés acceso</h1><Link to="/panel" className="mt-4 inline-block text-hpred underline">Volver a tu panel</Link></main>;

  const tabs = [["resumen", "Resumen", BarChart3], ["denuncias", `Denuncias${pending ? ` (${pending})` : ""}`, Flag], ["vendedores", "Vendedores", Users], ["publicaciones", "Publicaciones", Package], ["resenas", "Reseñas", Star], ["registro", "Registro", ClipboardList]];
  return (
    <div className="min-h-screen bg-zinc-50 lg:flex">
      <aside className="border-b border-zinc-200 bg-white lg:min-h-screen lg:w-60 lg:border-b-0 lg:border-r">
        <div className="px-5 py-4"><p className="font-display text-lg font-black">haceme <span className="text-hpred">precio</span></p><p className="text-[12px] font-semibold text-zinc-500">Administración</p></div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
          {tabs.map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold ${tab === k ? "bg-ink text-white" : "text-zinc-600 hover:bg-zinc-100"}`}><Icon size={16} /> {l}</button>
          ))}
          <Link to="/panel" className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-semibold text-zinc-500 hover:bg-zinc-100 lg:mt-4">← Mi panel</Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 lg:p-8">
        {tab === "resumen" && <Resumen />}
        {tab === "vendedores" && <Vendedores />}
        {tab === "publicaciones" && <Publicaciones />}
        {tab === "registro" && <Registro />}
        {tab === "denuncias" && <Denuncias onChange={() => supabase.rpc("admin_reports_count").then(({ data }) => setPending(data || 0))} />}
        {tab === "resenas" && <Resenas />}
      </main>
    </div>
  );
}

function Card({ label, value, sub }) {
  return <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200"><p className="text-[12px] font-semibold text-zinc-500">{label}</p><p className="mt-1 font-display text-2xl font-black">{value}</p>{sub && <p className="text-[12px] text-zinc-500">{sub}</p>}</div>;
}

function Resumen() {
  const [o, setO] = useState(null);
  useEffect(() => { supabase.rpc("admin_overview").then(({ data }) => setO(data)); }, []);
  if (!o) return <p className="text-sm text-zinc-500">Cargando…</p>;
  const plan = o.by_plan || {}, st = o.by_status || {};
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Resumen</h1>
      <p className="text-sm text-zinc-500">Este mes</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Vendedores" value={o.sellers} sub={`${o.new_month} nuevos este mes`} />
        <Card label="Pruebas que vencen (3 días)" value={o.trials_ending} sub={`${st.prueba || 0} en prueba`} />
        <Card label="Vendido en tiendas" value={fmt(o.sold_month)} sub={`${o.orders_month} pedidos · ${o.orders_paid_month} pagados con MP`} />
        <Card label="Ofertas" value={o.offers_month} sub={`${o.deals_month} tratos cerrados`} />
        <Card label="Publicaciones activas" value={o.products_active} sub={`${o.products_paused_admin} pausadas por vos`} />
        <Card label="Con Mercado Pago" value={o.mp_connected} sub="cuentas conectadas" />
        <Card label="Por plan" value={`${plan.tienda || 0} tiendas`} sub={`${plan.mensual || 0} Básico · ${plan.pase || 0} una sola cosa · ${plan.pro || 0} Pro`} />
        <Card label="Por estado" value={`${st.activa || 0} activas`} sub={`${st.suspendida || 0} suspendidas · ${st.vencida || 0} vencidas`} />
      </div>
    </>
  );
}

function useSearch(rpc) {
  const [q, setQ] = useState(""); const [rows, setRows] = useState(null); const [tick, setTick] = useState(0);
  useEffect(() => { const t = setTimeout(() => supabase.rpc(rpc, { p_q: q || null }).then(({ data }) => setRows(data || [])), 250); return () => clearTimeout(t); }, [q, tick, rpc]);
  return { q, setQ, rows, reload: () => setTick((x) => x + 1) };
}
function SearchBox({ value, onChange, placeholder }) {
  return <label className="mt-4 flex max-w-md items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-zinc-200"><Search size={16} className="text-zinc-400" /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent text-[14px] outline-none" /></label>;
}

function Vendedores() {
  const { q, setQ, rows, reload } = useSearch("admin_sellers");
  const [msg, setMsg] = useState("");
  const act = async (s, action, value, label) => {
    if (!window.confirm(`${label} para ${s.email}?`)) return;
    const { error } = await supabase.rpc("admin_seller_action", { p_seller: s.id, p_action: action, p_value: String(value) });
    setMsg(error ? "No se pudo hacer el cambio." : `Listo: ${label.toLowerCase()} (${s.email}).`); reload();
  };
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Vendedores</h1>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por mail, nombre o link" />
      {msg && <p className="mt-3 text-sm font-semibold text-emerald-700">{msg}</p>}
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-zinc-200">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="border-b border-zinc-200 text-[12px] text-zinc-500"><tr>
            <th className="p-3">Vendedor</th><th className="p-3">Plan</th><th className="p-3">Estado</th><th className="p-3">Alta</th>
            <th className="p-3 text-right">Publ.</th><th className="p-3 text-right">Ventas</th><th className="p-3">MP</th><th className="p-3">Acciones</th></tr></thead>
          <tbody>
            {rows?.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 align-top last:border-0">
                <td className="p-3"><p className="font-semibold">{s.name || "(sin nombre)"} {s.is_admin && <span className="ml-1 rounded bg-ink px-1.5 text-[10px] text-white">admin</span>}</p>
                  <p className="text-zinc-500">{s.email}</p>{s.slug && <a href={`/${s.slug}`} target="_blank" rel="noreferrer" className="text-hpred underline">/{s.slug}</a>}</td>
                <td className="p-3"><select value={s.plan} onChange={(e) => act(s, "plan", e.target.value, `Cambiar el plan a ${PLAN[e.target.value]}`)} className="rounded-lg border border-zinc-300 px-2 py-1">
                  {Object.entries(PLAN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  {s.plan === "pase" && <p className="mt-1 text-[11px] text-zinc-500">{s.free_pass_used_at ? "Gratis usada" : "Gratis disponible"} · {s.pass_credits} pases</p>}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE[s.status]}`}>{STATUS[s.status]}</span>
                  {s.status === "prueba" && <p className="mt-1 text-[11px] text-zinc-500">hasta {date(s.trial_ends_at)}</p>}</td>
                <td className="p-3 text-zinc-600">{date(s.created_at)}</td>
                <td className="p-3 text-right">{s.products}</td>
                <td className="p-3 text-right"><p className="font-semibold">{fmt(s.sold)}</p><p className="text-[11px] text-zinc-500">{s.orders} pedidos · {s.offers} ofertas</p></td>
                <td className="p-3">{s.mp ? "✓" : "—"}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1.5">
                  <button onClick={() => act(s, "extender", 7, "Extender la prueba 7 días")} className="rounded-lg px-2 py-1 font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50">+7 días</button>
                  {s.plan === "pase" && <button onClick={() => act(s, "pases", s.pass_credits + 1, "Dar 1 pase")} className="rounded-lg px-2 py-1 font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50">+1 pase</button>}
                  {s.status !== "suspendida"
                    ? <button onClick={() => act(s, "estado", "suspendida", "Suspender la cuenta")} className="rounded-lg px-2 py-1 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">Suspender</button>
                    : <button onClick={() => act(s, "estado", "activa", "Reactivar la cuenta")} className="rounded-lg px-2 py-1 font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">Reactivar</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && !rows.length && <p className="p-6 text-center text-sm text-zinc-500">No hay vendedores con esa búsqueda.</p>}
        {!rows && <p className="p-6 text-center text-sm text-zinc-500">Cargando…</p>}
      </div>
      <p className="mt-3 text-[12px] text-zinc-500">Cada cambio queda guardado en «Registro». Cambiar a Tienda le pide armar la tienda la próxima vez que entra.</p>
    </>
  );
}

function Publicaciones() {
  const { q, setQ, rows, reload } = useSearch("admin_products");
  const act = async (p, action) => {
    const reason = action === "pausar" ? window.prompt(`¿Por qué pausás «${p.title}»? (queda en el registro)`, "Denuncia / contenido no permitido") : "";
    if (reason === null) return;
    await supabase.rpc("admin_product_action", { p_product: p.id, p_action: action, p_reason: reason }); reload();
  };
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Publicaciones</h1>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por título o vendedor" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows?.map((p) => (
          <div key={p.id} className={`flex gap-3 rounded-2xl bg-white p-3 ring-1 ${p.moderation === "pausada" ? "ring-rose-300" : "ring-zinc-200"}`}>
            {p.photo ? <img src={p.photo} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <span className="h-20 w-20 shrink-0 rounded-xl bg-zinc-100" />}
            <div className="min-w-0 flex-1">
              <a href={`/${p.seller_slug}/${p.slug}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-[14px] font-semibold hover:underline">{p.title}</a>
              <p className="text-[12px] text-zinc-500">{p.seller} · {fmt(p.list_price)} · {p.mode === "fijo" ? "precio fijo" : "ofertas"}</p>
              <p className="text-[12px] text-zinc-500">{p.status}{p.moderation === "pausada" && <b className="text-rose-700"> · pausada por vos</b>}</p>
              {p.moderation === "pausada"
                ? <button onClick={() => act(p, "liberar")} className="mt-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Liberar</button>
                : <button onClick={() => act(p, "pausar")} className="mt-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-200">Pausar</button>}
            </div>
          </div>
        ))}
      </div>
      {!rows && <p className="mt-4 text-sm text-zinc-500">Cargando…</p>}
    </>
  );
}

function Registro() {
  const [rows, setRows] = useState(null);
  useEffect(() => { supabase.rpc("admin_log_list").then(({ data }) => setRows(data || [])); }, []);
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Registro</h1>
      <p className="text-sm text-zinc-500">Todo lo que hiciste desde este panel.</p>
      <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200">
        {rows?.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-[13px]">
            <span><b>{ACTION[l.action] || l.action}</b>{l.detail?.valor ? ` → ${l.action === "plan" ? PLAN[l.detail.valor] : l.detail.valor}` : ""} · {l.seller_email}{l.product ? ` · «${l.product}»` : ""}{l.detail?.motivo ? ` · ${l.detail.motivo}` : ""}</span>
            <span className="text-zinc-500">{new Date(l.created_at).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </li>
        ))}
        {rows && !rows.length && <li className="p-6 text-center text-sm text-zinc-500">Todavía no hiciste cambios.</li>}
      </ul>
    </>
  );
}

const KIND = { producto: "Publicación", vendedor: "Vendedor", resena: "Reseña" };

function Denuncias({ onChange }) {
  const [status, setStatus] = useState("nuevo");
  const [rows, setRows] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { setRows(null); supabase.rpc("admin_reports", { p_status: status }).then(({ data }) => setRows(data || [])); }, [status, tick]);
  const reload = () => { setTick((t) => t + 1); onChange?.(); };
  const close = async (r, st) => { await supabase.rpc("admin_report_close", { p_kind: r.kind, p_target: r.target, p_status: st }); reload(); };
  const product = async (r, action) => {
    const reason = action === "pausar" ? window.prompt(`¿Por qué pausás «${r.product_title}»? (queda en el registro)`, "Denuncia") : "";
    if (reason === null) return;
    await supabase.rpc("admin_product_action", { p_product: r.target, p_action: action, p_reason: reason }); reload();
  };
  const review = async (r, hide) => { await supabase.rpc("admin_review_action", { p_review: r.target, p_hide: hide }); reload(); };
  const suspend = async (r) => {
    if (!window.confirm(`¿Suspender a ${r.seller_name}? Sus publicaciones dejan de recibir ofertas y pedidos.`)) return;
    await supabase.rpc("admin_seller_action", { p_seller: r.seller_id, p_action: "estado", p_value: "suspendida" }); reload();
  };
  const btn = "rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1";
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Denuncias</h1>
      <p className="text-sm text-zinc-500">Con 3 denuncias de personas distintas, una publicación se pausa sola y una reseña se oculta, hasta que la revises.</p>
      <div className="mt-3 flex gap-1">
        {[["nuevo", "Para revisar"], ["resuelto", "Resueltas"], ["descartado", "Descartadas"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={`rounded-xl px-3 py-1.5 text-[13px] font-semibold ${status === k ? "bg-ink text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}>{l}</button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {rows?.map((r) => (
          <div key={r.kind + r.target} className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-bold uppercase tracking-wide text-zinc-500">{KIND[r.kind]} · {r.n} {r.n === 1 ? "denuncia" : "denuncias"}</p>
              {r.auto_action && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">{r.auto_action === "pausada" ? "Pausada sola" : "Oculta sola"}</span>}
            </div>
            {r.kind === "producto" && (
              <div className="mt-2 flex gap-3">
                {r.product_photo ? <img src={r.product_photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : null}
                <div className="min-w-0"><a href={`/${r.seller_slug}/${r.product_slug}`} target="_blank" rel="noreferrer" className="text-[15px] font-semibold hover:underline">{r.product_title}</a>
                  <p className="text-[12px] text-zinc-500">de <a href={`/${r.seller_slug}`} target="_blank" rel="noreferrer" className="underline">{r.seller_name}</a>{r.product_moderation === "pausada" ? " · pausada" : ""}</p></div>
              </div>
            )}
            {r.kind === "vendedor" && <p className="mt-2 text-[15px] font-semibold"><a href={`/${r.seller_slug}`} target="_blank" rel="noreferrer" className="hover:underline">{r.seller_name}</a> <span className="text-[12px] font-normal text-zinc-500">· {STATUS[r.seller_status] || r.seller_status}</span></p>}
            {r.kind === "resena" && (
              <div className="mt-2 text-[14px]"><p><b>{r.review_by}</b> · {r.review_stars}★ sobre <a href={`/${r.seller_slug}`} target="_blank" rel="noreferrer" className="underline">{r.seller_name}</a>{r.review_hidden ? " · oculta" : ""}</p>
                {r.review_comment && <p className="mt-0.5 text-zinc-700">«{r.review_comment}»</p>}</div>
            )}
            <ul className="mt-2 space-y-1 text-[13px]">
              {r.items.slice(0, 5).map((i) => <li key={i.id} className="rounded-lg bg-zinc-50 px-2 py-1"><b>{REASON[i.reason]}</b>{i.detail ? ` · ${i.detail}` : ""} <span className="text-zinc-400">· {date(i.created_at)}</span></li>)}
            </ul>
            {status === "nuevo" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.kind === "producto" && (r.product_moderation === "pausada"
                  ? <button onClick={() => product(r, "liberar")} className={`${btn} text-emerald-700 ring-emerald-200`}>Liberar publicación</button>
                  : <button onClick={() => product(r, "pausar")} className={`${btn} text-rose-700 ring-rose-200`}>Pausar publicación</button>)}
                {r.kind === "resena" && (r.review_hidden
                  ? <button onClick={() => review(r, false)} className={`${btn} text-emerald-700 ring-emerald-200`}>Volver a mostrar</button>
                  : <button onClick={() => review(r, true)} className={`${btn} text-rose-700 ring-rose-200`}>Ocultar reseña</button>)}
                {r.seller_status !== "suspendida" && <button onClick={() => suspend(r)} className={`${btn} text-rose-700 ring-rose-200`}>Suspender vendedor</button>}
                <button onClick={() => close(r, "resuelto")} className={`${btn} bg-ink text-white ring-ink`}>Listo, resuelta</button>
                <button onClick={() => close(r, "descartado")} className={`${btn} text-zinc-600 ring-zinc-300`}>Descartar</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {rows && !rows.length && <p className="mt-6 rounded-2xl bg-white p-6 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">{status === "nuevo" ? "No hay denuncias para revisar. 🎉" : "Nada por acá."}</p>}
      {!rows && <p className="mt-4 text-sm text-zinc-500">Cargando…</p>}
    </>
  );
}

function Resenas() {
  const [rows, setRows] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { supabase.rpc("admin_reviews").then(({ data }) => setRows(data || [])); }, [tick]);
  const toggle = async (r) => { await supabase.rpc("admin_review_action", { p_review: r.id, p_hide: !r.hidden }); setTick((t) => t + 1); };
  return (
    <>
      <h1 className="font-display text-2xl font-extrabold">Reseñas</h1>
      <p className="text-sm text-zinc-500">Las últimas 200. Si ocultás una, deja de verse y no cuenta en el promedio.</p>
      <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-white ring-1 ring-zinc-200">
        {rows?.map((r) => (
          <li key={r.id} className={`flex flex-wrap items-start justify-between gap-2 p-3 text-[13px] ${r.hidden ? "opacity-60" : ""}`}>
            <span className="min-w-0 flex-1"><b>{r.buyer_name}</b> · {r.stars}★ → <a href={`/${r.seller_slug}`} target="_blank" rel="noreferrer" className="underline">{r.seller_name}</a>{r.product_title ? ` · ${r.product_title}` : ""} <span className="text-zinc-400">· {date(r.created_at)}</span>
              {r.comment && <span className="mt-0.5 block text-zinc-700">«{r.comment}»</span>}</span>
            <button onClick={() => toggle(r)} className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ring-1 ${r.hidden ? "text-emerald-700 ring-emerald-200" : "text-rose-700 ring-rose-200"}`}>{r.hidden ? "Mostrar" : "Ocultar"}</button>
          </li>
        ))}
        {rows && !rows.length && <li className="p-6 text-center text-sm text-zinc-500">Todavía no hay reseñas.</li>}
      </ul>
    </>
  );
}
