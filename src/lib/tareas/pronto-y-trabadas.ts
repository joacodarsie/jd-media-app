/**
 * Lo que vence pronto y lo que está trabado (24/10/2026, pedido de Luz):
 * arriba de Tareas, dos bloques para mirar de un vistazo
 *  - qué vence hoy, mañana o en los próximos 3 días;
 *  - qué está frenado esperando una aprobación, a otra persona o al cliente.
 *
 * Módulo PURO: fechas "YYYY-MM-DD" leídas por sus dígitos.
 */

export interface TareaParaMirar {
  id: string;
  titulo: string;
  estado: string;
  fecha_limite: string | null;
  asignado_a_id: string | null;
  aprobador_id?: string | null;
  bloqueo?: "cliente" | "persona" | null;
  bloqueo_quien?: string | null;
  bloqueo_esperando_id?: string | null;
}

const ABIERTAS = new Set(["pendiente", "en_progreso", "en_revision", "bloqueada"]);
const t = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));

export const DIAS_PRONTO = 3;

export function cuandoVence(fecha: string, hoy: string): string {
  const d = Math.round((t(fecha.slice(0, 10)) - t(hoy)) / 86_400_000);
  if (d === 0) return "Vence hoy";
  if (d === 1) return "Vence mañana";
  if (d === 2) return "Vence pasado mañana";
  return `Vence en ${d} días`;
}

/** Las abiertas que vencen de hoy a 3 días, de la más urgente a la menos. */
export function vencenPronto<T extends TareaParaMirar>(tareas: T[], hoy: string): (T & { cuando: string; dias: number })[] {
  return tareas
    .filter((x) => ABIERTAS.has(x.estado) && x.fecha_limite)
    .map((x) => ({ ...x, dias: Math.round((t(x.fecha_limite!.slice(0, 10)) - t(hoy)) / 86_400_000) }))
    .filter((x) => x.dias >= 0 && x.dias <= DIAS_PRONTO)
    .sort((a, b) => a.dias - b.dias || a.titulo.localeCompare(b.titulo))
    .map((x) => ({ ...x, cuando: cuandoVence(x.fecha_limite!, hoy) }));
}

export type Traba = "aprobacion" | "persona" | "cliente";

/** Lo que está frenado y por qué. `nombre` da el nombre de una persona por su id. */
export function trabadas<T extends TareaParaMirar>(tareas: T[], nombre: (id: string) => string | null): (T & { traba: Traba; espera: string })[] {
  const out: (T & { traba: Traba; espera: string })[] = [];
  for (const x of tareas) {
    if (!ABIERTAS.has(x.estado)) continue;
    if (x.bloqueo === "cliente") out.push({ ...x, traba: "cliente", espera: "Espera al cliente" });
    else if (x.bloqueo === "persona") {
      const quien = (x.bloqueo_esperando_id && nombre(x.bloqueo_esperando_id)) || x.bloqueo_quien || "otra persona";
      out.push({ ...x, traba: "persona", espera: `Espera a ${quien}` });
    } else if (x.estado === "en_revision" && x.aprobador_id) {
      out.push({ ...x, traba: "aprobacion", espera: `Lo aprueba ${nombre(x.aprobador_id) ?? "quien aprueba"}` });
    }
  }
  const orden: Record<Traba, number> = { aprobacion: 0, persona: 1, cliente: 2 };
  return out.sort((a, b) => orden[a.traba] - orden[b.traba] || (a.fecha_limite ?? "9").localeCompare(b.fecha_limite ?? "9"));
}
