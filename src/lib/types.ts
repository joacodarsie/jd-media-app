export type UserRole =
  | "admin"
  | "coordinador"
  | "coordinador_diseno"
  | "community_manager"
  | "diseno"
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
  | "bloqueada"
  | "archivada";

export type TaskPriority = "baja" | "media" | "alta" | "urgente";
export type ClientPack = "Presencia" | "Crecimiento" | "Escala" | "Personalizado";
export type ClientStatus = "activo" | "at_risk" | "perdido" | "propuesta";

export type ServiceType =
  | "gestion_redes"
  | "paid_media"
  | "diseno_grafico"
  | "edicion_audiovisual"
  | "desarrollo_web"
  | "branding"
  | "botly"
  | "consultoria"
  | "otro";

export interface ClientService {
  id: string;
  cliente_id: string;
  tipo: ServiceType;
  pack: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  monto_mensual: number | null;
  moneda: string;
  facturacion: "mensual" | "unico";
  pack_detalle: Record<string, number | string>;
  notas: string | null;
  activo: boolean;
  responsables: string[];
  created_at: string;
  updated_at: string;
}
export type NotificationType =
  | "asignacion"
  | "mencion"
  | "comentario"
  | "proxima_a_vencer"
  | "vencida"
  | "recordatorio";

export interface AppUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  area: string;
  /** Rol secundario opcional, para quien cumple 2 funciones en la agencia. */
  rol_secundario: UserRole | null;
  /** Área secundaria opcional (para figurar también ahí). */
  area_secundaria: string | null;
  avatar_url: string | null;
  activo: boolean;
  position_id: string | null;
  secondary_position_ids: string[];
  fecha_ingreso: string | null;
  telefono: string | null;
  dni_cuit: string | null;
  cbu: string | null;
  alias_cbu: string | null;
  titular_cuenta: string | null;
  notas_personales: string | null;
  created_at: string;
}

export type PayFrequency =
  | "mensual"
  | "quincenal"
  | "semanal"
  | "proyecto"
  | "comision"
  | "por_tarea";

export interface PositionTool {
  nombre: string;
  url?: string;
}

export interface Position {
  id: string;
  nombre: string;
  area: string;
  descripcion: string | null;
  alcance_incluye: string | null;
  alcance_excluye: string | null;
  herramientas: PositionTool[];
  kpis: string | null;
  procesos: string | null;
  services: string[];
  pago_default_monto: number | null;
  pago_default_moneda: string | null;
  pago_default_frecuencia: PayFrequency | null;
  pago_default_forma: string | null;
  pago_default_notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface Compensation {
  user_id: string;
  monto: number | null;
  moneda: string | null;
  frecuencia: PayFrequency | null;
  forma_pago: string | null;
  notas: string | null;
  updated_at: string;
}

export interface Client {
  id: string;
  nombre: string;
  rubro: string | null;
  pack: ClientPack;
  estado: ClientStatus;
  /** true = cuenta interna de la agencia (no cliente facturable). */
  es_interno: boolean;
  fecha_inicio: string | null;
  monto_mensual: number | null;
  calendario_url: string | null;
  drive_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  web_url: string | null;
  datos_facturacion: string | null;
  notion_url: string | null;
  contacto_nombre: string | null;
  contacto_dni_cuit: string | null;
  contacto_domicilio: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  notas: string | null;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
  coordinador_id: string | null;
  cerrado_por_id: string | null;
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
  aprobador_id: string | null;
  requiere_aprobacion: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskWithRels extends Task {
  asignado: Pick<AppUser, "id" | "nombre" | "avatar_url"> | null;
  creador: Pick<AppUser, "id" | "nombre"> | null;
  aprobador?: Pick<AppUser, "id" | "nombre"> | null;
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
  descripcion: string | null;
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
  disenador_id: string | null;
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
  link?: string | null;
}

export interface InternalMeeting {
  id: string;
  titulo: string;
  descripcion: string | null;
  starts_at: string;
  ends_at: string;
  ubicacion: string | null;
  meet_link: string | null;
  client_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InternalMeetingWithRels extends InternalMeeting {
  cliente?: { id: string; nombre: string } | null;
  creador?: { id: string; nombre: string; avatar_url: string | null } | null;
  attendees: { id: string; nombre: string; avatar_url: string | null }[];
}
