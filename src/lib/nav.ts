import type { AppUser, UserRole } from "./types";
import type { Feature } from "./permissions";

export interface NavItem {
  href: string;
  label: string;
  /** icono de lucide-react (nombre) */
  icon: string;
  /** Si se define, sólo estos roles ven el item. */
  roles?: UserRole[];
  /** Si se define, además requiere esta feature (admin la tiene siempre). */
  feature?: Feature;
  /** Si es true, sólo lo ve la cuenta dueña de JDmedIA en vivo (gate por env). */
  liveOwnerOnly?: boolean;
  /**
   * Rutas extra que pertenecen a esta sección aunque vivan en su propio
   * top-level (pestañas). Sirve para que el item quede marcado como activo
   * cuando estás en una sub-página. Ej: "/equipo" incluye "/reclutamiento".
   */
  match?: string[];
}

export interface NavGroup {
  /** Etiqueta que se muestra arriba del grupo. null para grupo sin label (el primero) */
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Mi día", icon: "Sun" },
      { href: "/tareas", label: "Tareas", icon: "ListChecks" },
      { href: "/contenidos", label: "Contenidos", icon: "Calendar" },
      {
        href: "/paid-media",
        label: "Paid Media",
        icon: "TrendingUp",
        roles: ["admin", "coordinador", "paid_media"],
      },
      { href: "/agenda", label: "Agenda", icon: "CalendarClock" },
      // JDmedIA en vivo ya no es ítem: se entra con el botón "Sesión en vivo"
      // dentro de /jdmedia (misma feature jdmedia_live).
      { href: "/jdmedia", label: "JDmedIA", icon: "MessageCircle" },
      {
        href: "/director",
        label: "Director IA",
        icon: "Sparkles",
        // El admin llega por la pestaña "Director IA" de Coordinación; el ítem
        // queda solo para coordinación, que no ve esa sección.
        roles: ["coordinador"],
      },
      { href: "/chat", label: "Chat equipo", icon: "Hash" },
    ],
  },
  {
    label: "Equipo & clientes",
    items: [
      {
        href: "/clientes",
        label: "Clientes",
        icon: "Briefcase",
        // Visible para todo el equipo. La pagina internamente oculta datos
        // sensibles (monto, pagos, contacto privado) a no-admin/coord.
      },
      // Comercial agrupa: Comercial, Prospección y Post-meet (pestañas).
      {
        href: "/comercial",
        label: "Comercial",
        icon: "Target",
        roles: ["admin", "coordinador", "comercial", "prospecting"],
        feature: "comercial",
        match: ["/prospeccion"],
      },
      // Equipo agrupa: Directorio, Organigrama, Personas, Capacidad y
      // Reclutamiento (pestañas).
      {
        href: "/equipo",
        label: "Equipo",
        icon: "Users2",
        match: ["/organigrama", "/reclutamiento"],
      },
      {
        href: "/contratos",
        label: "Contratos",
        icon: "FileText",
        roles: ["admin", "coordinador"],
      },
    ],
  },
  {
    label: "Conocimiento",
    items: [
      // Documentos agrupa: Documentos, Procesos, Templates y Agencia (pestañas).
      {
        href: "/documentos",
        label: "Documentos",
        icon: "FolderOpen",
        match: ["/procesos", "/templates", "/agencia"],
      },
      { href: "/ayuda", label: "Ayuda", icon: "BookOpen" },
      { href: "/portal", label: "Portal", icon: "Megaphone" },
    ],
  },
  {
    label: "Métricas",
    items: [
      // Métricas agrupa: Objetivos y Productividad (pestañas).
      { href: "/objetivos", label: "Métricas", icon: "Goal", match: ["/global"] },
      { href: "/finanzas", label: "Finanzas", icon: "Wallet", feature: "finanzas" },
      // Coordinación agrupa: Panel, Equipos, Riesgo, Comercial, Sueldos,
      // Jornadas, Mes 1 y Director IA (pestañas).
      {
        href: "/coordinacion",
        label: "Coordinación",
        icon: "SlidersHorizontal",
        roles: ["admin"],
        match: ["/director"],
      },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { href: "/mi-perfil", label: "Mi perfil", icon: "UserCircle" },
      { href: "/accesos", label: "Accesos", icon: "KeyRound", roles: ["admin"] },
    ],
  },
];

// Compat: lista plana para quien todavía la consuma.
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

function userHasFeature(user: AppUser, feature: Feature): boolean {
  if (user.rol === "admin") return true;
  const p = (user as unknown as { permisos?: Record<string, boolean> }).permisos;
  return p?.[feature] === true;
}

function itemVisible(user: AppUser, i: NavItem, isLiveOwner = false) {
  if (i.liveOwnerOnly && !isLiveOwner) return false;
  // Visible si el ROL (primario o secundario) está en la lista, O si tiene la
  // feature. Antes exigía la feature aunque el rol estuviera en la lista, lo que
  // ocultaba Comercial/Prospección a quien tiene rol "comercial" pero no el
  // permiso homónimo. Ahora cualquiera de las dos alcanza.
  const roleOk =
    !!i.roles &&
    (i.roles.includes(user.rol) ||
      (!!user.rol_secundario && i.roles.includes(user.rol_secundario)));
  const featOk = !!i.feature && userHasFeature(user, i.feature);
  if (i.roles || i.feature) return roleOk || featOk;
  return true;
}

export function visibleNav(user: AppUser, isLiveOwner = false) {
  return NAV.filter((i) => itemVisible(user, i, isLiveOwner));
}

export function visibleNavGroups(user: AppUser, isLiveOwner = false): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => itemVisible(user, i, isLiveOwner)),
  })).filter((g) => g.items.length > 0);
}

/**
 * Item de nav al que "pertenece" el pathname actual, considerando el href y sus
 * rutas `match` (sub-páginas/pestañas). Gana el patrón más largo que prefija; a
 * igualdad, el href exacto del item. Devuelve null si nada matchea.
 *
 * Se pasa la lista de items VISIBLES para el usuario, así una pestaña de una
 * sección oculta no roba el resaltado (ej: /director es item propio para
 * coordinación, pero pestaña de Coordinación para el admin).
 */
export function matchNavItem(pathname: string, items: NavItem[]): NavItem | null {
  let best: NavItem | null = null;
  let bestLen = -1;
  let bestExact = false;
  for (const it of items) {
    const patterns = [it.href, ...(it.match ?? [])];
    for (const p of patterns) {
      if (pathname === p || pathname.startsWith(p + "/")) {
        const exact = p === it.href;
        // Más largo gana; a igual longitud, el href exacto le gana al alias.
        if (p.length > bestLen || (p.length === bestLen && exact && !bestExact)) {
          best = it;
          bestLen = p.length;
          bestExact = exact;
        }
      }
    }
  }
  return best;
}
