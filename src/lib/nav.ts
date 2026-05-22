import type { UserRole } from "./types";

export interface NavItem {
  href: string;
  label: string;
  /** icono de lucide-react (nombre) */
  icon: string;
  /** Si se define, sólo estos roles ven el item. */
  roles?: UserRole[];
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
  { href: "/agencia", label: "Agencia", icon: "Sparkles" },
  { href: "/mi-perfil", label: "Mi perfil", icon: "UserCircle" },
  {
    href: "/global",
    label: "Global",
    icon: "BarChart3",
    roles: ["admin"],
  },
  {
    href: "/finanzas",
    label: "Finanzas",
    icon: "Wallet",
    roles: ["admin"],
  },
  {
    href: "/accesos",
    label: "Accesos",
    icon: "KeyRound",
    roles: ["admin"],
  },
];

export function visibleNav(rol: UserRole) {
  return NAV.filter((i) => !i.roles || i.roles.includes(rol));
}
