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

/** Pestañas de Comercial (venta): panel, leads, prospección y post-meet. */
export const comercialTabs: SectionTab[] = [
  { href: "/comercial", label: "Comercial" },
  // Primera después del panel a propósito: es la pantalla del día cuando la
  // prioridad es traer cuentas sin gastar en pauta.
  { href: "/captacion", label: "🎯 Conseguir clientes" },
  { href: "/comercial/leads", label: "Leads" },
  { href: "/prospeccion", label: "Prospección" },
  { href: "/comercial/post-meet", label: "Post-meet" },
];

/**
 * Roles que ven el tablero "Máquina de clientes" (mismo criterio que la sección
 * Comercial: quien vende, más coordinación/dirección que miran el número).
 */
export function puedeVerMaquina(rol: UserRole, rolSecundario?: UserRole | null): boolean {
  const ok: UserRole[] = ["admin", "coordinador", "comercial", "prospecting"];
  return ok.includes(rol) || (!!rolSecundario && ok.includes(rolSecundario));
}

/**
 * Pestañas de Métricas: objetivos para todos; la máquina de clientes para quien
 * vende (y dirección); productividad si tiene la feature.
 */
export function metricasTabs(showGlobal: boolean, showMaquina = false): SectionTab[] {
  const tabs: SectionTab[] = [{ href: "/objetivos", label: "Objetivos" }];
  if (showMaquina) tabs.push({ href: "/objetivos/maquina", label: "Máquina de clientes" });
  if (showGlobal) tabs.push({ href: "/global", label: "Productividad" });
  return tabs;
}
