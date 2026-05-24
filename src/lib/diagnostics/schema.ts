/**
 * Schema del diagnóstico inicial de un cliente.
 *
 * Este tipo describe las 14 secciones del informe — es la fuente de verdad
 * para:
 *   - El generador IA (JSON output debe matchear esto)
 *   - El editor por bloques en /clientes/[id] (cada sección = un bloque)
 *   - El render PDF en /diagnostico/cliente/[id]
 *   - El tool client_brand_context de JDmedIA (consume las secciones)
 *
 * Si agregás o cambiás campos acá, actualizá también:
 *   - El system prompt en src/lib/diagnostics/generate-prompt.ts
 *   - El render en src/app/diagnostico/cliente/[id]/page.tsx
 *   - El editor en src/components/diagnostic-editor.tsx
 */

export type Area =
  | "diseno"
  | "community"
  | "produccion"
  | "paid"
  | "estrategia"
  | "desarrollo"
  | "otro";

export type AudienceSegment = {
  /** Nombre corto del segmento, ej: "Parejas 25-45" */
  nombre: string;
  /** Descripción del perfil (edad, género, ocupación si aplica) */
  perfil: string;
  /** Qué tipo de plan/consumo hace con la marca */
  plan_tipico: string;
  /** Por qué importa este segmento al negocio */
  valor: string;
};

export type Competitor = {
  nombre: string;
  fortalezas: string;
  debilidades: string;
};

export type InspoReference = {
  nombre: string;
  /** Por qué tomarla de referencia — qué hacer parecido */
  que_tomar: string;
};

export type ContentPillar = {
  nombre: string;
  descripcion: string;
  ejemplos: string[];
};

export type ActionItem = {
  /** Título corto, accionable, en imperativo. Ej: "Clarificar bio de Instagram" */
  titulo: string;
  /** Detalle de qué hacer y por qué */
  descripcion: string;
  /** Área responsable sugerida — el botón "Convertir a tareas" la usa */
  area_sugerida: Area;
  /** Prioridad relativa para ordenarlas en el plan */
  prioridad: "alta" | "media" | "baja";
};

export type DiagnosticContent = {
  // 1) Portada — autogenerada desde el cliente y la fecha, no la edita la IA.
  // Vive en el header del PDF; no se guarda acá.

  // 2) Resumen ejecutivo
  resumen_ejecutivo: {
    bullets: string[]; // 3-5 puntos críticos
  };

  // 3) Contexto del negocio
  contexto: {
    que_es: string; // 1 frase
    etapa: "arrancando" | "crecimiento" | "consolidado" | "estancado";
    historia: string;
    brecha_actual: string; // Lo que pasa vs lo que se comunica
  };

  // 4) Modelo de negocio
  modelo_negocio: {
    productos_servicios: { nombre: string; ticket?: string }[];
    modalidad: string; // "venta única", "recurrente", "por proyecto", etc.
    canales_actuales: string[]; // ["Instagram", "WhatsApp", "Web"]
    como_se_vende_hoy: string[]; // ["Recomendación", "Ads", "Walk-in"]
    operativo: {
      quien_atiende: string;
      horarios: string;
    };
  };

  // 5) Público objetivo
  publico_objetivo: {
    segmentos: AudienceSegment[];
    insight_clave: string; // El dolor central del cliente ideal
    anti_publico: string; // Quién NO quieren atraer
  };

  // 6) Marca e identidad
  marca: {
    personalidad: string[]; // ["Cercana", "Profesional", "Moderna"]
    percepcion_deseada: string;
    estado_manual: {
      logo: boolean;
      colores: boolean;
      tipografias: boolean;
      observaciones?: string;
    };
    tono_voz: {
      registro: "formal" | "informal" | "mixto";
      humor: boolean;
      frases_representativas: string[];
    };
  };

  // 7) Diferencial competitivo
  diferenciales: {
    titulo: string;
    descripcion: string;
  }[];

  // 8) Problemas detectados
  problemas: {
    titulo: string;
    descripcion: string;
    evidencia?: string;
  }[];

  // 9) Competencia y referencias
  competencia_referencias: {
    competidores: Competitor[];
    inspo: InspoReference[];
  };

  // 10) Objetivos del primer trimestre
  objetivos_trimestre: {
    titulo: string;
    descripcion: string;
  }[];

  // 11) Pilares de contenido
  pilares_contenido: ContentPillar[]; // siempre 4

  // 12) Plan de acción
  plan_accion: ActionItem[]; // 8-12 acciones

  // 13) Recursos y limitaciones
  recursos_limitaciones: {
    aporta_cliente: string[]; // banco de fotos, dispuesto a grabar, etc.
    lineas_rojas: string[]; // cosas que NO quieren hacer
  };

  // 14) Próximos pasos
  proximos_pasos: string[];
};

/**
 * Estructura vacía para inicializar un draft nuevo o validar payloads.
 */
export const EMPTY_DIAGNOSTIC: DiagnosticContent = {
  resumen_ejecutivo: { bullets: [] },
  contexto: { que_es: "", etapa: "arrancando", historia: "", brecha_actual: "" },
  modelo_negocio: {
    productos_servicios: [],
    modalidad: "",
    canales_actuales: [],
    como_se_vende_hoy: [],
    operativo: { quien_atiende: "", horarios: "" },
  },
  publico_objetivo: { segmentos: [], insight_clave: "", anti_publico: "" },
  marca: {
    personalidad: [],
    percepcion_deseada: "",
    estado_manual: { logo: false, colores: false, tipografias: false },
    tono_voz: { registro: "mixto", humor: false, frases_representativas: [] },
  },
  diferenciales: [],
  problemas: [],
  competencia_referencias: { competidores: [], inspo: [] },
  objetivos_trimestre: [],
  pilares_contenido: [],
  plan_accion: [],
  recursos_limitaciones: { aporta_cliente: [], lineas_rojas: [] },
  proximos_pasos: [],
};

/**
 * Validación mínima — chequea que las claves top-level existan.
 * El generador IA puede devolver una sección incompleta; la validación
 * estricta queda en el editor.
 */
export function isDiagnosticShape(value: unknown): value is DiagnosticContent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    "resumen_ejecutivo" in v &&
    "contexto" in v &&
    "modelo_negocio" in v &&
    "publico_objetivo" in v &&
    "marca" in v &&
    "diferenciales" in v &&
    "problemas" in v &&
    "competencia_referencias" in v &&
    "objetivos_trimestre" in v &&
    "pilares_contenido" in v &&
    "plan_accion" in v &&
    "recursos_limitaciones" in v &&
    "proximos_pasos" in v
  );
}

export type DiagnosticRow = {
  id: string;
  cliente_id: string;
  version: number;
  status: "draft" | "approved" | "archived";
  content: DiagnosticContent;
  transcript_text: string | null;
  source_pdf_path: string | null;
  generated_with_model: string | null;
  generated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  tasks_created_at: string | null;
  tasks_created_count: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
