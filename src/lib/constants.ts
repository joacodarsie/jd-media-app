import type {
  UserRole,
  TaskStatus,
  TaskPriority,
  ClientStatus,
} from "./types";

export const TIMEZONE = "America/Argentina/Cordoba";

export const AREAS = [
  "Estrategia/Dirección",
  "Coordinación",
  "Diseño",
  "Creativas",
  "Community Manager",
  "Edición Audiovisual",
  "Paid Media",
  "Prospecting",
  "Comercial",
  "Desarrollo Web",
  "Botly",
] as const;

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  coordinador: "Coordinación",
  creativa: "Creativa",
  community_manager: "Community Manager",
  audiovisual: "Editor Audiovisual",
  comercial: "Comercial",
  paid_media: "Paid Media",
  prospecting: "Prospecting",
  web: "Desarrollo Web",
  botly: "Botly",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  en_revision: "En revisión",
  completada: "Completada",
  bloqueada: "Bloqueada",
};

export const STATUS_ORDER: TaskStatus[] = [
  "pendiente",
  "en_progreso",
  "en_revision",
  "completada",
  "bloqueada",
];

export const STATUS_BADGE: Record<TaskStatus, string> = {
  pendiente:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  en_progreso:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  en_revision:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  completada:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  bloqueada:
    "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

export const PRIORITY_BADGE: Record<TaskPriority, string> = {
  baja: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  media: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  alta: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  urgente: "bg-red-600 text-white",
};

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  activo: "Activo",
  at_risk: "En riesgo",
  perdido: "Perdido",
};

export const CLIENT_PACK_LABEL: Record<string, string> = {
  Presencia: "Presencia",
  Crecimiento: "Crecimiento",
  Escala: "Escala",
};

/** Roles que ven todo (admin/coordinación). */
export const STAFF_ROLES: UserRole[] = ["admin", "coordinador"];
