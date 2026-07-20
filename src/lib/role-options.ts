/**
 * Filtro de personas por puesto para los selects de asignación (form de
 * cliente, equipo del onboarding): mostrar solo quienes tienen el rol del
 * puesto (primario o secundario) en vez de todo el equipo.
 *
 * Lib compartida server/client (sin "use client": ver gotcha de consts).
 */
import type { UserRole } from "./types";

export interface TeamUserOpt {
  id: string;
  nombre: string;
  rol?: UserRole;
  rol_secundario?: UserRole | null;
}

export type Puesto =
  | "cm"
  | "diseno"
  | "audiovisual"
  | "pauta"
  | "coordinacion"
  | "comercial";

/** Qué roles habilitan cada puesto (admin siempre puede cubrir). */
export const PUESTO_ROLES: Record<Puesto, UserRole[]> = {
  cm: ["community_manager", "coordinador", "admin"],
  diseno: ["diseno", "coordinador_diseno", "admin"],
  audiovisual: ["audiovisual", "admin"],
  pauta: ["paid_media", "admin"],
  coordinacion: ["coordinador", "admin"],
  comercial: ["comercial", "prospecting", "admin"],
};

/**
 * Personas elegibles para un puesto. Siempre incluye a quien ya está asignado
 * (aunque su rol no coincida) para no "perder" asignaciones existentes.
 * Si nadie matchea o los usuarios vinieron sin rol (caller viejo), devuelve
 * la lista completa: filtrar nunca puede dejar el select vacío.
 */
export function usersForPuesto(
  users: TeamUserOpt[],
  puesto: Puesto,
  currentId?: string | null
): TeamUserOpt[] {
  const roles = PUESTO_ROLES[puesto];
  const match = users.filter(
    (u) =>
      (u.rol && roles.includes(u.rol)) ||
      (u.rol_secundario && roles.includes(u.rol_secundario))
  );
  if (match.length === 0) return users;
  const cur = currentId ? users.find((u) => u.id === currentId) : undefined;
  if (cur && !match.some((u) => u.id === cur.id)) return [...match, cur];
  return match;
}
