/**
 * Las ideas del calendario que nunca se produjeron vuelven a «Sin fecha»
 * (22/10/2026).
 *
 * El 22/10 había 17 ideas de julio a septiembre todavía con su fecha vieja
 * (Boxescar 9, FUNDANIC 4, Résonar 3, La Azotea 1): ninguna se iba a hacer ya,
 * pero contaban como atrasadas y tapaban los atrasos reales (CATCH con 12
 * piezas de octubre trabadas). No se borran: muchas son buenas ideas. Pasan a
 * la bandeja «Sin fecha asignada» del calendario, con una nota de para cuándo
 * eran, y desde ahí se reprograman arrastrándolas.
 *
 * Solo las que siguen en «idea» (nadie las empezó) y con más de
 * DIAS_GRACIA días de pasada la fecha. Corre en el cron diario, después de la
 * conciliación con Instagram: si una salió, ya quedó marcada como publicada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const DIAS_GRACIA = 14;

/** La fecha antes de la cual una idea ya no se va a hacer. */
export function corteIdeasViejas(hoy: string, dias = DIAS_GRACIA): string {
  const t = Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10)) - dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** La nota que queda en la pieza: «Era para el 17/07 y no salió…». */
export function notaIdeaVieja(notaPrevia: string | null, fecha: string, hoy: string): string {
  const dm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  const nueva = `Era para el ${dm(fecha)} y no salió: quedó guardada sin fecha (${dm(hoy)}).`;
  return notaPrevia?.trim() ? `${notaPrevia.trim()}\n${nueva}` : nueva;
}

export async function runIdeasViejasAlBanco(admin: SupabaseClient, hoy: string): Promise<{ movidas: number }> {
  const { data: activos } = await admin.from("clients").select("id").eq("estado", "activo");
  const ids = ((activos ?? []) as { id: string }[]).map((c) => c.id);
  if (!ids.length) return { movidas: 0 };
  const { data } = await admin
    .from("publications")
    .select("id, fecha_publicacion, notas_revision")
    .eq("estado", "idea")
    .in("cliente_id", ids)
    .lt("fecha_publicacion", corteIdeasViejas(hoy));
  const viejas = (data ?? []) as { id: string; fecha_publicacion: string; notas_revision: string | null }[];
  let movidas = 0;
  for (const p of viejas) {
    const { error } = await admin
      .from("publications")
      .update({ fecha_publicacion: null, notas_revision: notaIdeaVieja(p.notas_revision, p.fecha_publicacion.slice(0, 10), hoy) })
      .eq("id", p.id)
      .eq("estado", "idea");
    if (!error) movidas++;
  }
  return { movidas };
}
