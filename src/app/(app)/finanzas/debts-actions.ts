"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

const PATH = "/finanzas/deudas";

function invalidate() {
  revalidatePath(PATH);
  revalidatePath("/finanzas");
}

export interface DebtInput {
  acreedor: string;
  monto: number;
  moneda: string;
  detalle?: string | null;
  fecha?: string | null;
}

function clean(input: DebtInput) {
  return {
    acreedor: input.acreedor.trim(),
    monto: input.monto,
    moneda: input.moneda || "ARS",
    detalle: input.detalle?.trim() || null,
    fecha: input.fecha || null,
  };
}

function validate(input: DebtInput): string | null {
  if (!input.acreedor.trim()) return "Falta a quién le debés.";
  if (!Number.isFinite(input.monto) || input.monto <= 0) return "El monto debe ser mayor a cero.";
  return null;
}

export async function addDebt(input: DebtInput) {
  await requireRole(["admin"]);
  const err = validate(input);
  if (err) return { error: err };
  const admin = createAdmin();
  const { error } = await admin.from("debts").insert(clean(input));
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function updateDebt(id: string, input: DebtInput) {
  await requireRole(["admin"]);
  const err = validate(input);
  if (err) return { error: err };
  const admin = createAdmin();
  const { error } = await admin.from("debts").update(clean(input)).eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function deleteDebt(id: string) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin.from("debts").delete().eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function toggleDebtSaldada(id: string, saldada: boolean) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin
    .from("debts")
    .update({
      saldada,
      fecha_saldada: saldada ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}
