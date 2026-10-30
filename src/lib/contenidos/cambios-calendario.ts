/**
 * Registro de cambios del calendario (30/10/2026, migración 0224): cómo se
 * cuenta una línea del historial y el resumen del mes. Todo puro, para
 * probarlo sin base.
 */

export interface CambioPieza {
  campo: "fecha" | "estado";
  antes: string | null;
  despues: string | null;
  dias: number | null;
  tarde: boolean;
  created_at: string;
  user_id: string | null;
  cliente_id?: string | null;
}

const ETAPA: Record<string, string> = {
  idea: "Idea",
  en_diseno: "En diseño",
  guion: "Guion",
  edicion: "En edición",
  revision_creativa: "Revisión creativa",
  revision_cliente: "Revisión del cliente",
  aprobado: "Programado",
  publicado: "Publicado",
  rechazado: "Con correcciones",
};

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fechaCorta(v: string | null): string {
  if (!v) return "sin fecha";
  const [d] = v.split(" ");
  const [y, m, dd] = d.split("-").map(Number);
  const dia = DIAS[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return `${dia} ${dd}/${m}`;
}

/** «Movió la fecha: jue 30/10 → lun 3/11 (+4 días)» o «Pasó a Revisión creativa». */
export function textoCambio(c: CambioPieza): string {
  if (c.campo === "fecha") {
    const corr = c.dias == null || c.dias === 0 ? "" : ` (${c.dias > 0 ? "+" : ""}${c.dias} día${Math.abs(c.dias) === 1 ? "" : "s"})`;
    return `Movió la fecha: ${fechaCorta(c.antes)} → ${fechaCorta(c.despues)}${corr}`;
  }
  return `Pasó de ${ETAPA[c.antes ?? ""] ?? c.antes ?? "—"} a ${ETAPA[c.despues ?? ""] ?? c.despues ?? "—"}`;
}

export interface ResumenCambios {
  /** Piezas distintas que se corrieron para más tarde. */
  corridas: number;
  /** Días sumados de todos los corrimientos para más tarde. */
  diasCorridos: number;
  /** Cambios de fecha a menos de 48 h o con la fecha pasada. */
  ultimoMomento: number;
  totalCambiosFecha: number;
  /** Cuentas con más corrimientos, de más a menos. */
  porCuenta: { id: string; veces: number }[];
  /** Personas que más corren fechas, de más a menos (sin las automáticas). */
  porPersona: { id: string; veces: number }[];
}

export function resumirCambios(cambios: (CambioPieza & { publication_id: string })[]): ResumenCambios {
  const fechas = cambios.filter((c) => c.campo === "fecha");
  const tarde = fechas.filter((c) => (c.dias ?? 0) > 0);
  const contar = (ids: (string | null | undefined)[]) => {
    const m = new Map<string, number>();
    for (const id of ids) if (id) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m.entries()].map(([id, veces]) => ({ id, veces })).sort((a, b) => b.veces - a.veces);
  };
  return {
    corridas: new Set(tarde.map((c) => c.publication_id)).size,
    diasCorridos: tarde.reduce((n, c) => n + (c.dias ?? 0), 0),
    ultimoMomento: fechas.filter((c) => c.tarde).length,
    totalCambiosFecha: fechas.length,
    porCuenta: contar(tarde.map((c) => c.cliente_id)),
    porPersona: contar(tarde.map((c) => c.user_id)),
  };
}
