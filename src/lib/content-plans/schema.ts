/**
 * Plan de contenido mensual / por período.
 *
 * Es la capa operativa que se monta SOBRE el diagnóstico estratégico.
 * Define cadencia, mix por red y por pilar, temas destacados, campañas.
 *
 * Lo consumen:
 *   - El generador IA del Plan
 *   - El editor del Plan
 *   - El "Sugerir con IA" del calendario (para que cada pieza encaje)
 */

export type RedSocial = "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin" | "x";

export type Formato =
  | "reel"
  | "post"
  | "carrusel"
  | "story"
  | "video_largo"
  | "live"
  | "otro";

export type MixRed = {
  red: RedSocial;
  /** Total mensual estimado: ej { reel: 4, post: 2, story: 60 } */
  cadencia: Partial<Record<Formato, number>>;
  /** Notas operativas opcionales para esa red (horarios, particularidades) */
  notas?: string;
};

export type PilarDistribucion = {
  /** Nombre del pilar — debe matchear los pilares del diagnóstico */
  pilar: string;
  /** Peso relativo, 0-100. Sumando los 4 pilares debería dar ~100. */
  porcentaje: number;
  /** Por qué este peso para este mes (relación con objetivos / momento) */
  justificacion: string;
};

export type TemaDestacado = {
  titulo: string;
  descripcion: string;
  /** Fecha clave si aplica (lanzamiento, efeméride, hito) */
  fecha?: string;
  /** Pilar al que pertenece este tema */
  pilar?: string;
};

export type Campana = {
  nombre: string;
  objetivo: string;
  fechas: string; // ej: "del 1 al 8 de mayo"
  piezas_estimadas: number;
  formato_principal: Formato;
  detalle: string;
};

export type MonthlyContentPlan = {
  /** Resumen ejecutivo del mes — 2-4 bullets de lo crítico */
  resumen_mes: string[];

  /** Mix de contenido por red */
  mix_por_red: MixRed[];

  /** Distribución porcentual por pilar (siempre 4 pilares = mismos del diagnóstico) */
  distribucion_pilares: PilarDistribucion[];

  /** Temas destacados del mes — 5-10 ítems concretos para nutrir el calendario */
  temas_destacados: TemaDestacado[];

  /** Campañas / lanzamientos del período */
  campanas: Campana[];

  /** Reglas operativas: horarios, días fijos, restricciones de calendario */
  reglas_operativas: string[];

  /** KPIs específicos de este período (lo que vamos a mirar al final) */
  kpis_objetivo: string[];

  /** Notas finales para el equipo */
  notas?: string;
};

export const EMPTY_PLAN: MonthlyContentPlan = {
  resumen_mes: [],
  mix_por_red: [],
  distribucion_pilares: [],
  temas_destacados: [],
  campanas: [],
  reglas_operativas: [],
  kpis_objetivo: [],
};

export function isPlanShape(value: unknown): value is MonthlyContentPlan {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    "resumen_mes" in v &&
    "mix_por_red" in v &&
    "distribucion_pilares" in v &&
    "temas_destacados" in v &&
    "campanas" in v &&
    "reglas_operativas" in v &&
    "kpis_objetivo" in v
  );
}

export type ContentPlanRow = {
  id: string;
  cliente_id: string;
  periodo_label: string;
  status: "draft" | "active" | "archived";
  content: MonthlyContentPlan;
  generated_with_model: string | null;
  generated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
