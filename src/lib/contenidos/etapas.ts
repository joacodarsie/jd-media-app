/**
 * Las cuatro etapas de una pieza de contenido.
 *
 * El calendario tenía NUEVE estados (idea, en diseño, guion, edición, revisión
 * creativa, revisión cliente, aprobado, publicado, cambios pedidos) y el 20/9
 * los números mostraron que el equipo usa dos: de 515 piezas de cuentas
 * activas, 129 estaban en "idea" y 377 en "publicado". **Cero en "en diseño".**
 * Nadie recorre nueve casilleros; se va de la idea a que salió.
 *
 * Así que las etapas se bajan a cuatro. No se toca el enum de la base —el
 * publicador automático, los sueldos por contenido publicado y los informes
 * leen los estados finos, y romperlos para simplificar una lista sería cambiar
 * un problema por otro—. Lo que cambia es lo que se ve y lo que se elige:
 *
 *   Idea → Produciendo → Para aprobar → Programada → (Publicado)
 *
 * "Cambios pedidos" no es una etapa aparte: una pieza con correcciones está
 * produciendo otra vez. Se muestra dentro de Produciendo con su marca.
 *
 * Módulo PURO: entra un estado, sale su etapa; entra una etapa, sale el estado
 * concreto que hay que guardar.
 */
import type { PublicationStatus, PublicationType } from "@/lib/types";

export type Etapa = "idea" | "produciendo" | "para_aprobar" | "programada" | "publicado";

/** El orden en que se recorren. Es el orden de las columnas del kanban. */
export const ETAPAS: Etapa[] = [
  "idea",
  "produciendo",
  "para_aprobar",
  "programada",
  "publicado",
];

export const ETAPA_LABEL: Record<Etapa, string> = {
  idea: "Idea",
  produciendo: "Produciendo",
  para_aprobar: "Para aprobar",
  programada: "Programada",
  publicado: "Publicado",
};

/** Qué es cada etapa, en una línea. Va abajo del nombre, no en un manual. */
export const ETAPA_AYUDA: Record<Etapa, string> = {
  idea: "Escrita, todavía sin producir.",
  produciendo: "La está haciendo diseño o edición.",
  para_aprobar: "Terminada, esperando el visto bueno.",
  programada: "Aprobada, esperando su fecha.",
  publicado: "Ya salió.",
};

export const ETAPA_HEX: Record<Etapa, string> = {
  idea: "#94a3b8",
  produciendo: "#6366f1",
  para_aprobar: "#f59e0b",
  programada: "#0ea5e9",
  publicado: "#10b981",
};

/** El estado fino → la etapa que se muestra. */
const DE_ESTADO: Record<string, Etapa> = {
  idea: "idea",
  en_diseno: "produciendo",
  guion: "produciendo",
  edicion: "produciendo",
  // Una pieza con correcciones está produciendo otra vez, no en un limbo.
  rechazado: "produciendo",
  revision_creativa: "para_aprobar",
  revision_cliente: "para_aprobar",
  aprobado: "programada",
  publicado: "publicado",
};

export function etapaDe(estado: string | null | undefined): Etapa {
  return DE_ESTADO[estado ?? ""] ?? "idea";
}

/** Los tipos que produce edición y no diseño. */
const AUDIOVISUAL = new Set(["reel", "video"]);

/**
 * Qué estado se guarda cuando alguien elige una etapa.
 *
 * "Produciendo" no es un estado real: se traduce a diseño o a edición según el
 * formato, que es la distinción que sí le importa al equipo y a los sueldos por
 * contenido.
 */
export function estadoParaEtapa(
  etapa: Etapa,
  tipo: PublicationType | string | null | undefined
): PublicationStatus {
  switch (etapa) {
    case "idea":
      return "idea";
    case "produciendo":
      return AUDIOVISUAL.has(String(tipo)) ? "edicion" : "en_diseno";
    case "para_aprobar":
      return "revision_creativa";
    case "programada":
      return "aprobado";
    case "publicado":
      return "publicado";
  }
}

/**
 * ¿Hace falta cambiar algo en la base?
 *
 * Elegir "Produciendo" sobre una pieza que ya está en `edicion` no tiene que
 * pisarla con `en_diseno`, y una con cambios pedidos no vuelve a cero solo
 * porque alguien tocó la etapa en la que ya estaba.
 */
export function estadoAlElegirEtapa(
  etapa: Etapa,
  estadoActual: string,
  tipo: PublicationType | string | null | undefined
): PublicationStatus | null {
  if (etapaDe(estadoActual) === etapa) return null;
  return estadoParaEtapa(etapa, tipo);
}

/** ¿Esta pieza volvió con correcciones? Se muestra como marca, no como etapa. */
export function tieneCorrecciones(estado: string | null | undefined): boolean {
  return estado === "rechazado";
}

/** Cuántas piezas hay en cada etapa, en el orden de ETAPAS. */
export function contarPorEtapa<T extends { estado: string }>(
  piezas: T[]
): Record<Etapa, T[]> {
  const out = {
    idea: [] as T[],
    produciendo: [] as T[],
    para_aprobar: [] as T[],
    programada: [] as T[],
    publicado: [] as T[],
  };
  for (const p of piezas) out[etapaDe(p.estado)].push(p);
  return out;
}
