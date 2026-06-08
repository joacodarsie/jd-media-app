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
      { href: "/agenda", label: "Agenda", icon: "CalendarClock" },
      { href: "/jdmedia", label: "JDmedIA", icon: "MessageCircle" },
      {
        href: "/jdmedia/live",
        label: "JDmedIA en vivo",
        icon: "Radio",
        liveOwnerOnly: true,
      },
      {
        href: "/director",
        label: "Director IA",
        icon: "Sparkles",
        roles: ["admin", "coordinador", "community_manager"],
      },
      { href: "/chat", label: "Chat equipo", icon: "Hash" },
    ],
  },
  {
    label: "Equipo & clientes",
    items: [
      { href: "/area", label: "Por área", icon: "Users" },
      {
        href: "/clientes",
        label: "Clientes",
        icon: "Briefcase",
        // Visible para todo el equipo. La pagina internamente oculta datos
        // sensibles (monto, pagos, contacto privado) a no-admin/coord.
      },
      {
        href: "/comercial",
        label: "Comercial",
        icon: "Target",
        roles: ["admin", "coordinador", "comercial", "prospecting"],
      },
      { href: "/equipo", label: "Equipo", icon: "Users2" },
      {
        href: "/equipo/personas",
        label: "Personas",
        icon: "Users",
        roles: ["admin", "coordinador"],
      },
      {
        href: "/equipo/capacity",
        label: "Capacidad",
        icon: "Gauge",
        roles: ["admin", "coordinador"],
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
      { href: "/documentos", label: "Documentos", icon: "FolderOpen" },
      { href: "/procesos", label: "Procesos", icon: "FileText" },
      { href: "/templates", label: "Templates", icon: "FileText" },
      { href: "/agencia", label: "Agencia", icon: "Sparkles" },
      { href: "/ayuda", label: "Ayuda", icon: "BookOpen" },
      { href: "/novedades", label: "Novedades", icon: "Megaphone" },
    ],
  },
  {
    label: "Métricas",
    items: [
      { href: "/global", label: "Global", icon: "BarChart3", feature: "global" },
      { href: "/finanzas", label: "Finanzas", icon: "Wallet", feature: "finanzas" },
      {
        href: "/coordinacion",
        label: "Coordinación",
        icon: "SlidersHorizontal",
        roles: ["admin"],
      },
      {
        href: "/coordinacion/sueldos",
        label: "Sueldos",
        icon: "Banknote",
        roles: ["admin"],
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
  if (i.roles && !i.roles.includes(user.rol)) return false;
  if (i.feature && !userHasFeature(user, i.feature)) return false;
  if (i.liveOwnerOnly && !isLiveOwner) return false;
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
