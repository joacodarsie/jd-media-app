/**
 * La tarea de mandar la encuesta del mes (19/10/2026, pedido del dueño: «nunca
 * la envié, podría ser una tarea»). Una por mes, a la PM, desde el día 15: la
 * lista de cuentas que todavía no contestaron. Se cierra sola cuando contestan
 * todas. El portal también la pide (encuesta-portal.ts); esto es el empujón.
 */
import { pedirEncuestaEnPortal } from "./encuesta-portal";

export interface CuentaEncuesta {
  id: string;
  nombre: string;
  fechaInicio: string | null;
}

/** Las cuentas a las que hay que pedirle la encuesta este mes. */
export function faltanEncuesta(cuentas: CuentaEncuesta[], respondieron: Set<string>, hoy: string): CuentaEncuesta[] {
  return cuentas.filter((c) => pedirEncuestaEnPortal({ fechaInicio: c.fechaInicio, hoy, yaRespondio: respondieron.has(c.id) }));
}

export function tareaEncuesta(periodoLabel: string, faltan: CuentaEncuesta[]): { titulo: string; descripcion: string } {
  return {
    titulo: `📝 Mandar la encuesta de ${periodoLabel}`,
    descripcion: [
      `Pedirle a cada cuenta que nos puntúe el mes. Son 3 preguntas y menos de un minuto.`,
      "",
      "**Paso a paso:** Clientes → **Calidad del mes** → en cada cuenta, el botón de WhatsApp ya trae el mensaje con su link. Mandalo y listo.",
      "",
      `**Faltan (${faltan.length}):** ${faltan.map((c) => c.nombre).join(", ")}.`,
      "",
      "**Quién lo hace:** la project manager.",
      "**Está hecho cuando:** contestaron todas. Se cierra sola; mientras, el portal de cada cliente también se la pide.",
    ].join("\n"),
  };
}
