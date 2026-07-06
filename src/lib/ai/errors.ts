/**
 * Traduce errores de la API de IA (Anthropic) a mensajes amables para mostrar
 * al equipo, sin filtrar el JSON crudo ni el request_id. El detalle técnico se
 * deja en console.error en el route para debug.
 */
export function friendlyAiError(err: unknown): string {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status?: unknown }).status)
      : undefined;
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();

  // Sin crédito / problema de facturación en la cuenta de IA.
  if (
    msg.includes("credit balance is too low") ||
    msg.includes("billing") ||
    msg.includes("plans & billing")
  ) {
    return "El asistente de IA no está disponible por un tema de la cuenta de IA (crédito agotado). Avisale al administrador para que recargue saldo.";
  }

  // Límite de uso / sobrecarga temporal.
  if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "La IA está recibiendo muchas consultas en este momento. Esperá unos segundos y probá de nuevo.";
  }
  if (status === 529 || msg.includes("overloaded")) {
    return "El servicio de IA está sobrecargado por un momento. Probá de nuevo en unos segundos.";
  }

  // Credencial faltante/ inválida (config del servidor).
  if (status === 401 || msg.includes("authentication") || msg.includes("api key")) {
    return "Hay un problema de configuración con la IA (credencial). Avisale al administrador para revisar la API key.";
  }

  // Modelo no encontrado / sin acceso para la cuenta.
  if (status === 404 || msg.includes("not_found") || msg.includes("model:")) {
    return "El modelo de IA no está disponible para la cuenta. Avisale al administrador para revisar el acceso al modelo.";
  }

  // Permiso denegado (403): normalmente facturación/permiso de la cuenta.
  if (status === 403 || msg.includes("permission")) {
    return "La cuenta de IA no tiene permiso para esta operación (revisá facturación o permisos). Avisale al administrador.";
  }

  // Request inválido (400): parámetro/config no soportada por el modelo (p. ej.
  // thinking en un modelo que no lo admite). No es transitorio: hay que revisar
  // el código, no reintentar.
  if (status === 400 || msg.includes("invalid_request") || msg.includes("bad request")) {
    return "Hay un problema de configuración con la IA (la consulta no es válida para el modelo). Avisale al administrador.";
  }

  return "Ocurrió un error al consultar la IA. Probá de nuevo en un momento.";
}
