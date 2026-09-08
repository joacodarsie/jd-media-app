"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { reasignarTareasDeCuenta } from "@/lib/tareas/reasignar-run";
import {
  anotarPaseDeCuenta,
  ROLES_CON_HISTORIAL,
} from "@/lib/payroll/asignaciones-run";

const PATHS = ["/coordinacion/equipos", "/clientes", "/contenidos"];
type Result = { ok: true; id?: string; tareasReasignadas?: number } | { ok: false; error: string };

function revalidateAll() {
  for (const p of PATHS) revalidatePath(p);
}

export async function createTeam(nombre: string): Promise<Result> {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const { data: last } = await admin
    .from("teams")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await admin
    .from("teams")
    .insert({
      nombre: nombre.trim() || "Equipo nuevo",
      orden: ((last as { orden?: number } | null)?.orden ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true, id: data.id };
}

export async function updateTeam(input: {
  id: string;
  nombre?: string;
  cm_id?: string | null;
  disenador_id?: string | null;
  audiovisual_id?: string | null;
  media_buyer_id?: string | null;
  notas?: string | null;
}): Promise<Result> {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const { id, ...fields } = input;
  const { error } = await admin.from("teams").update(fields).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

export async function deleteTeam(id: string): Promise<Result> {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  // clients.team_id tiene on delete set null → los clientes quedan sin equipo.
  const { error } = await admin.from("teams").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateAll();
  return { ok: true };
}

/**
 * Asigna un cliente a un equipo (o lo saca con null). Si `aplicarEquipo` es
 * true, además pisa el equipo de la cuenta (cm/diseño/edición/paid del cliente)
 * con los miembros del equipo — así el calendario, las tareas automáticas y la
 * nómina siguen al equipo.
 */
export async function assignClientTeam(input: {
  clienteId: string;
  teamId: string | null;
  aplicarEquipo?: boolean;
}): Promise<Result> {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();

  const patch: Record<string, unknown> = { team_id: input.teamId };
  if (input.teamId && input.aplicarEquipo) {
    const { data: team } = await admin
      .from("teams")
      .select("cm_id, disenador_id, audiovisual_id, media_buyer_id")
      .eq("id", input.teamId)
      .single();
    if (team) {
      const t = team as {
        cm_id: string | null;
        disenador_id: string | null;
        audiovisual_id: string | null;
        media_buyer_id: string | null;
      };
      if (t.cm_id) patch.cm_id = t.cm_id;
      if (t.disenador_id) patch.disenador_id = t.disenador_id;
      if (t.audiovisual_id) patch.audiovisual_id = t.audiovisual_id;
      if (t.media_buyer_id) patch.media_buyer_id = t.media_buyer_id;
    }
  }
  // Quiénes la llevaban antes, para anotar el pase y no reescribir los sueldos
  // de los meses ya cerrados.
  const { data: antes } = await admin
    .from("clients")
    .select("cm_id, media_buyer_id, fecha_inicio")
    .eq("id", input.clienteId)
    .maybeSingle();

  const { error } = await admin.from("clients").update(patch).eq("id", input.clienteId);
  if (error) return { ok: false, error: error.message };

  if (antes) {
    const previo = antes as {
      cm_id: string | null;
      media_buyer_id: string | null;
      fecha_inicio: string | null;
    };
    for (const { rol, campo } of ROLES_CON_HISTORIAL) {
      const nuevo = patch[campo] as string | null | undefined;
      if (nuevo === undefined) continue;
      const viejo = previo[campo as "cm_id" | "media_buyer_id"];
      if ((nuevo ?? null) === (viejo ?? null)) continue;
      await anotarPaseDeCuenta(admin, {
        clienteId: input.clienteId,
        rol,
        nuevoUserId: nuevo ?? null,
        anteriorUserId: viejo,
        clienteDesde: previo.fecha_inicio,
        nota: "pase al aplicar un equipo",
      });
    }
  }

  // Al aplicar el equipo, las tareas abiertas de la cuenta pasan a sus nuevos
  // responsables (si no, siguen a nombre del equipo anterior).
  const { movidas } = await reasignarTareasDeCuenta(input.clienteId, { admin });
  revalidateAll();
  return { ok: true, tareasReasignadas: movidas };
}
