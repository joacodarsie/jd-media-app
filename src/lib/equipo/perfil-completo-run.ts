/**
 * La tarea «Completá tus datos» de cada persona del equipo (19/10/2026): se
 * crea si le falta algo, la lista de lo que falta se mantiene al día y se cierra
 * sola cuando el perfil está completo. Va en el cron diario.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLAVE_TAREA_PERFIL, datosDelPerfil, type DatosPerfil } from "./perfil-completo";

export function descripcionPerfil(faltan: { titulo: string; detalle: string }[]): string {
  return [
    "Cuando armamos la plataforma nadie tenía que cargar sus datos; ahora los necesitamos de todo el equipo. Te lleva 3 minutos.",
    "",
    "**Te falta:**",
    ...faltan.map((f) => `- **${f.titulo}:** ${f.detalle}`),
    "",
    "**Dónde:** tu foto (arriba a la derecha) → **Mi perfil**.",
    "**Está hecho cuando:** está todo cargado. Se cierra sola.",
  ].join("\n");
}

export async function runPerfilesIncompletos(admin: SupabaseClient, hoy: string) {
  const { data: uRaw, error } = await admin.from("users").select("*").eq("activo", true);
  if (error) return { error: error.message };
  const users = (uRaw ?? []) as (DatosPerfil & { id: string; rol: string; area: string | null })[];
  const dueno = users.find((u) => u.rol === "admin" && u.area === "Estrategia/Dirección") ?? users.find((u) => u.rol === "admin");
  const claves = users.map((u) => CLAVE_TAREA_PERFIL(u.id));
  const { data: tRaw } = await admin.from("tasks").select("id, rutina_key, estado").in("rutina_key", claves);
  const ya = new Map(((tRaw ?? []) as { id: string; rutina_key: string; estado: string }[]).map((t) => [t.rutina_key, t]));
  const limite = new Date(Date.parse(`${hoy}T12:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);
  const r = { creadas: 0, cerradas: 0, actualizadas: 0 };

  for (const u of users) {
    if (u.id === dueno?.id) continue; // la dirección no se pide datos a sí misma
    const faltan = datosDelPerfil(u).filter((d) => !d.hecho);
    const t = ya.get(CLAVE_TAREA_PERFIL(u.id));
    const abierta = t && t.estado !== "completada" && t.estado !== "archivada";
    if (!faltan.length) {
      if (abierta) {
        await admin.from("tasks").update({ estado: "completada" }).eq("id", t!.id);
        r.cerradas++;
      }
      continue;
    }
    if (t) {
      if (abierta) {
        await admin.from("tasks").update({ descripcion: descripcionPerfil(faltan) }).eq("id", t.id);
        r.actualizadas++;
      }
      continue; // si la cerró a mano sin completar, el checklist de Mi día sigue pidiendo
    }
    const { error: e } = await admin.from("tasks").insert({
      titulo: "📝 Completá tus datos en Mi perfil",
      descripcion: descripcionPerfil(faltan),
      asignado_a_id: u.id,
      creado_por_id: dueno?.id ?? u.id,
      area: u.area ?? "Coordinación",
      prioridad: "alta",
      estado: "pendiente",
      fecha_limite: limite,
      rutina_key: CLAVE_TAREA_PERFIL(u.id),
    });
    if (!e) r.creadas++;
  }
  return r;
}
