import type {
  UserRole,
  TaskStatus,
  TaskPriority,
  ClientStatus,
  PublicationStatus,
  PublicationNetwork,
  PublicationType,
} from "./types";
import { PACK_QUOTAS } from "./content-plans/packs";

export const TIMEZONE = "America/Argentina/Cordoba";

/**
 * Datos del titular de JD Media — se usan para precargar contratos y otros
 * documentos legales. Cambiar acá si el negocio cambia de titularidad.
 */
export const JD_MEDIA_OWNER = {
  agency_name: "JD Media",
  representative_name: "Franco Joaquín Darsie",
  representative_cuit: "20-44607986-8",
  agency_address: "Azor Grimaut 2963, Córdoba, Argentina",
} as const;

export const AREAS = [
  "Estrategia/Dirección",
  "Coordinación",
  "Diseño",
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
  community_manager: "Community Manager",
  diseno: "Diseño",
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
  archivada: "Archivada",
};

export const STATUS_ORDER: TaskStatus[] = [
  "pendiente",
  "en_progreso",
  "en_revision",
  "completada",
  "bloqueada",
  "archivada",
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
  archivada:
    "bg-zinc-100 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500",
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
  Escala: "Pack Escala",
  Personalizado: "Pack Personalizado",
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  gestion_redes: "Gestión de redes",
  paid_media: "Paid Media (Ads)",
  diseno_grafico: "Diseño gráfico",
  edicion_audiovisual: "Edición audiovisual",
  desarrollo_web: "Desarrollo web",
  branding: "Branding / estrategia de marca",
  botly: "Botly (bots WhatsApp)",
  consultoria: "Consultoría",
  otro: "Otro",
};

/** Cómo se cobra cada tipo de servicio por defecto (editable por servicio). */
export type Facturacion = "mensual" | "unico";
export const SERVICE_BILLING_DEFAULT: Record<string, Facturacion> = {
  gestion_redes: "mensual",
  paid_media: "mensual",
  consultoria: "mensual",
  diseno_grafico: "unico",
  edicion_audiovisual: "unico",
  desarrollo_web: "unico",
  branding: "unico",
  botly: "unico",
  otro: "mensual",
};

export const FACTURACION_LABEL: Record<Facturacion, string> = {
  mensual: "Mensual",
  unico: "Cobro único",
};

/**
 * Cuántas piezas mensuales rinde cada pack de gestión de redes (default
 * editable por cliente). Se DERIVA de PACK_QUOTAS (content-plans/packs.ts),
 * que es la fuente única de verdad alineada con la web de JD Media, para que
 * los números nunca se desincronicen entre la IA y el editor de servicios.
 */
export const PACK_DEFAULTS: Record<
  string,
  { posts: number; historias_dias: number; reels: number }
> = {
  Presencia: {
    posts: PACK_QUOTAS.Presencia.posts,
    historias_dias: PACK_QUOTAS.Presencia.dias_stories,
    reels: PACK_QUOTAS.Presencia.reels,
  },
  Crecimiento: {
    posts: PACK_QUOTAS.Crecimiento.posts,
    historias_dias: PACK_QUOTAS.Crecimiento.dias_stories,
    reels: PACK_QUOTAS.Crecimiento.reels,
  },
  Escala: {
    posts: PACK_QUOTAS.Escala.posts,
    historias_dias: PACK_QUOTAS.Escala.dias_stories,
    reels: PACK_QUOTAS.Escala.reels,
  },
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
  guion: "Guion", // legacy: ya no se ofrece, se mantiene para piezas viejas
  edicion: "En edición",
  revision_creativa: "Revisión creativa",
  revision_cliente: "Revisión cliente",
  aprobado: "Programado",
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
  idea: "bg-violet-500",
  en_diseno: "bg-blue-500",
  guion: "bg-slate-400",
  edicion: "bg-indigo-500",
  revision_creativa: "bg-amber-500",
  revision_cliente: "bg-orange-500",
  aprobado: "bg-cyan-500",
  publicado: "bg-emerald-500",
  rechazado: "bg-rose-500",
};

// Hex por estado (para estilos inline: dots y fondo de chip con opacidad). Se
// usa inline en vez de clases Tailwind para garantizar que SIEMPRE renderice
// (algunas clases de color dinámicas se purgan) y controlar el tono en dark.
export const PUBLICATION_STATUS_HEX: Record<PublicationStatus, string> = {
  idea: "#8b5cf6", // violeta
  en_diseno: "#3b82f6", // azul
  guion: "#94a3b8", // gris (legacy)
  edicion: "#6366f1", // índigo
  revision_creativa: "#f59e0b", // ámbar
  revision_cliente: "#f97316", // naranja
  aprobado: "#06b6d4", // cian
  publicado: "#10b981", // verde
  rechazado: "#f43f5e", // rosa
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

// Color por TIPO de pieza, para distinguir de un vistazo. El POSTEO y el CARRUSEL
// son el mismo formato (un posteo de una o varias placas) → mismo color rojo.
// El verde queda RESERVADO para el estado "publicado", por eso la historia usa
// ámbar. Esquema: posteo/carrusel=rojo, reel=azul, historia=ámbar, video=violeta.
export const PUBLICATION_TYPE_DOT: Record<PublicationType, string> = {
  post: "bg-red-500",
  carrusel: "bg-red-500",
  reel: "bg-blue-500",
  historia: "bg-amber-500",
  video: "bg-violet-500",
  otro: "bg-slate-400",
};

// Borde izquierdo (acento) por tipo — se aplica sobre el chip del calendario.
export const PUBLICATION_TYPE_BORDER: Record<PublicationType, string> = {
  post: "border-l-red-500",
  carrusel: "border-l-red-500",
  reel: "border-l-blue-500",
  historia: "border-l-amber-500",
  video: "border-l-violet-500",
  otro: "border-l-slate-400",
};

// Esquema de color por TIPO usado en el portal del cliente y en los chips del
// calendario del equipo. Hex para estilos inline (portal); clases Tailwind para
// el chip del equipo. Posteo/carrusel comparten color (mismo formato).
export const PUBLICATION_TYPE_HEX: Record<PublicationType, string> = {
  post: "#ef4444", // rojo
  reel: "#3b82f6", // azul
  historia: "#f59e0b", // ámbar
  carrusel: "#ef4444", // rojo (= posteo)
  video: "#8b5cf6", // violeta
  otro: "#94a3b8", // gris
};

// Chip por tipo (bg suave + texto + borde acento). Se usa para TODAS las piezas
// no publicadas en el calendario del equipo (las publicadas van en verde sólido).
export const PUBLICATION_TYPE_IDEA_BADGE: Record<PublicationType, string> = {
  post: "bg-red-100 text-red-900 border-l-red-500 dark:bg-red-500/30 dark:text-red-50",
  reel: "bg-blue-100 text-blue-900 border-l-blue-500 dark:bg-blue-500/30 dark:text-blue-50",
  historia: "bg-amber-100 text-amber-900 border-l-amber-500 dark:bg-amber-500/30 dark:text-amber-50",
  carrusel: "bg-red-100 text-red-900 border-l-red-500 dark:bg-red-500/30 dark:text-red-50",
  video: "bg-violet-100 text-violet-900 border-l-violet-500 dark:bg-violet-500/30 dark:text-violet-50",
  otro: "bg-slate-100 text-slate-800 border-l-slate-400 dark:bg-slate-500/30 dark:text-slate-50",
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
