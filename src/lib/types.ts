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
  created_at: string;
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

export interface Notification {
  id: string;
  user_id: string;
  task_id: string | null;
  tipo: NotificationType;
  mensaje: string;
  leida: boolean;
  created_at: string;
}
