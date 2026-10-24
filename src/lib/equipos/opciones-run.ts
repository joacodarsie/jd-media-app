/** Los equipos para el formulario de la cuenta, con cuántas cuentas activas tiene cada uno. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { opcionesDeEquipo, type CuentaDeEquipo, type EquipoBase, type EquipoOpcion } from "./equipos";

export async function cargarOpcionesEquipo(admin: SupabaseClient): Promise<EquipoOpcion[]> {
  const [{ data: t, error }, { data: c }] = await Promise.all([
    admin.from("teams").select("id, nombre, tope, cm_id, disenador_id, audiovisual_id, media_buyer_id, extra_ids").order("orden"),
    admin.from("clients").select("id, nombre, team_id, cm_id, disenador_id, audiovisual_id, media_buyer_id").eq("estado", "activo").eq("es_interno", false),
  ]);
  if (error) return [];
  const equipos = ((t ?? []) as EquipoBase[]).map((e) => ({ ...e, tope: e.tope ?? 8, extra_ids: e.extra_ids ?? [] }));
  return opcionesDeEquipo(equipos, (c ?? []) as CuentaDeEquipo[]);
}
