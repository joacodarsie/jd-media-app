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
  { href: "/coordinacion/cotizador", label: "Cotizador" },
  { href: "/coordinacion/equipos", label: "Equipos" },
  { href: "/coordinacion/riesgo", label: "Riesgo" },
  { href: "/coordinacion/comercial", label: "Comercial" },
  { href: "/coordinacion/sueldos", label: "Sueldos" },
  { href: "/coordinacion/jornadas", label: "Jornadas" },
  { href: "/coordinacion/mes-uno", label: "Mes 1" },
  { href: "/director", label: "Director IA" },
];

/**
 * Finanzas, en tres destinos.
 *
 * Eran trece pantallas colgando de un menú, y el dueño dijo tres veces que se
 * marea y que no sabe a cuál entrar. El problema de fondo no era la cantidad:
 * era que TRES pantallas distintas contestaban la misma pregunta ("¿cómo viene
 * la agencia?") con tres números distintos, y por eso no confiaba en ninguno.
 *
 * Ahora cada grupo contesta UNA pregunta, y las pantallas de adentro son
 * pestañas de esa pregunta, no destinos sueltos:
 *
 *  1. ¿Cómo viene?          → el número, con distinto grado de detalle.
 *  2. ¿Qué entra y qué sale? → lo que se hace todos los meses.
 *  3. ¿Por qué?             → dónde mirar cuando el número no cierra.
 */
export function finanzasGrupos(esAdmin: boolean): SectionTab[][] {
  return [
    [
      { href: "/finanzas/resumen", label: "El resumen" },
      { href: "/finanzas/panorama", label: "Panorama" },
      { href: "/finanzas/mes", label: "La plata del mes" },
      { href: "/finanzas/proyeccion", label: "Proyección" },
    ],
    [
      // Primera a propósito: es la pantalla con la que se marca lo que entra, y
      // la que se usa de verdad. "Cuentas por cobrar" es la versión completa.
      { href: "/cobros", label: "¿Quién me pagó?" },
      { href: "/finanzas/cobros", label: "Cuentas por cobrar" },
      { href: "/finanzas/pagos", label: "Pagos al equipo" },
      { href: "/finanzas/gastos", label: "Gastos" },
      { href: "/finanzas/vencimientos", label: "Vencimientos" },
      { href: "/finanzas/cierre", label: "Cerrar el mes" },
    ],
    [
      { href: "/finanzas/rentabilidad", label: "Rentabilidad" },
      { href: "/finanzas/movimientos", label: "Movimientos" },
      // Deudas es privada (requireRole admin): no se la mostramos a nadie más.
      ...(esAdmin ? [{ href: "/finanzas/deudas", label: "Deudas" }] : []),
      { href: "/finanzas/ia", label: "Costo de IA" },
    ],
  ];
}

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
