"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

const PATH = "/coordinacion/jornadas";

export interface JornadaInput {
  fecha: string; // YYYY-MM-DD
  monto: number;
  clienteId?: string | null;
  lugar?: string | null;
  notas?: string | null;
  asistentes: string[];
}

function validate(input: JornadaInput): string | null {
  if (!input.fecha) return "Elegí la fecha de la jornada.";
  if (!Number.isFinite(input.monto) || input.monto <= 0)
    return "El monto cobrado debe ser mayor a cero.";
  if (!input.asistentes || input.asistentes.length === 0)
    return "Elegí al menos una persona que haya asistido.";
  return null;
}

export async function createProductionSession(input: JornadaInput) {
  const me = await requireRole(["admin"]);
  const err = validate(input);
  if (err) return { error: err };
  const admin = createAdmin();
  const { error } = await admin.from("production_sessions").insert({
    fecha: input.fecha,
    periodo: input.fecha.slice(0, 7),
    monto: input.monto,
    cliente_id: input.clienteId || null,
    lugar: input.lugar?.trim() || null,
    notas: input.notas?.trim() || null,
    asistentes: input.asistentes,
    creado_por_id: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath("/coordinacion/sueldos");
  return { ok: true };
}

export async function updateProductionSession(id: string, input: JornadaInput) {
  await requireRole(["admin"]);
  const err = validate(input);
  if (err) return { error: err };
  const admin = createAdmin();
  const { error } = await admin
    .from("production_sessions")
    .update({
      fecha: input.fecha,
      periodo: input.fecha.slice(0, 7),
      monto: input.monto,
      cliente_id: input.clienteId || null,
      lugar: input.lugar?.trim() || null,
      notas: input.notas?.trim() || null,
      asistentes: input.asistentes,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath("/coordinacion/sueldos");
  return { ok: true };
}

export async function deleteProductionSession(id: string) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin.from("production_sessions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath("/coordinacion/sueldos");
  return { ok: true };
}
