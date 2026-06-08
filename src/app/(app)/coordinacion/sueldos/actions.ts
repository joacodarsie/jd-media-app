"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

const PATH = "/coordinacion/sueldos";

export async function addPayrollItem(input: {
  userId: string;
  periodo: string;
  tipo: "comision" | "extra" | "ajuste";
  concepto: string;
  monto: number;
  clienteId?: string | null;
  notas?: string | null;
}) {
  const me = await requireRole(["admin"]);
  if (!input.userId || !input.concepto.trim()) {
    return { error: "Faltan datos (persona y concepto)." };
  }
  if (!Number.isFinite(input.monto) || input.monto === 0) {
    return { error: "El monto debe ser distinto de cero." };
  }
  const admin = createAdmin();
  const { error } = await admin.from("payroll_items").insert({
    user_id: input.userId,
    periodo: input.periodo,
    tipo: input.tipo,
    concepto: input.concepto.trim(),
    monto: input.monto,
    cliente_id: input.clienteId ?? null,
    notas: input.notas ?? null,
    creado_por_id: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deletePayrollItem(id: string) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin.from("payroll_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** Toggle "aplica" y/o persona del media buyer de una cuenta (servicio paid_media). */
export async function setMediaBuyer(input: {
  clienteId: string;
  aplica?: boolean;
  userId?: string | null;
}) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const patch: Record<string, unknown> = {};
  if (typeof input.aplica === "boolean") patch.media_buyer_aplica = input.aplica;
  if (input.userId !== undefined) patch.media_buyer_user_id = input.userId;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await admin
    .from("client_services")
    .update(patch)
    .eq("cliente_id", input.clienteId)
    .eq("tipo", "paid_media")
    .eq("activo", true);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath("/coordinacion");
  return { ok: true };
}

/**
 * Registra el sueldo del período como un pago al equipo (Finanzas → team_payments),
 * para que entre al cashflow. Idempotente por persona+período+concepto: si ya
 * existe, no duplica.
 */
export async function registerSalaryPayment(input: {
  userId: string;
  periodo: string;
  monto: number;
  concepto: string;
}) {
  const me = await requireRole(["admin"]);
  const admin = createAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await admin
    .from("team_payments")
    .select("id")
    .eq("user_id", input.userId)
    .eq("periodo", input.periodo)
    .eq("concepto", input.concepto)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("team_payments")
      .update({ monto: input.monto })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath(PATH);
    revalidatePath("/finanzas");
    return { ok: true, updated: true };
  }

  const { error } = await admin.from("team_payments").insert({
    user_id: input.userId,
    periodo: input.periodo,
    concepto: input.concepto,
    monto: input.monto,
    moneda: "ARS",
    fecha_programada: today,
    creado_por_id: me.id,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  revalidatePath("/finanzas");
  return { ok: true };
}
