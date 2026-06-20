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

/**
 * Registra un pago parcial/total de una deuda: descuenta `monto` del saldo
 * restante. Si llega a 0, la marca saldada. No genera un gasto operativo (la
 * devolución de una deuda no es un costo de la agencia; solo baja lo que debés).
 */
export async function quickPayDebt(id: string, monto: number) {
  await requireRole(["admin"]);
  if (!Number.isFinite(monto) || monto <= 0) return { error: "Monto inválido." };
  const admin = createAdmin();
  const { data: debt, error: e0 } = await admin
    .from("debts")
    .select("monto")
    .eq("id", id)
    .maybeSingle();
  if (e0) return { error: e0.message };
  if (!debt) return { error: "No se encontró la deuda." };
  const restante = Math.max(0, Number(debt.monto) - monto);
  const { error } = await admin
    .from("debts")
    .update({
      monto: restante,
      saldada: restante <= 0,
      fecha_saldada: restante <= 0 ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true, restante };
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
