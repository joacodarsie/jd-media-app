import { createAdmin } from "@/lib/supabase/admin";

/**
 * Quién puede figurar como autor de los mensajes de una campaña.
 *
 * El mensaje lo firma la persona que lo va a mandar: si prospecta Matías, el
 * prospecto tiene que leer "soy Matías de JD Media" y encontrarse con Matías
 * cuando conteste. Antes los mensajes de cada lead se firmaban siempre con el
 * representante de la agencia.
 *
 * Es el equipo de prospección: quien tiene acceso a la sección.
 */
const ROLES_QUE_ESCRIBEN = ["admin", "coordinador", "comercial", "prospecting"];

export async function equipoQueEscribe(): Promise<{ id: string; nombre: string }[]> {
  const { data } = await createAdmin()
    .from("users")
    .select("id, nombre, rol, rol_secundario")
    .eq("activo", true)
    .order("nombre");
  const gente = (data ?? []) as {
    id: string;
    nombre: string;
    rol: string | null;
    rol_secundario: string | null;
  }[];
  return gente
    .filter(
      (u) =>
        ROLES_QUE_ESCRIBEN.includes(u.rol ?? "") ||
        ROLES_QUE_ESCRIBEN.includes(u.rol_secundario ?? "")
    )
    .map((u) => ({ id: u.id, nombre: u.nombre }));
}

/** Quién escribe esta campaña. Null si no hay nadie elegido o falta la 0175. */
export async function escribeDeCampania(campaignId: string): Promise<string | null> {
  const { data, error } = await createAdmin()
    .from("prospecting_campaigns")
    .select("escribe_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) return null;
  return (data as { escribe_id?: string | null } | null)?.escribe_id ?? null;
}
