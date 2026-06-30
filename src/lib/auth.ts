import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { AppUser } from "./types";
import type { Feature } from "./permissions";

/**
 * Resuelve el perfil del usuario logueado (o null) UNA sola vez por request.
 *
 * Envuelto en React `cache()`: el layout y la página (y cualquier action que
 * corra en el mismo render) comparten el resultado, en vez de repetir el
 * `auth.getUser()` (round-trip de red a Supabase Auth) + el SELECT a `users`
 * en cada llamada. Antes esto corría 2+ veces por navegación.
 */
const resolveUserProfile = cache(async (): Promise<AppUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as AppUser) ?? null;
});

/** Devuelve el perfil del usuario logueado o redirige a /login. */
export async function requireUser(): Promise<AppUser> {
  const profile = await resolveUserProfile();
  if (!profile) redirect("/login");
  return profile;
}

export function isStaff(rol: string) {
  return rol === "admin" || rol === "coordinador";
}

type RoleBearer = { rol: string; rol_secundario?: string | null };

/** true si alguno de los roles del usuario (primario o secundario) está en la lista. */
export function userInRoles(u: RoleBearer, roles: string[]): boolean {
  return roles.includes(u.rol) || (!!u.rol_secundario && roles.includes(u.rol_secundario));
}

/** Como isStaff pero mirando también el rol secundario (roles dobles). */
export function isStaffUser(u: RoleBearer): boolean {
  return isStaff(u.rol) || (!!u.rol_secundario && isStaff(u.rol_secundario));
}

/**
 * Quién ve TODOS los clientes: staff (admin/coordinación) y la coordinación de
 * diseño (es diseñadora de toda la agencia y coordina ese servicio). No implica
 * acceso a finanzas/global: solo visibilidad de cuentas.
 */
export function canSeeAllClients(u: RoleBearer): boolean {
  return isStaffUser(u) || userInRoles(u, ["coordinador_diseno"]);
}

/** Redirige al dashboard si el rol no está permitido (mira primario y secundario). */
export async function requireRole(roles: string[]): Promise<AppUser> {
  const user = await requireUser();
  const ok = roles.includes(user.rol) || (!!user.rol_secundario && roles.includes(user.rol_secundario));
  if (!ok) redirect("/dashboard");
  return user;
}

/** Chequea si el usuario tiene una feature otorgada. Admin siempre la tiene. */
export function userHas(user: AppUser, feature: Feature): boolean {
  if (user.rol === "admin") return true;
  const p = (user as unknown as { permisos?: Record<string, boolean> }).permisos;
  return p?.[feature] === true;
}

/** Redirige si el usuario no tiene la feature. */
export async function requireFeature(feature: Feature): Promise<AppUser> {
  const user = await requireUser();
  if (!userHas(user, feature)) redirect("/dashboard");
  return user;
}

/**
 * Devuelve true si el usuario puede ver la ficha de un cliente especifico.
 * Reglas:
 *  - admin y coordinador ven todo
 *  - cm, audiovisual y disenador ven solo los clientes donde estan asignados
 *    (cm_id, audiovisual_id, disenador_id)
 *  - el resto no accede salvo si esta asignado en alguno de esos campos
 */
export async function canAccessClient(
  userId: string,
  userRol: string,
  clientId: string,
  userRolSecundario: string | null = null
): Promise<boolean> {
  if (canSeeAllClients({ rol: userRol, rol_secundario: userRolSecundario })) return true;
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select("cm_id, audiovisual_id, disenador_id, media_buyer_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return false;
  type Row = {
    cm_id: string | null;
    audiovisual_id: string | null;
    disenador_id: string | null;
    media_buyer_id: string | null;
  };
  const c = data as Row;
  return (
    c.cm_id === userId ||
    c.audiovisual_id === userId ||
    c.disenador_id === userId ||
    c.media_buyer_id === userId
  );
}

/**
 * Devuelve los IDs de clientes que el usuario puede ver. Staff (admin/
 * coordinador) ve TODO → devuelve null (sin restricción). El resto ve solo las
 * cuentas donde está asignado: columnas de equipo (cm/diseño/audiovisual)
 * o responsable de un servicio activo. Devolver [] significa "no ve ninguna".
 */
export async function getAccessibleClientIds(
  user: Pick<AppUser, "id" | "rol" | "rol_secundario">
): Promise<string[] | null> {
  if (canSeeAllClients(user)) return null;
  const supabase = createClient();
  const ids = new Set<string>();

  const { data: byCols } = await supabase
    .from("clients")
    .select("id")
    .or(
      `cm_id.eq.${user.id},disenador_id.eq.${user.id},audiovisual_id.eq.${user.id},media_buyer_id.eq.${user.id}`
    );
  for (const r of (byCols ?? []) as { id: string }[]) ids.add(r.id);

  const { data: bySvc } = await supabase
    .from("client_services")
    .select("cliente_id")
    .eq("activo", true)
    .contains("responsables", [user.id]);
  for (const r of (bySvc ?? []) as { cliente_id: string }[])
    ids.add(r.cliente_id);

  return Array.from(ids);
}

/** Redirige al dashboard si el usuario no puede acceder al cliente. */
export async function requireClientAccess(clientId: string): Promise<AppUser> {
  const user = await requireUser();
  const ok = await canAccessClient(user.id, user.rol, clientId, user.rol_secundario);
  if (!ok) redirect("/dashboard");
  return user;
}
