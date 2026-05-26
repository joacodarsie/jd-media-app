import type { UserRole } from "./types";
import type { Feature } from "./permissions";

/**
 * Features que se asignan por defecto al crear un usuario con cada rol.
 * El admin puede ajustar despues desde el dialog de permisos.
 *
 * Filosofia:
 *  - admin tiene TODO siempre (no hace falta listarlo).
 *  - coordinador: ve global, equipo_compensacion, clientes_credenciales y
 *    puede editar documentos generales. NO finanzas (es del fundador).
 *  - comercial: ve clientes_credenciales (necesita pasar accesos a clientes).
 *  - el resto: nada por defecto. Si necesitan ver algo, el admin lo otorga.
 */
export const ROLE_DEFAULT_FEATURES: Record<UserRole, Feature[]> = {
  admin: [
    "finanzas",
    "global",
    "equipo_compensacion",
    "clientes_credenciales",
    "documentos_globales",
  ],
  coordinador: [
    "global",
    "equipo_compensacion",
    "clientes_credenciales",
    "documentos_globales",
  ],
  comercial: ["clientes_credenciales"],
  creativa: [],
  community_manager: [],
  audiovisual: [],
  paid_media: [],
  prospecting: [],
  web: [],
  botly: [],
};

/**
 * Devuelve un objeto `permisos` (Record<feature, true>) con los defaults del rol.
 * Listo para insertar en users.permisos.
 */
export function defaultPermisosForRole(rol: UserRole): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of ROLE_DEFAULT_FEATURES[rol] ?? []) {
    out[f] = true;
  }
  return out;
}
