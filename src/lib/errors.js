// Traduce errores de la base a mensajes simples.
export function friendlyDbError(error) {
  const m = error?.message || "";
  if (m.includes("PLAN_INACTIVO")) return "Tu plan no está activo. Renovalo para publicar.";
  if (m.includes("LIMITE_PASE")) return "Con el pase tenés una sola publicación activa. Pausá la otra o pasate al plan Básico.";
  if (m.includes("SIN_PERFIL")) return "Completá tu nombre y tu link antes de publicar.";
  if (m.includes("mínimo no puede ser mayor")) return "Lo mínimo que aceptás no puede ser más que el precio publicado.";
  if (error?.code === "23505") return "Ya existe algo con ese nombre. Probá con otro.";
  if (error?.code === "23514") return "Revisá los datos: hay algún valor que no es válido.";
  return "No pudimos guardar. Revisá tu conexión y probá de nuevo.";
}
