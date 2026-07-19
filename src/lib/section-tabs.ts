import type { UserRole } from "./types";

export interface SectionTab {
  href: string;
  label: string;
}

function isCoordOrAdmin(rol: UserRole, rolSecundario?: UserRole | null) {
  return (
    rol === "admin" ||
    rol === "coordinador" ||
    rolSecundario === "admin" ||
    rolSecundario === "coordinador"
  );
}

/** Pestañas de la sección Equipo (gente): directorio, organigrama, reclutamiento y herramientas admin. */
export function equipoTabs(
  rol: UserRole,
  rolSecundario?: UserRole | null
): SectionTab[] {
  const tabs: SectionTab[] = [
    { href: "/equipo", label: "Directorio" },
    { href: "/organigrama", label: "Organigrama" },
  ];
  if (isCoordOrAdmin(rol, rolSecundario)) {
    tabs.push({ href: "/equipo/personas", label: "Personas" });
    tabs.push({ href: "/equipo/capacity", label: "Capacidad" });
    tabs.push({ href: "/reclutamiento", label: "Reclutamiento" });
  }
  return tabs;
}

/** Pestañas de Coordinación (solo admin). */
export const coordinacionTabs: SectionTab[] = [
  { href: "/coordinacion", label: "Panel" },
  { href: "/coordinacion/equipos", label: "Equipos" },
  { href: "/coordinacion/riesgo", label: "Riesgo" },
  { href: "/coordinacion/comercial", label: "Comercial" },
  { href: "/coordinacion/sueldos", label: "Sueldos" },
  { href: "/coordinacion/jornadas", label: "Jornadas" },
  { href: "/coordinacion/mes-uno", label: "Mes 1" },
  { href: "/director", label: "Director IA" },
];

/** Pestañas de Conocimiento. */
export const conocimientoTabs: SectionTab[] = [
  { href: "/documentos", label: "Documentos" },
  { href: "/procesos", label: "Procesos" },
  { href: "/templates", label: "Templates" },
  { href: "/agencia", label: "Agencia" },
];

/** Pestañas de Comercial (venta): panel, prospección y post-meet. */
export const comercialTabs: SectionTab[] = [
  { href: "/comercial", label: "Comercial" },
  { href: "/prospeccion", label: "Prospección" },
  { href: "/comercial/post-meet", label: "Post-meet" },
];

/** Pestañas de Métricas: objetivos para todos; productividad si tiene la feature. */
export function metricasTabs(showGlobal: boolean): SectionTab[] {
  const tabs: SectionTab[] = [{ href: "/objetivos", label: "Objetivos" }];
  if (showGlobal) tabs.push({ href: "/global", label: "Productividad" });
  return tabs;
}
