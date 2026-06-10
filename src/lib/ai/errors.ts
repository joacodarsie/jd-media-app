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
    return "Hay un problema de configuración con la IA. Avisale al administrador.";
  }

  return "Ocurrió un error al consultar la IA. Probá de nuevo en un momento.";
}
