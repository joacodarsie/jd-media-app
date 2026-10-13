/**
 * Las tareas de cada mes de los servicios que se venden aparte (12/10/2026).
 *
 * Pedido del dueño: la gestión de WhatsApp la da Santi y Google Ads lo lleva
 * Guille, y no había nada que les recordara hacerlo ni forma de seguirlo. Ahora
 * cada cuenta que tiene el servicio genera su tarea del mes (vence el 10), y la
 * dirección ve en la tarjeta de cada uno cuántas hizo.
 *
 * Mismo mecanismo que las rutinas del mes: `rutina_key` única por período y
 * cuenta, así correrlo todos los días no duplica.
 *
 * Puro: entra el período, las cuentas con servicio y quién lo da.
 */
import type { TareaRutina } from "./rutinas-mensuales";

export type ServicioSeguido = "gestion_whatsapp" | "google_ads";

export const SERVICIOS_SEGUIDOS: Record<
  ServicioSeguido,
  { clave: string; titulo: (cliente: string) => string; area: string; descripcion: string }
> = {
  gestion_whatsapp: {
    clave: "wpp",
    titulo: (c) => `WhatsApp de ${c}: gestión del mes`,
    area: "Comercial",
    descripcion:
      "Lo que el cliente paga como **gestión de WhatsApp**, hecho y a la vista:\n\n- Catálogo, respuestas rápidas, mensaje de bienvenida y de ausencia al día.\n- Etiquetas de los chats ordenadas (nuevo, en conversación, cliente).\n- Una difusión o campaña del mes, si estaba acordada.\n- Un resumen corto para el cliente: qué se hizo y cuántas consultas entraron.\n\nCuando lo terminás, cerrá la tarea: así la dirección ve que se hizo.",
  },
  google_ads: {
    clave: "gads",
    titulo: (c) => `Google Ads de ${c}: revisión del mes`,
    area: "Paid Media",
    descripcion:
      "Lo que el cliente paga como **gestión de Google Ads**, hecho y a la vista:\n\n- Presupuesto gastado contra el acordado.\n- Conversiones (llamadas, formularios, WhatsApp): ¿se están midiendo?\n- Términos de búsqueda: sumar palabras negativas, pausar lo que no rinde.\n- Un resumen corto para el cliente con los números del mes.\n\nCuando lo terminás, cerrá la tarea: así la dirección ve que se hizo.",
  },
};

export interface CuentaConServicio {
  clienteId: string;
  nombre: string;
  tipo: string;
}

/** Día 10 del período; si ya pasó (el mes en que arranca esto), 3 días desde hoy. */
export function vencimientoServicio(periodo: string, hoy: string): string {
  const diez = `${periodo}-10`;
  if (hoy.slice(0, 7) !== periodo || hoy < diez) return diez;
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3);
  return d.toISOString().slice(0, 10);
}

export function rutinasDeServicios(
  periodo: string,
  hoy: string,
  cuentas: CuentaConServicio[],
  responsables: Partial<Record<ServicioSeguido, string | null>>
): TareaRutina[] {
  const out: TareaRutina[] = [];
  const vista = new Set<string>();
  for (const c of cuentas) {
    const def = SERVICIOS_SEGUIDOS[c.tipo as ServicioSeguido];
    const quien = responsables[c.tipo as ServicioSeguido];
    if (!def || !quien) continue;
    const rutina_key = `${periodo}:${def.clave}:${c.clienteId}`;
    if (vista.has(rutina_key)) continue;
    vista.add(rutina_key);
    out.push({
      rutina_key,
      titulo: def.titulo(c.nombre),
      descripcion: def.descripcion,
      area: def.area,
      prioridad: "media",
      asignado_a_id: quien,
      cliente_id: c.clienteId,
      fecha_limite: vencimientoServicio(periodo, hoy),
    });
  }
  return out;
}

/** La clave del servicio de una tarea de rutina ("2026-10:wpp:<id>" → "wpp"). */
export function servicioDeRutina(rutinaKey: string | null | undefined): string | null {
  const partes = (rutinaKey ?? "").split(":");
  return partes.length === 3 && (partes[1] === "wpp" || partes[1] === "gads") ? partes[1] : null;
}
