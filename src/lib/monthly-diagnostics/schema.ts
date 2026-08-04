/**
 * Schema del diagnóstico MENSUAL de un cliente.
 *
 * Sale de la reunión de fin de mes: se carga la transcripción y la IA arma la
 * foto de cómo está la marca ese mes. Es un documento INTERNO (tiene riesgo de
 * churn y oportunidades de venta) — no se le manda al cliente.
 *
 * Es a propósito MÁS CORTO que el diagnóstico inicial (14 secciones): esto se
 * lee de arriba abajo en dos minutos antes de arrancar el mes siguiente.
 *
 * Si cambiás campos acá, actualizá también:
 *   - El tool schema en src/lib/monthly-diagnostics/prompt.ts
 *   - El render en src/components/monthly-diagnostic-view.tsx
 */

import type { Area } from "@/lib/diagnostics/schema";

export type Semaforo = "bien" | "atencion" | "riesgo";
export type Nivel = "alto" | "medio" | "bajo";
export type Prioridad = "alta" | "media" | "baja";

export type PuntoConCausa = {
  /** Qué pasó, en una línea. Ej: "Los reels de detrás de escena" */
  que: string;
  /** Por qué creemos que pasó — la lectura, no la descripción. */
  por_que: string;
};

export type Frustracion = {
  titulo: string;
  detalle: string;
  gravedad: Prioridad;
  /** true si esto ya había aparecido en el diagnóstico del mes anterior. */
  ya_venia_del_mes_pasado?: boolean;
};

export type Necesidad = {
  titulo: string;
  detalle: string;
  area_sugerida: Area;
  /** true si se puede resolver con más servicio (upsell honesto). */
  oportunidad_venta?: boolean;
};

export type AccionMes = {
  /** Título corto en imperativo. Ej: "Rehacer los destacados de la cuenta" */
  titulo: string;
  descripcion: string;
  area_sugerida: Area;
  prioridad: Prioridad;
};

export type MonthlyDiagnosticContent = {
  /** Estado general de la cuenta este mes — pinta el semáforo de la card. */
  semaforo: Semaforo;

  /** 3-4 bullets: si leés solo esto, ya sabés cómo viene la cuenta. */
  resumen: string[];

  /** Cómo le fue AL NEGOCIO del cliente (no a nuestras métricas). */
  negocio_del_cliente: {
    /** Qué contó sobre ventas/consultas/facturación. "" si no lo mencionó. */
    como_le_fue: string;
    /** Hitos del mes: aperturas, lanzamientos, temporada, problemas. */
    hitos: string[];
    /** Qué se le viene el mes que sigue y deberíamos acompañar. */
    lo_que_se_viene: string[];
  };

  /** Qué funcionó este mes y por qué. */
  funciono: PuntoConCausa[];

  /** Qué no funcionó y por qué. Sin excusas. */
  no_funciono: PuntoConCausa[];

  /** Lo que le molesta / lo que no está conforme. El oro de la reunión. */
  frustraciones: Frustracion[];

  /** Lo que pidió o necesita, explícito o entre líneas. */
  necesidades: Necesidad[];

  /** ¿Cambió a quién le habla la marca? */
  publico_objetivo: {
    hubo_cambio: boolean;
    /** Qué cambió y por qué. "" si no hubo cambio. */
    detalle: string;
    /** El público al que hay que apuntar de acá en adelante. */
    publico_actual: string;
  };

  /** Lo que aprendimos NOSOTROS de esta cuenta este mes. */
  aprendizajes: string[];

  /** Qué cambiamos en la estrategia a partir de todo esto. */
  ajustes_estrategia: PuntoConCausa[];

  /** Riesgo de que se vaya el cliente. */
  riesgo: {
    nivel: Nivel;
    señales: string[];
  };

  /** Acciones concretas para el mes que viene → botón "Pasar a tareas". */
  acciones_proximo_mes: AccionMes[];

  /** Frases literales del cliente que valen más que el resumen. */
  citas_del_cliente: string[];
};

export const EMPTY_MONTHLY_DIAGNOSTIC: MonthlyDiagnosticContent = {
  semaforo: "atencion",
  resumen: [],
  negocio_del_cliente: { como_le_fue: "", hitos: [], lo_que_se_viene: [] },
  funciono: [],
  no_funciono: [],
  frustraciones: [],
  necesidades: [],
  publico_objetivo: { hubo_cambio: false, detalle: "", publico_actual: "" },
  aprendizajes: [],
  ajustes_estrategia: [],
  riesgo: { nivel: "bajo", señales: [] },
  acciones_proximo_mes: [],
  citas_del_cliente: [],
};

const SEMAFOROS: Semaforo[] = ["bien", "atencion", "riesgo"];
const NIVELES: Nivel[] = ["alto", "medio", "bajo"];

/**
 * Sanea lo que devolvió la IA antes de persistirlo.
 *
 * Mismo problema que en el diagnóstico inicial: el modelo a veces serializa los
 * subobjetos como STRINGS de JSON. Además acá forzamos que todo array sea array
 * y que los enums caigan en un valor válido, así el render nunca rompe.
 */
export function normalizeMonthlyDiagnostic(value: unknown): MonthlyDiagnosticContent {
  const v =
    value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};

  const tryParse = (s: string): unknown | null => {
    const attempt = (t: string): unknown | null => {
      try {
        return JSON.parse(t);
      } catch {
        return null;
      }
    };
    const direct = attempt(s);
    if (direct !== null) return direct;
    const starts = [s.indexOf("{"), s.indexOf("[")].filter((i) => i >= 0);
    const start = starts.length ? Math.min(...starts) : -1;
    const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (start >= 0 && end > start) return attempt(s.slice(start, end + 1));
    return null;
  };

  const asObject = (key: string): Record<string, unknown> => {
    let cur = v[key];
    if (typeof cur === "string") cur = tryParse(cur) ?? undefined;
    return cur && typeof cur === "object" && !Array.isArray(cur)
      ? (cur as Record<string, unknown>)
      : {};
  };

  const asArray = (key: string): unknown[] => {
    let cur = v[key];
    if (typeof cur === "string") cur = tryParse(cur) ?? undefined;
    return Array.isArray(cur) ? cur : [];
  };

  const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
  const strList = (arr: unknown[]): string[] =>
    arr.map(str).filter((s) => s.length > 0);

  const puntos = (arr: unknown[]): PuntoConCausa[] =>
    arr
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({ que: str(x.que), por_que: str(x.por_que) }))
      .filter((p) => p.que.length > 0);

  const prioridad = (x: unknown): Prioridad => {
    const s = str(x).toLowerCase();
    return s === "alta" || s === "baja" ? s : "media";
  };

  const area = (x: unknown): Area => {
    const s = str(x).toLowerCase();
    const ok: Area[] = [
      "diseno",
      "community",
      "produccion",
      "paid",
      "estrategia",
      "desarrollo",
      "otro",
    ];
    return (ok as string[]).includes(s) ? (s as Area) : "otro";
  };

  const negocio = asObject("negocio_del_cliente");
  const publico = asObject("publico_objetivo");
  const riesgo = asObject("riesgo");

  const semaforo = str(v.semaforo).toLowerCase();
  const nivel = str(riesgo.nivel).toLowerCase();

  return {
    semaforo: (SEMAFOROS as string[]).includes(semaforo)
      ? (semaforo as Semaforo)
      : "atencion",
    resumen: strList(asArray("resumen")),
    negocio_del_cliente: {
      como_le_fue: str(negocio.como_le_fue),
      hitos: strList(Array.isArray(negocio.hitos) ? negocio.hitos : []),
      lo_que_se_viene: strList(
        Array.isArray(negocio.lo_que_se_viene) ? negocio.lo_que_se_viene : []
      ),
    },
    funciono: puntos(asArray("funciono")),
    no_funciono: puntos(asArray("no_funciono")),
    frustraciones: asArray("frustraciones")
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        titulo: str(x.titulo),
        detalle: str(x.detalle),
        gravedad: prioridad(x.gravedad),
        ya_venia_del_mes_pasado: x.ya_venia_del_mes_pasado === true,
      }))
      .filter((f) => f.titulo.length > 0),
    necesidades: asArray("necesidades")
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        titulo: str(x.titulo),
        detalle: str(x.detalle),
        area_sugerida: area(x.area_sugerida),
        oportunidad_venta: x.oportunidad_venta === true,
      }))
      .filter((n) => n.titulo.length > 0),
    publico_objetivo: {
      hubo_cambio: publico.hubo_cambio === true,
      detalle: str(publico.detalle),
      publico_actual: str(publico.publico_actual),
    },
    aprendizajes: strList(asArray("aprendizajes")),
    ajustes_estrategia: puntos(asArray("ajustes_estrategia")),
    riesgo: {
      nivel: (NIVELES as string[]).includes(nivel) ? (nivel as Nivel) : "bajo",
      señales: strList(
        Array.isArray(riesgo.señales)
          ? riesgo.señales
          : Array.isArray(riesgo.senales)
            ? (riesgo.senales as unknown[])
            : []
      ),
    },
    acciones_proximo_mes: asArray("acciones_proximo_mes")
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x) => ({
        titulo: str(x.titulo),
        descripcion: str(x.descripcion),
        area_sugerida: area(x.area_sugerida),
        prioridad: prioridad(x.prioridad),
      }))
      .filter((a) => a.titulo.length > 0),
    citas_del_cliente: strList(asArray("citas_del_cliente")),
  };
}

/**
 * ── Informe para el cliente ────────────────────────────────────────────────
 *
 * La versión AMIGABLE del diagnóstico: la que se le manda. Sale del mismo
 * análisis, pero redactada para él y sin nada interno (riesgo de que se vaya,
 * oportunidades de venta, frustraciones catalogadas por gravedad).
 *
 * Se genera sola junto al diagnóstico y vive en la columna `client_report`.
 */

export type ReportBlock = {
  titulo: string;
  detalle: string;
};

export type ClientMonthlyReport = {
  /** Titular del mes, en lenguaje de marca. Ej: "El mes en que la cuenta encontró su voz" */
  titular: string;
  /** 2-3 frases de apertura, cálidas y concretas. */
  apertura: string;
  /** Los números que vale la pena mostrar. Vacío si no hay datos. */
  numeros: { valor: string; etiqueta: string; detalle?: string }[];
  /** Qué se logró este mes. */
  logros: ReportBlock[];
  /** Qué aprendimos sobre lo que le funciona a SU marca. */
  aprendimos: ReportBlock[];
  /** Lo que él planteó en la reunión, devuelto en positivo. */
  te_escuchamos: string[];
  /** Qué vamos a hacer el mes que viene. */
  proximo_mes: ReportBlock[];
  /** Cierre corto. */
  cierre: string;
};

export const EMPTY_CLIENT_REPORT: ClientMonthlyReport = {
  titular: "",
  apertura: "",
  numeros: [],
  logros: [],
  aprendimos: [],
  te_escuchamos: [],
  proximo_mes: [],
  cierre: "",
};

/**
 * Sanea el informe del cliente. Mismo criterio defensivo que el diagnóstico:
 * esto lo VE EL CLIENTE, así que un campo roto no puede romper la página ni
 * mostrar basura.
 */
export function normalizeClientReport(value: unknown): ClientMonthlyReport {
  const v =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
  const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
  const objs = (x: unknown): Record<string, unknown>[] =>
    arr(x).filter((i): i is Record<string, unknown> => !!i && typeof i === "object");

  return {
    titular: str(v.titular),
    apertura: str(v.apertura),
    numeros: objs(v.numeros)
      .map((n) => ({
        valor: str(n.valor),
        etiqueta: str(n.etiqueta),
        detalle: str(n.detalle) || undefined,
      }))
      .filter((n) => n.valor.length > 0 && n.etiqueta.length > 0),
    logros: objs(v.logros)
      .map((b) => ({ titulo: str(b.titulo), detalle: str(b.detalle) }))
      .filter((b) => b.titulo.length > 0),
    aprendimos: objs(v.aprendimos)
      .map((b) => ({ titulo: str(b.titulo), detalle: str(b.detalle) }))
      .filter((b) => b.titulo.length > 0),
    te_escuchamos: arr(v.te_escuchamos).map(str).filter((s) => s.length > 0),
    proximo_mes: objs(v.proximo_mes)
      .map((b) => ({ titulo: str(b.titulo), detalle: str(b.detalle) }))
      .filter((b) => b.titulo.length > 0),
    cierre: str(v.cierre),
  };
}

/** ¿Hay un informe del cliente con contenido de verdad? */
export function hasClientReport(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const r = normalizeClientReport(value);
  return (
    r.titular.length > 0 ||
    r.logros.length > 0 ||
    r.proximo_mes.length > 0
  );
}

/** ¿El JSON guardado tiene contenido real o es un `{}` vacío? */
export function hasMonthlyContent(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const c = content as Record<string, unknown>;
  return "resumen" in c || "funciono" in c || "frustraciones" in c;
}

export const SEMAFORO_LABEL: Record<Semaforo, string> = {
  bien: "Va bien",
  atencion: "Para prestar atención",
  riesgo: "En riesgo",
};

export type MonthlyDiagnosticRow = {
  id: string;
  cliente_id: string;
  periodo: string;
  content: MonthlyDiagnosticContent;
  transcript_text: string | null;
  source_pdf_path: string | null;
  generated_with_model: string | null;
  generated_at: string | null;
  tasks_created_at: string | null;
  tasks_created_count: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Período que se está cerrando cuando abrís la reunión.
 *
 * La reunión de fin de mes se hace o los últimos días del mes o los primeros
 * del siguiente. Si estamos antes del día 10, el mes del que se habla es el
 * anterior; si no, el que está corriendo.
 */
export function periodoDeReunion(hoyYmd: string): string {
  const dia = Number(hoyYmd.slice(8, 10));
  const [y, m] = hoyYmd.slice(0, 7).split("-").map(Number);
  if (dia >= 10) return `${y}-${String(m).padStart(2, "0")}`;
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}
