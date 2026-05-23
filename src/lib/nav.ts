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
}

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Mi día", icon: "Sun" },
  { href: "/tareas", label: "Tareas", icon: "ListChecks" },
  { href: "/contenidos", label: "Contenidos", icon: "Calendar" },
  {
    href: "/area",
    label: "Por área",
    icon: "Users",
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: "Briefcase",
    roles: ["admin", "coordinador"],
  },
  { href: "/equipo", label: "Equipo", icon: "Users2" },
  { href: "/equipo/personas", label: "Personas", icon: "Users" },
  { href: "/procesos", label: "Procesos", icon: "FileText" },
  { href: "/documentos", label: "Documentos", icon: "FolderOpen" },
  { href: "/jdmedia", label: "JDmedIA", icon: "MessageCircle" },
  { href: "/agencia", label: "Agencia", icon: "Sparkles" },
  { href: "/mi-perfil", label: "Mi perfil", icon: "UserCircle" },
  {
    href: "/global",
    label: "Global",
    icon: "BarChart3",
    feature: "global",
  },
  {
    href: "/finanzas",
    label: "Finanzas",
    icon: "Wallet",
    feature: "finanzas",
  },
  {
    href: "/accesos",
    label: "Accesos",
    icon: "KeyRound",
    roles: ["admin"],
  },
];

function userHasFeature(user: AppUser, feature: Feature): boolean {
  if (user.rol === "admin") return true;
  const p = (user as unknown as { permisos?: Record<string, boolean> }).permisos;
  return p?.[feature] === true;
}

export function visibleNav(user: AppUser) {
  return NAV.filter((i) => {
    if (i.roles && !i.roles.includes(user.rol)) return false;
    if (i.feature && !userHasFeature(user, i.feature)) return false;
    return true;
  });
}
