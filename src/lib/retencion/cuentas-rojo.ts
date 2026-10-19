/**
 * Cuentas en rojo (19/10/2026): el semáforo de salud ya existía en /director,
 * pero nadie lo miraba. Ahora cada cuenta en rojo le genera una tarea a su
 * responsable, con lo que la puso en rojo, y se cierra sola cuando sale.
 */
export const PREFIJO_ROJO = "🚦";
/** Cuántas tareas a la vez: las cuentas más en riesgo, no todas las rojas. */
export const MAX_TAREAS_ROJO = 3;

export function claveRojo(clienteId: string, periodo: string): string {
  return `rojo:${clienteId}:${periodo}`;
}

export function tareaRojo(nombre: string, alertas: string[]): { titulo: string; descripcion: string } {
  return {
    titulo: `${PREFIJO_ROJO} ${nombre} está en rojo`,
    descripcion: [
      `**${nombre}** es de las 3 cuentas más en riesgo según el semáforo de salud: es el tipo de cuenta que se nos va si nadie hace nada.`,
      "",
      "**Por qué está en rojo:**",
      ...alertas.map((a) => `- ${a}`),
      "",
      "**Qué hacer:** resolvé lo de arriba empezando por lo que más le duele al cliente. Si hace falta, llamalo esta semana.",
      "",
      "**Quién lo hace:** el responsable de la cuenta; la project manager ayuda a destrabar.",
      "**Está hecho cuando:** la cuenta sale del rojo. Se cierra sola; el detalle está en Director → Salud de cuentas.",
    ].join("\n"),
  };
}
