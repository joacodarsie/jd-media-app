"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

async function ctx() {
  await requireRole(["admin"]);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

function invalidate() {
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/cobros");
  revalidatePath("/finanzas/pagos");
  revalidatePath("/finanzas/movimientos");
}

// ===========================
// Invoices
// ===========================

export interface InvoiceInput {
  cliente_id: string;
  service_id?: string | null;
  periodo: string;
  concepto: string;
  monto: number;
  moneda: string;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
  notas?: string | null;
}

export async function createInvoice(input: InvoiceInput) {
  const { supabase, userId } = await ctx();
  const { error } = await supabase.from("client_invoices").insert({
    cliente_id: input.cliente_id,
    service_id: input.service_id ?? null,
    periodo: input.periodo,
    concepto: input.concepto.trim(),
    monto: input.monto,
    moneda: input.moneda || "ARS",
    fecha_emision: input.fecha_emision ?? null,
    fecha_vencimiento: input.fecha_vencimiento ?? null,
    notas: input.notas?.trim() || null,
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function updateInvoice(id: string, input: Partial<InvoiceInput>) {
  const { supabase } = await ctx();
  const patch: Record<string, unknown> = {};
  if (input.concepto !== undefined) patch.concepto = input.concepto.trim();
  if (input.monto !== undefined) patch.monto = input.monto;
  if (input.moneda !== undefined) patch.moneda = input.moneda;
  if (input.fecha_emision !== undefined) patch.fecha_emision = input.fecha_emision;
  if (input.fecha_vencimiento !== undefined) patch.fecha_vencimiento = input.fecha_vencimiento;
  if (input.notas !== undefined) patch.notas = input.notas?.trim() || null;
  const { error } = await supabase.from("client_invoices").update(patch).eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function markInvoicePaid(
  id: string,
  fecha_cobro: string,
  metodo_pago?: string | null
) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("client_invoices")
    .update({
      fecha_cobro,
      metodo_pago: metodo_pago?.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function markInvoiceUnpaid(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("client_invoices")
    .update({ fecha_cobro: null, metodo_pago: null })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function deleteInvoice(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("client_invoices").delete().eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function generateMonthlyInvoices(periodo: string) {
  const { supabase } = await ctx();
  const { data, error } = await supabase.rpc("jd_generate_invoices_for_period", {
    p_periodo: periodo,
  });
  if (error) return { error: error.message };
  invalidate();
  return { ok: true, created: data as number };
}

// ===========================
// Payments al equipo
// ===========================

export interface PaymentInput {
  user_id: string;
  periodo: string;
  concepto: string;
  monto: number;
  moneda: string;
  fecha_programada: string;
  notas?: string | null;
}

export async function createPayment(input: PaymentInput) {
  const { supabase, userId } = await ctx();
  const { error } = await supabase.from("team_payments").insert({
    user_id: input.user_id,
    periodo: input.periodo,
    concepto: input.concepto.trim(),
    monto: input.monto,
    moneda: input.moneda || "ARS",
    fecha_programada: input.fecha_programada,
    notas: input.notas?.trim() || null,
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function updatePayment(id: string, input: Partial<PaymentInput>) {
  const { supabase } = await ctx();
  const patch: Record<string, unknown> = {};
  if (input.concepto !== undefined) patch.concepto = input.concepto.trim();
  if (input.monto !== undefined) patch.monto = input.monto;
  if (input.moneda !== undefined) patch.moneda = input.moneda;
  if (input.fecha_programada !== undefined) patch.fecha_programada = input.fecha_programada;
  if (input.notas !== undefined) patch.notas = input.notas?.trim() || null;
  const { error } = await supabase.from("team_payments").update(patch).eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function markPaymentPaid(
  id: string,
  fecha_pago: string,
  metodo_pago?: string | null
) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("team_payments")
    .update({
      fecha_pago,
      metodo_pago: metodo_pago?.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function markPaymentUnpaid(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("team_payments")
    .update({ fecha_pago: null, metodo_pago: null })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function deletePayment(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("team_payments").delete().eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

export async function generateMonthlyPayments(periodo: string) {
  const { supabase } = await ctx();
  const { data, error } = await supabase.rpc("jd_generate_payments_for_period", {
    p_periodo: periodo,
  });
  if (error) return { error: error.message };
  invalidate();
  return { ok: true, created: data as number };
}
