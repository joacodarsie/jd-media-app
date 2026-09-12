"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

const PATH = "/coordinacion/jornadas";

export interface JornadaInput {
  fecha: string; // YYYY-MM-DD
  /** Precio del trabajo, sin viáticos. Sale de las horas. */
  monto: number;
  /** Duración: la primera hora vale $50.000 y cada extra $25.000. */
  horas?: number;
  /** Viáticos REALES de la jornada. Van enteros a quienes fueron. */
  viaticos?: number;
  viaticosLosPaga?: "cliente" | "agencia";
  clienteId?: string | null;
  lugar?: string | null;
  notas?: string | null;
  asistentes: string[];
}

/**
 * Columnas de 0163. Si la migración todavía no se aplicó, se guarda sin ellas
 * en vez de romper el alta.
 */
function camposDe0163(input: JornadaInput) {
  return {
    horas: input.horas != null && input.horas > 0 ? input.horas : 1,
    viaticos: input.viaticos != null && input.viaticos > 0 ? input.viaticos : 0,
    viaticos_los_paga: input.viaticosLosPaga === "cliente" ? "cliente" : "agencia",
  };
}

/** ¿El error es "esa columna no existe"? Entonces falta aplicar 0163. */
function falta0163(msg: string): boolean {
  return /column .*(horas|viaticos).* does not exist/i.test(msg) || msg.includes("PGRST204");
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
  const base = {
    fecha: input.fecha,
    periodo: input.fecha.slice(0, 7),
    monto: input.monto,
    cliente_id: input.clienteId || null,
    lugar: input.lugar?.trim() || null,
    notas: input.notas?.trim() || null,
    asistentes: input.asistentes,
    creado_por_id: me.id,
  };
  let { error } = await admin
    .from("production_sessions")
    .insert({ ...base, ...camposDe0163(input) });
  if (error && falta0163(error.message)) {
    ({ error } = await admin.from("production_sessions").insert(base));
  }
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
  const base = {
    fecha: input.fecha,
    periodo: input.fecha.slice(0, 7),
    monto: input.monto,
    cliente_id: input.clienteId || null,
    lugar: input.lugar?.trim() || null,
    notas: input.notas?.trim() || null,
    asistentes: input.asistentes,
  };
  let { error } = await admin
    .from("production_sessions")
    .update({ ...base, ...camposDe0163(input) })
    .eq("id", id);
  if (error && falta0163(error.message)) {
    ({ error } = await admin.from("production_sessions").update(base).eq("id", id));
  }
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
