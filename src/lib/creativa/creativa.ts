/**
 * Área Creativa (23/10/2026). Pedido de Santi: un lugar propio de la dirección
 * creativa, distinto de Tareas, donde ver todas sus cuentas —si el calendario
 * de cada mes está aprobado— y cargar por cliente los documentos de campaña,
 * que valen por un tiempo y avisan antes de vencer para replantear la
 * estrategia. Más el onboarding creativo de cada cuenta nueva.
 *
 * Puro: fechas, estados y el progreso del onboarding.
 */

export const ENTREGABLES = {
  plataforma_campana: { label: "Plataforma de campaña", emoji: "🧭", ayuda: "El documento donde se escribe todo: concepto, mensajes, públicos y objetivos." },
  estrategia_redes: { label: "Estrategia de redes", emoji: "📱", ayuda: "Qué rol cumple cada red, formatos, frecuencia y líneas de contenido." },
  documento_tecnico: { label: "Documento técnico", emoji: "🛠️", ayuda: "Lo operativo: specs, tiempos, accesos, herramientas y responsables." },
  otro: { label: "Otro documento", emoji: "📄", ayuda: "Cualquier otro documento de la campaña." },
} as const;
export type Entregable = keyof typeof ENTREGABLES;
export const ENTREGABLES_ONBOARDING: Entregable[] = ["plataforma_campana", "estrategia_redes", "documento_tecnico"];

/** Avisa con esta anticipación que hay que replantear. */
export const AVISO_DIAS = 7;

export const MEDIOS = [
  { clave: "instagram", label: "Instagram" },
  { clave: "tiktok", label: "TikTok" },
  { clave: "facebook", label: "Facebook" },
  { clave: "whatsapp", label: "WhatsApp" },
  { clave: "pauta", label: "Publicidad (Meta Ads)" },
  { clave: "web", label: "Web / tienda online" },
] as const;
export type NivelMedio = "alta" | "media" | "baja" | "no";
export const NIVELES: { valor: NivelMedio; label: string }[] = [
  { valor: "alta", label: "Alta" },
  { valor: "media", label: "Media" },
  { valor: "baja", label: "Baja" },
  { valor: "no", label: "No usa" },
];

export const URGENCIAS = {
  urgente: { label: "Urgente: necesita vender ya", emoji: "🔥" },
  crecer: { label: "Crecer: sumar clientes de a poco", emoji: "📈" },
  marca: { label: "Marca: construir a largo plazo", emoji: "🌱" },
} as const;
export type Urgencia = keyof typeof URGENCIAS;

const diaUtc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const sumarDias = (ymd: string, n: number) => new Date(diaUtc(ymd) + n * 86_400_000).toISOString().slice(0, 10);

export type EstadoVigencia = "vigente" | "por_vencer" | "vencido" | "sin_vigencia";

export interface Vigencia {
  vence: string | null;
  diasRestantes: number | null;
  estado: EstadoVigencia;
}

export function vigencia(inicio: string | null, dias: number | null, hoy: string): Vigencia {
  if (!inicio || !dias || dias <= 0) return { vence: null, diasRestantes: null, estado: "sin_vigencia" };
  const vence = sumarDias(inicio, dias);
  const diasRestantes = Math.round((diaUtc(vence) - diaUtc(hoy)) / 86_400_000);
  const estado: EstadoVigencia = diasRestantes < 0 ? "vencido" : diasRestantes <= AVISO_DIAS ? "por_vencer" : "vigente";
  return { vence, diasRestantes, estado };
}

/** El aviso en rojo de la ficha. */
export function textoVigencia(v: Vigencia): string | null {
  if (v.estado === "vencido") return `Venció hace ${-v.diasRestantes!} día${v.diasRestantes === -1 ? "" : "s"} — replantear estrategia`;
  if (v.estado === "por_vencer")
    return v.diasRestantes === 0 ? "Vence hoy — replantear estrategia" : `Vence en ${v.diasRestantes} día${v.diasRestantes === 1 ? "" : "s"} — replantear estrategia`;
  return null;
}

export type EstadoCalendario = "aprobado" | "pendiente" | "sin_calendario";

/** El calendario de un mes está aprobado cuando ninguna pieza quedó en idea. */
export function estadoCalendario(estados: string[]): { estado: EstadoCalendario; porAprobar: number; total: number } {
  const vivas = estados.filter((e) => e !== "rechazado");
  const porAprobar = vivas.filter((e) => e === "idea").length;
  if (!vivas.length) return { estado: "sin_calendario", porAprobar: 0, total: 0 };
  return { estado: porAprobar ? "pendiente" : "aprobado", porAprobar, total: vivas.length };
}

export interface DefinicionCreativa {
  dc_identidad: string | null;
  dc_tono: string | null;
  dc_medios: Record<string, NivelMedio> | null;
  dc_urgencia: Urgencia | null;
  dc_objetivo?: string | null;
}

export interface PasoCreativo {
  clave: string;
  titulo: string;
  hecho: boolean;
  tipo: "tarea" | "entregable";
}

/** El onboarding creativo: cuatro definiciones y tres entregables. */
export function pasosCreativos(d: DefinicionCreativa | null, entregablesCargados: Set<string>): PasoCreativo[] {
  const medios = d?.dc_medios ?? {};
  return [
    { clave: "identidad", titulo: "Identidad de marca", hecho: !!d?.dc_identidad?.trim(), tipo: "tarea" },
    { clave: "tono", titulo: "Tono de marca", hecho: !!d?.dc_tono?.trim(), tipo: "tarea" },
    { clave: "medios", titulo: "Importancia de cada medio", hecho: MEDIOS.every((m) => !!medios[m.clave]), tipo: "tarea" },
    { clave: "urgencia", titulo: "Prioridad y urgencia", hecho: !!d?.dc_urgencia, tipo: "tarea" },
    ...ENTREGABLES_ONBOARDING.map((e) => ({ clave: e, titulo: ENTREGABLES[e].label, hecho: entregablesCargados.has(e), tipo: "entregable" as const })),
  ];
}

/** Los dos meses que mira Santi: el actual y el que viene (el ciclo trabaja con dos semanas de ventaja). */
export function mesesCreativos(hoy: string): string[] {
  const [y, m] = hoy.split("-").map(Number);
  const sig = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return [hoy.slice(0, 7), sig];
}
