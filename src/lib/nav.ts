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
    label: "Por cliente",
    icon: "Briefcase",
    roles: ["admin", "coordinador"],
  },
  { href: "/equipo", label: "Equipo", icon: "Users2" },
  { href: "/mi-perfil", label: "Mi perfil", icon: "UserCircle" },
  {
    href: "/global",
    label: "Global",
    icon: "BarChart3",
    roles: ["admin"],
  },
];

export function visibleNav(rol: UserRole) {
  return NAV.filter((i) => !i.roles || i.roles.includes(rol));
}
