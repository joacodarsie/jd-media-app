/** Escribe en el historial de una jornada (ver cambios.ts y la migración 0218). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtARS } from "@/lib/finanzas";
import { cambiosJornada, type FilaJornada, type Nombres } from "./cambios";

export async function nombresParaHistorial(admin: SupabaseClient): Promise<Nombres> {
  const [{ data: u }, { data: c }] = await Promise.all([admin.from("users").select("id, nombre"), admin.from("clients").select("id, nombre")]);
  const users = new Map(((u ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre.split(" ")[0]]));
  const clientes = new Map(((c ?? []) as { id: string; nombre: string }[]).map((x) => [x.id, x.nombre]));
  return { persona: (id) => users.get(id) ?? "alguien", cliente: (id) => clientes.get(id) ?? "otro cliente", plata: fmtARS };
}

export async function anotar(admin: SupabaseClient, sessionId: string, userId: string | null, accion: string, detalle: string[] = []) {
  await admin.from("production_session_cambios").insert({ session_id: sessionId, user_id: userId, accion, detalle });
}

/** Compara la fila de antes con la de después y anota solo si algo cambió. */
export async function anotarCambios(admin: SupabaseClient, sessionId: string, userId: string | null, accion: string, antes: FilaJornada, despues: FilaJornada) {
  const detalle = cambiosJornada(antes, despues, await nombresParaHistorial(admin));
  if (detalle.length) await anotar(admin, sessionId, userId, accion, detalle);
}
