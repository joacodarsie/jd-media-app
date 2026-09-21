/**
 * Las cinco pantallas del onboarding de una cuenta, y quién entra a cada una.
 *
 * Hasta el 21/9/2026 la ficha del cliente tenía un botón por pantalla: la
 * dirección veía cinco ("Onboarding", "Onboarding redes", "Onboarding CM",
 * "Onboarding diseño", "Onboarding publicidad") y la coordinación cuatro. Todos
 * llevaban a lo mismo por caminos distintos, y la barra de la ficha era una
 * fila de botones casi iguales.
 *
 * Ahora la ficha tiene UN botón —el primero que esa persona puede abrir— y
 * adentro las pantallas se recorren con pestañas. Este módulo decide las dos
 * cosas: qué pestañas se muestran y a cuál se entra.
 *
 * Los roles de acá son los MISMOS que chequea cada página con `requireRole`. Si
 * no coincidieran, alguien vería una pestaña que lo rebota — que es justo lo
 * que pasaba al dejar un solo botón sin mirar los permisos.
 *
 * Módulo PURO: entran los roles y los servicios, salen las pestañas.
 */

export type PanelOnboarding = "inicial" | "redes" | "cm" | "diseno" | "pauta";

export interface PanelDef {
  key: PanelOnboarding;
  label: string;
  /** Roles que pueden abrirla (igual que el requireRole de la página). */
  roles: string[];
}

/** El orden es el del circuito: primero la dirección, después cada área. */
export const PANELES: PanelDef[] = [
  { key: "inicial", label: "Inicial", roles: ["admin"] },
  { key: "redes", label: "Gestión de redes", roles: ["admin", "coordinador"] },
  { key: "cm", label: "Community", roles: ["admin", "coordinador", "community_manager"] },
  {
    key: "diseno",
    label: "Diseño",
    roles: ["admin", "coordinador", "coordinador_diseno", "diseno"],
  },
  { key: "pauta", label: "Publicidad", roles: ["admin", "coordinador", "paid_media"] },
];

export interface ServiciosDeLaCuenta {
  gestionRedes: boolean;
  disenoGrafico: boolean;
  paidMedia: boolean;
}

/** ¿La cuenta contrató algo que haga falta para esta pantalla? */
function aplicaPorServicio(key: PanelOnboarding, svc: ServiciosDeLaCuenta): boolean {
  switch (key) {
    case "inicial":
      return true;
    case "redes":
    case "cm":
      return svc.gestionRedes;
    case "diseno":
      return svc.gestionRedes || svc.disenoGrafico;
    case "pauta":
      // Gestión de redes ya incluye el paid media básico en Meta Ads.
      return svc.paidMedia || svc.gestionRedes;
  }
}

/** La ruta de cada pantalla. La de publicidad vive fuera de /onboarding. */
export function hrefDePanel(clienteId: string, key: PanelOnboarding): string {
  if (key === "inicial") return `/clientes/${clienteId}/onboarding`;
  if (key === "pauta") return `/clientes/${clienteId}/pauta`;
  return `/clientes/${clienteId}/onboarding/${key}`;
}

/**
 * Las pantallas que esta persona puede abrir en esta cuenta.
 *
 * `roles` lleva el rol y el secundario: los roles dobles suman permisos, igual
 * que en el resto de la app.
 */
export function panelesVisibles(
  roles: (string | null | undefined)[],
  svc: ServiciosDeLaCuenta
): PanelDef[] {
  const mios = new Set(roles.filter((r): r is string => !!r));
  return PANELES.filter(
    (p) => p.roles.some((r) => mios.has(r)) && aplicaPorServicio(p.key, svc)
  );
}

/**
 * A qué pantalla lleva el único botón de la ficha. null = no le corresponde
 * ninguna, y entonces el botón no se muestra.
 */
export function panelDeEntrada(
  roles: (string | null | undefined)[],
  svc: ServiciosDeLaCuenta
): PanelDef | null {
  return panelesVisibles(roles, svc)[0] ?? null;
}
