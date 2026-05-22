import type {
  UserRole,
  TaskStatus,
  TaskPriority,
  ClientStatus,
  PublicationStatus,
  PublicationNetwork,
  PublicationType,
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
  at_risk: "En riesgo (legacy)",
  perdido: "Inactivo",
};

/** Estados visibles en formularios y filtros (omite legacy `at_risk`). */
export const VISIBLE_CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "perdido", label: "Inactivo" },
];

export const CLIENT_PACK_LABEL: Record<string, string> = {
  Presencia: "Pack Presencia",
  Crecimiento: "Pack Crecimiento",
  Personalizado: "Pack Personalizado",
  Escala: "Pack Escala (legacy)",
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  gestion_redes: "Gestión de redes",
  paid_media: "Paid Media (Ads)",
  diseno_grafico: "Diseño gráfico",
  edicion_audiovisual: "Edición audiovisual",
  desarrollo_web: "Desarrollo web",
  botly: "Botly (bots WhatsApp)",
  consultoria: "Consultoría",
  otro: "Otro",
};

/** Cuántas piezas mensuales rinde cada pack de gestión de redes (default editable por cliente). */
export const PACK_DEFAULTS: Record<
  string,
  { posts: number; historias_dias: number; reels: number }
> = {
  Presencia: { posts: 8, historias_dias: 12, reels: 0 },
  Crecimiento: { posts: 12, historias_dias: 20, reels: 4 },
  Personalizado: { posts: 0, historias_dias: 0, reels: 0 },
};

/** Roles que ven todo (admin/coordinación). */
export const STAFF_ROLES: UserRole[] = ["admin", "coordinador"];

export const PAY_FREQUENCY_LABEL: Record<string, string> = {
  mensual: "Mensual",
  quincenal: "Quincenal",
  semanal: "Semanal",
  proyecto: "Por proyecto",
  comision: "Comisión",
  por_tarea: "Por tarea",
};

export const PUBLICATION_STATUS_LABEL: Record<PublicationStatus, string> = {
  idea: "Idea",
  en_diseno: "En diseño",
  guion: "Guion",
  edicion: "Edición",
  revision_creativa: "Revisión creativa",
  revision_cliente: "Revisión cliente",
  aprobado: "Aprobado",
  publicado: "Publicado",
  rechazado: "Cambios pedidos",
};

// Rampa visual del flujo:
//   gris (idea) → azul/indigo/violeta (producción)
//   → ámbar/naranja (revisiones)
//   → lime (aprobado, casi listo) → verde fuerte (publicado)
//   → rojo solo cuando se cancela
export const PUBLICATION_STATUS_BADGE: Record<PublicationStatus, string> = {
  idea:
    "bg-slate-200 text-slate-700 dark:bg-slate-500/40 dark:text-slate-100",
  en_diseno:
    "bg-blue-200 text-blue-800 dark:bg-blue-500/40 dark:text-blue-100",
  guion:
    "bg-indigo-200 text-indigo-800 dark:bg-indigo-500/40 dark:text-indigo-100",
  edicion:
    "bg-purple-200 text-purple-800 dark:bg-purple-500/40 dark:text-purple-100",
  revision_creativa:
    "bg-amber-200 text-amber-900 dark:bg-amber-500/40 dark:text-amber-100",
  revision_cliente:
    "bg-orange-200 text-orange-900 dark:bg-orange-500/45 dark:text-orange-100",
  aprobado:
    "bg-lime-200 text-lime-900 dark:bg-lime-500/40 dark:text-lime-100",
  publicado: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white",
  rechazado:
    "bg-rose-200 text-rose-900 dark:bg-rose-500/40 dark:text-rose-100",
};

// Colores sólidos para los dots/indicadores (visibles en cualquier fondo).
export const PUBLICATION_STATUS_DOT: Record<PublicationStatus, string> = {
  idea: "bg-slate-400",
  en_diseno: "bg-blue-500",
  guion: "bg-indigo-500",
  edicion: "bg-purple-500",
  revision_creativa: "bg-amber-500",
  revision_cliente: "bg-orange-500",
  aprobado: "bg-lime-500",
  publicado: "bg-emerald-500",
  rechazado: "bg-rose-500",
};

export const PUBLICATION_NETWORK_LABEL: Record<PublicationNetwork, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  twitter: "X / Twitter",
  otra: "Otra",
};

export const PUBLICATION_TYPE_LABEL: Record<PublicationType, string> = {
  post: "Post",
  reel: "Reel",
  carrusel: "Carrusel",
  historia: "Historia",
  video: "Video",
  otro: "Otro",
};

/** Flujo sugerido por tipo. */
export function nextPublicationStatuses(
  current: PublicationStatus,
  tipo: PublicationType
): PublicationStatus[] {
  const reelLike = tipo === "reel" || tipo === "video";
  switch (current) {
    case "idea":
      return reelLike
        ? ["guion", "en_diseno", "rechazado"]
        : ["en_diseno", "rechazado"];
    case "en_diseno":
      return ["revision_creativa", "rechazado"];
    case "guion":
      return ["edicion", "rechazado"];
    case "edicion":
      return ["revision_creativa", "rechazado"];
    case "revision_creativa":
      return ["revision_cliente", "rechazado", "aprobado"];
    case "revision_cliente":
      return ["aprobado", "rechazado"];
    case "aprobado":
      return ["publicado", "rechazado"];
    case "publicado":
      return [];
    case "rechazado":
      return reelLike ? ["guion", "en_diseno"] : ["en_diseno"];
    default:
      return [];
  }
}
