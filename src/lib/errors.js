// Traduce errores de la base a mensajes simples.
export function friendlyDbError(error) {
  const m = error?.message || "";
  if (m.includes("DEMO:")) return m.slice(m.indexOf("DEMO:") + 5).trim() + " Creá tu cuenta gratis para probarlo con tus cosas.";
  if (m.includes("PLAN_INACTIVO")) return "Tu plan venció. Pagalo en «Mi cuenta» y vas a poder publicar de nuevo.";
  if (m.includes("PASE_PAGO")) return "Ya usaste tus 2 publicaciones gratis. Comprá un pase de $5.000 en «Mi cuenta», o pasate al Básico ($10.000/mes, sin límite).";
  if (m.includes("LIMITE_PASE")) return "Con el pase tenés una sola publicación activa. Pausá la otra o pasate al plan Básico.";
  if (m.includes("SIN_PERFIL")) return "Completá tu nombre y tu link antes de publicar.";
  if (m.includes("mínimo no puede ser mayor")) return "Lo mínimo que aceptás no puede ser más que el precio publicado.";
  if (m.includes("SOLO_PRECIO_FIJO")) return "En la tienda los productos van a precio fijo.";
  if (m.includes("SOLO_TIENDA")) return "El precio fijo con talles y colores es del plan Tienda.";
  if (m.includes("FALTA_MINIMO")) return "Poné lo mínimo que aceptás.";
  if (error?.code === "23505") return "Ya existe algo con ese nombre. Probá con otro.";
  if (error?.code === "23514") return "Revisá los datos: hay algún valor que no es válido.";
  return "No pudimos guardar. Revisá tu conexión y probá de nuevo.";
}
