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

/** Redirige al dashboard si el rol no está permitido. */
export async function requireRole(roles: string[]): Promise<AppUser> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) redirect("/dashboard");
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
 *  - creativa, cm, audiovisual y disenador ven solo los clientes donde estan
 *    asignados (creativa_asignada_id, cm_id, audiovisual_id, disenador_id)
 *  - el resto no accede salvo si esta asignado en alguno de esos campos
 */
export async function canAccessClient(
  userId: string,
  userRol: string,
  clientId: string
): Promise<boolean> {
  if (isStaff(userRol)) return true;
  const supabase = createClient();
  const { data } = await supabase
    .from("clients")
    .select("creativa_asignada_id, cm_id, audiovisual_id, disenador_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return false;
  type Row = {
    creativa_asignada_id: string | null;
    cm_id: string | null;
    audiovisual_id: string | null;
    disenador_id: string | null;
  };
  const c = data as Row;
  return (
    c.creativa_asignada_id === userId ||
    c.cm_id === userId ||
    c.audiovisual_id === userId ||
    c.disenador_id === userId
  );
}

/** Redirige al dashboard si el usuario no puede acceder al cliente. */
export async function requireClientAccess(clientId: string): Promise<AppUser> {
  const user = await requireUser();
  const ok = await canAccessClient(user.id, user.rol, clientId);
  if (!ok) redirect("/dashboard");
  return user;
}
