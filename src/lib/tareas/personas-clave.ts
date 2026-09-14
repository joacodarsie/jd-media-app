import { createAdmin } from "@/lib/supabase/admin";
import { AREA_DIRECTORA, AREA_PM } from "@/lib/tareas/puerta";

/**
 * Quién es hoy la Project Manager y quién la Directora Creativa.
 *
 * Se resuelve por área, como el organigrama: si mañana el puesto lo ocupa otra
 * persona, se le cambia el área en Accesos y todo sigue andando. Va por service
 * role porque lo necesita cualquiera que cree un ticket, tenga o no permiso
 * para listar al equipo.
 */
export interface PersonasClave {
  pmId: string | null;
  pmNombre: string | null;
  directoraId: string | null;
  directoraNombre: string | null;
}

export async function personasClave(): Promise<PersonasClave> {
  const { data } = await createAdmin()
    .from("users")
    .select("id, nombre, area, area_secundaria, created_at")
    .eq("activo", true)
    .or(
      `area.in.("${AREA_PM}","${AREA_DIRECTORA}"),area_secundaria.in.("${AREA_PM}","${AREA_DIRECTORA}")`
    )
    .order("created_at", { ascending: true });

  const gente = (data ?? []) as { id: string; nombre: string; area: string | null; area_secundaria: string | null }[];
  const de = (area: string) => gente.find((u) => u.area === area || u.area_secundaria === area) ?? null;
  const pm = de(AREA_PM);
  const directora = de(AREA_DIRECTORA);
  return {
    pmId: pm?.id ?? null,
    pmNombre: pm?.nombre ?? null,
    directoraId: directora?.id ?? null,
    directoraNombre: directora?.nombre ?? null,
  };
}
