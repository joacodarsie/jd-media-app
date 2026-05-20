export type UserRole =
  | "admin"
  | "coordinador"
  | "creativa"
  | "community_manager"
  | "audiovisual"
  | "comercial"
  | "paid_media"
  | "prospecting"
  | "web"
  | "botly";

export type TaskStatus =
  | "pendiente"
  | "en_progreso"
  | "en_revision"
  | "completada"
  | "bloqueada";

export type TaskPriority = "baja" | "media" | "alta" | "urgente";
export type ClientPack = "Presencia" | "Crecimiento" | "Escala";
export type ClientStatus = "activo" | "at_risk" | "perdido";
export type NotificationType =
  | "asignacion"
  | "mencion"
  | "comentario"
  | "proxima_a_vencer"
  | "vencida";

export interface AppUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  area: string;
  avatar_url: string | null;
  activo: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  nombre: string;
  rubro: string | null;
  pack: ClientPack;
  creativa_asignada_id: string | null;
  estado: ClientStatus;
  fecha_inicio: string | null;
  monto_mensual: number | null;
  calendario_url: string | null;
  drive_url: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskLink {
  label: string;
  url: string;
}

export interface Task {
  id: string;
  titulo: string;
  descripcion: string | null;
  asignado_a_id: string | null;
  creado_por_id: string | null;
  cliente_id: string | null;
  area: string;
  prioridad: TaskPriority;
  estado: TaskStatus;
  fecha_limite: string | null;
  fecha_completada: string | null;
  links: TaskLink[];
  created_at: string;
  updated_at: string;
}

export interface TaskWithRels extends Task {
  asignado: Pick<AppUser, "id" | "nombre" | "avatar_url"> | null;
  creador: Pick<AppUser, "id" | "nombre"> | null;
  cliente: Pick<Client, "id" | "nombre"> | null;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  contenido: string;
  created_at: string;
  autor?: Pick<AppUser, "id" | "nombre" | "avatar_url"> | null;
}

export type PublicationStatus =
  | "idea"
  | "en_diseno"
  | "guion"
  | "edicion"
  | "revision_creativa"
  | "revision_cliente"
  | "aprobado"
  | "publicado"
  | "rechazado";

export type PublicationNetwork =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "twitter"
  | "otra";

export type PublicationType =
  | "post"
  | "reel"
  | "carrusel"
  | "historia"
  | "video"
  | "otro";

export interface Publication {
  id: string;
  cliente_id: string;
  titulo: string;
  copy: string | null;
  guion: string | null;
  red: PublicationNetwork;
  tipo: PublicationType;
  fecha_publicacion: string | null;
  hashtags: string | null;
  asset_url: string | null;
  referencia_url: string | null;
  creado_por_id: string | null;
  audiovisual_id: string | null;
  estado: PublicationStatus;
  task_id: string | null;
  notas_revision: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicationWithRels extends Publication {
  cliente?: Pick<Client, "id" | "nombre"> | null;
  creador?: Pick<AppUser, "id" | "nombre" | "avatar_url"> | null;
  audiovisual?: Pick<AppUser, "id" | "nombre" | "avatar_url"> | null;
}

export interface Notification {
  id: string;
  user_id: string;
  task_id: string | null;
  tipo: NotificationType;
  mensaje: string;
  leida: boolean;
  created_at: string;
}
