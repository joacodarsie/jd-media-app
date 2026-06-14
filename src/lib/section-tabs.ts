import type { UserRole } from "./types";

export interface SectionTab {
  href: string;
  label: string;
}

/** Pestañas de la sección Equipo (gente): directorio, organigrama y herramientas admin. */
export function equipoTabs(rol: UserRole): SectionTab[] {
  const tabs: SectionTab[] = [
    { href: "/equipo", label: "Directorio" },
    { href: "/organigrama", label: "Organigrama" },
  ];
  if (rol === "admin" || rol === "coordinador") {
    tabs.push({ href: "/equipo/personas", label: "Personas" });
    tabs.push({ href: "/equipo/capacity", label: "Capacidad" });
  }
  return tabs;
}

/** Pestañas de Coordinación (solo admin). */
export const coordinacionTabs: SectionTab[] = [
  { href: "/coordinacion", label: "Panel" },
  { href: "/coordinacion/sueldos", label: "Sueldos" },
  { href: "/coordinacion/jornadas", label: "Jornadas" },
];

/** Pestañas de Conocimiento. */
export const conocimientoTabs: SectionTab[] = [
  { href: "/documentos", label: "Documentos" },
  { href: "/procesos", label: "Procesos" },
  { href: "/templates", label: "Templates" },
  { href: "/agencia", label: "Agencia" },
];
