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
  perdido: "Perdido",
};

/** Estados visibles en formularios y filtros (omite legacy `at_risk`). */
export const VISIBLE_CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "activo", label: "Activo" },
  { value: "perdido", label: "Perdido" },
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

export const PUBLICATION_STATUS_BADGE: Record<PublicationStatus, string> = {
  idea: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  en_diseno: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  guion: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  edicion: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  revision_creativa:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  revision_cliente:
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  aprobado:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  publicado: "bg-green-600 text-white",
  rechazado: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
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
