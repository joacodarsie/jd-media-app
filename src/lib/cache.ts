import { unstable_cache, revalidateTag } from "next/cache";
import { createAdmin } from "./supabase/admin";

/**
 * Caché compartido para datos "casi estáticos" que se leen en muchas páginas
 * (catálogos, lista del equipo, lista de clientes).
 *
 * Usar tags estables y llamar a revalidate* cuando muta el dato correspondiente.
 *
 * NO cachear data específica del usuario actual (auth.user), filtros con
 * params dinámicos, ni queries con timestamps relativos.
 */

export const CACHE_TAGS = {
  users: "users",
  clients: "clients",
  positions: "positions",
  services: "services_catalog",
  agencyCatalogs: "agency_catalogs",
} as const;

const ONE_HOUR = 60 * 60;
const TEN_MIN = 60 * 10;

export const getActiveUsers = unstable_cache(
  async () => {
    const admin = createAdmin();
    const { data } = await admin
      .from("users")
      .select("id, nombre, avatar_url, rol, position_id, activo")
      .eq("activo", true)
      .order("nombre");
    return data ?? [];
  },
  ["active-users"],
  { tags: [CACHE_TAGS.users], revalidate: ONE_HOUR }
);

export const getActiveClients = unstable_cache(
  async () => {
    const admin = createAdmin();
    const { data } = await admin
      .from("clients")
      .select(
        "id, nombre, rubro, pack, estado, cm_id, disenador_id, audiovisual_id"
      )
      .eq("estado", "activo")
      .order("nombre");
    return data ?? [];
  },
  ["active-clients"],
  { tags: [CACHE_TAGS.clients], revalidate: TEN_MIN }
);

export const getPositionsCatalog = unstable_cache(
  async () => {
    const admin = createAdmin();
    const { data } = await admin
      .from("positions")
      .select("id, nombre, area, descripcion")
      .order("nombre");
    return data ?? [];
  },
  ["positions-catalog"],
  { tags: [CACHE_TAGS.positions], revalidate: ONE_HOUR }
);

/** Llamar tras crear/editar/desactivar usuarios. */
export function invalidateUsersCache() {
  revalidateTag(CACHE_TAGS.users);
}

/** Llamar tras crear/editar/cambiar estado de un cliente. */
export function invalidateClientsCache() {
  revalidateTag(CACHE_TAGS.clients);
}

/** Llamar tras alta/baja/edición de posiciones. */
export function invalidatePositionsCache() {
  revalidateTag(CACHE_TAGS.positions);
}

/**
 * Conteos de notification_queue para el panel de /accesos. Se actualizan
 * lentamente y un COUNT(*) exacto por estado era ~80ms x 3 estados.
 * Cache de 60s elimina ese hit en navegaciones repetidas.
 */
export const getNotificationQueueStats = unstable_cache(
  async () => {
    const admin = createAdmin();
    const [pend, sent, failed, optin] = await Promise.all([
      admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente"),
      admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "enviado"),
      admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "fallido"),
      admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("whatsapp_optin", true)
        .not("whatsapp_phone", "is", null),
    ]);
    return {
      pendiente: pend.count ?? 0,
      enviado: sent.count ?? 0,
      fallido: failed.count ?? 0,
      optinUsers: optin.count ?? 0,
    };
  },
  ["notification-queue-stats"],
  { revalidate: 60 }
);
