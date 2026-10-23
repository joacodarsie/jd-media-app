/**
 * El recordatorio diario a la project manager (23/10/2026): las jornadas que ya
 * se hicieron y todavía no tienen los datos reales confirmados. Sin eso el
 * dueño no sabe qué cobrar ni qué pagar. Uno por día, con todas juntas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { AREA_PM } from "@/lib/tareas/puerta";
import { cargarJornadas } from "./cargar";
import { estadoJornada } from "./registro";

const LINK = "/jornadas?ver=completar";

export function avisoCompletar(js: { cliente: string | null; fecha: string }[]): string | null {
  if (!js.length) return null;
  const lista = js
    .slice(0, 3)
    .map((j) => `${j.cliente ?? "sin cliente"} (${j.fecha.slice(8, 10)}/${j.fecha.slice(5, 7)})`)
    .join(", ");
  const resto = js.length > 3 ? ` y ${js.length - 3} más` : "";
  return js.length === 1
    ? `✍️ Completá la jornada de ${lista}: la duración real y los viáticos de cada uno, así dirección cobra y paga.`
    : `✍️ ${js.length} jornadas para completar: ${lista}${resto}. Duración real y viáticos de cada uno.`;
}

export async function runAvisoJornadas(admin: SupabaseClient, hoy: string): Promise<{ pendientes: number; avisados: number }> {
  const pendientes = (await cargarJornadas(admin)).filter((j) => estadoJornada(j, hoy) === "completar");
  const mensaje = avisoCompletar(pendientes);
  if (!mensaje) return { pendientes: 0, avisados: 0 };
  const { data: uRaw } = await admin.from("users").select("id, area, area_secundaria").eq("activo", true);
  const pms = ((uRaw ?? []) as { id: string; area: string | null; area_secundaria: string | null }[])
    .filter((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)
    .map((u) => u.id);
  const inicioHoy = toZonedTime(new Date(`${formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd")}T00:00:00`), TIMEZONE).toISOString();
  let avisados = 0;
  for (const id of pms) {
    const { data: ya } = await admin.from("notifications").select("id").eq("user_id", id).eq("link", LINK).gte("created_at", inicioHoy).limit(1);
    if (ya?.length) continue;
    await admin.from("notifications").insert({ user_id: id, tipo: "recordatorio", mensaje, link: LINK });
    avisados++;
  }
  return { pendientes: pendientes.length, avisados };
}
