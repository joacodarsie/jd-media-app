"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireFeature } from "@/lib/auth";
import { mergeSettings } from "@/lib/coordinacion";
import { nextPeriod } from "@/lib/finanzas";

async function ctx() {
  await requireFeature("finanzas");
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
  const { supabase, userId } = await ctx();
  const { data, error } = await supabase.rpc("jd_generate_invoices_for_period", {
    p_periodo: periodo,
  });
  if (error) return { error: error.message };

  // Además del abono mensual: la PUESTA EN MARCHA (pago único de arranque) para
  // los clientes cuyo PRIMER mes es este período (fecha_inicio en el rango) y
  // que tienen gestión de redes. Idempotente: no duplica si ya existe.
  let arranque = 0;
  try {
    arranque = await addPuestaEnMarchaInvoices(periodo, userId);
  } catch (e) {
    console.warn("puesta en marcha invoices:", (e as Error).message);
  }

  invalidate();
  return { ok: true, created: (data as number) + arranque };
}

async function addPuestaEnMarchaInvoices(periodo: string, userId: string): Promise<number> {
  const admin = createAdmin();
  const { data: settingsRow } = await admin
    .from("agency_settings")
    .select("packs, rates")
    .eq("id", 1)
    .maybeSingle();
  const puesta = mergeSettings(settingsRow).rates.puesta_en_marcha ?? 0;
  if (puesta <= 0) return 0;

  const start = `${periodo}-01`;
  const end = `${nextPeriod(periodo)}-01`;
  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, contrato_moneda, fecha_inicio")
    .eq("estado", "activo")
    .eq("es_interno", false)
    .gte("fecha_inicio", start)
    .lt("fecha_inicio", end);
  const list = (clientsRaw ?? []) as {
    id: string;
    nombre: string;
    contrato_moneda: string | null;
    fecha_inicio: string | null;
  }[];
  if (list.length === 0) return 0;

  const ids = list.map((c) => c.id);
  // Solo los que tienen gestión de redes activa (la puesta en marcha es de ese servicio).
  const { data: svcs } = await admin
    .from("client_services")
    .select("cliente_id")
    .in("cliente_id", ids)
    .eq("tipo", "gestion_redes")
    .eq("activo", true);
  const conGestion = new Set(((svcs ?? []) as { cliente_id: string }[]).map((s) => s.cliente_id));

  // Los que ya tienen su invoice de puesta en marcha este período (no duplicar).
  const { data: existing } = await admin
    .from("client_invoices")
    .select("cliente_id")
    .in("cliente_id", ids)
    .eq("periodo", periodo)
    .ilike("concepto", "Puesta en marcha%");
  const yaTienen = new Set(((existing ?? []) as { cliente_id: string }[]).map((i) => i.cliente_id));

  let count = 0;
  for (const c of list) {
    if (!conGestion.has(c.id) || yaTienen.has(c.id)) continue;
    const fecha = (c.fecha_inicio ?? start).slice(0, 10);
    const { error } = await admin.from("client_invoices").insert({
      cliente_id: c.id,
      service_id: null,
      periodo,
      concepto: `Puesta en marcha — ${c.nombre}`,
      monto: puesta,
      moneda: c.contrato_moneda || "ARS",
      fecha_emision: fecha,
      fecha_vencimiento: fecha,
      creado_por_id: userId,
    });
    if (!error) count++;
    else console.warn("insert puesta en marcha:", error.message);
  }
  return count;
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
  cliente_id?: string | null;
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
    cliente_id: input.cliente_id ?? null,
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
  if (input.cliente_id !== undefined) patch.cliente_id = input.cliente_id;
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

// ===========================
// Expenses (gastos operativos)
// ===========================

export type ExpenseCategory =
  | "plataformas"
  | "ads"
  | "servicios"
  | "impuestos"
  | "bancos"
  | "oficina"
  | "equipamiento"
  | "otros";

export interface ExpenseInput {
  categoria: ExpenseCategory;
  proveedor?: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  periodo: string;
  fecha_programada?: string | null;
  fecha_pago?: string | null;
  metodo_pago?: string | null;
  recurrente?: boolean;
  notas?: string | null;
  cliente_id?: string | null;
}

export async function createExpense(input: ExpenseInput) {
  const { supabase, userId } = await ctx();
  const { error } = await supabase.from("expenses").insert({
    categoria: input.categoria,
    proveedor: input.proveedor?.trim() || null,
    concepto: input.concepto.trim(),
    monto: input.monto,
    moneda: input.moneda || "ARS",
    periodo: input.periodo,
    fecha_programada: input.fecha_programada ?? null,
    fecha_pago: input.fecha_pago ?? null,
    metodo_pago: input.metodo_pago?.trim() || null,
    recurrente: input.recurrente ?? false,
    notas: input.notas?.trim() || null,
    cliente_id: input.cliente_id ?? null,
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  invalidate();
  revalidatePath("/finanzas/gastos");
  return { ok: true };
}

export async function updateExpense(id: string, input: Partial<ExpenseInput>) {
  const { supabase } = await ctx();
  const patch: Record<string, unknown> = {};
  if (input.categoria !== undefined) patch.categoria = input.categoria;
  if (input.proveedor !== undefined) patch.proveedor = input.proveedor?.trim() || null;
  if (input.concepto !== undefined) patch.concepto = input.concepto.trim();
  if (input.monto !== undefined) patch.monto = input.monto;
  if (input.moneda !== undefined) patch.moneda = input.moneda;
  if (input.fecha_programada !== undefined) patch.fecha_programada = input.fecha_programada;
  if (input.recurrente !== undefined) patch.recurrente = input.recurrente;
  if (input.notas !== undefined) patch.notas = input.notas?.trim() || null;
  if (input.cliente_id !== undefined) patch.cliente_id = input.cliente_id;
  const { error } = await supabase.from("expenses").update(patch).eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  revalidatePath("/finanzas/gastos");
  return { ok: true };
}

export async function markExpensePaid(id: string, fecha_pago: string, metodo_pago?: string | null) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("expenses")
    .update({ fecha_pago, metodo_pago: metodo_pago?.trim() || null })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  revalidatePath("/finanzas/gastos");
  return { ok: true };
}

export async function markExpenseUnpaid(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("expenses")
    .update({ fecha_pago: null, metodo_pago: null })
    .eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  revalidatePath("/finanzas/gastos");
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  invalidate();
  revalidatePath("/finanzas/gastos");
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

// ===========================
// Carga rápida (widget flotante, solo admin)
// ===========================

export interface QuickPendingItem {
  id: string;
  concepto: string;
  monto: number;
  moneda: string;
  fecha: string | null; // vencimiento (cobros) / programada (pagos)
}

/** Facturas pendientes de cobro de un cliente, para saldar en un toque. */
export async function quickClientPending(
  cliente_id: string
): Promise<QuickPendingItem[]> {
  const { supabase } = await ctx();
  const { data } = await supabase
    .from("client_invoices")
    .select("id, concepto, monto, moneda, fecha_vencimiento")
    .eq("cliente_id", cliente_id)
    .is("fecha_cobro", null)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
  return (data ?? []).map((i) => ({
    id: i.id as string,
    concepto: i.concepto as string,
    monto: Number(i.monto),
    moneda: i.moneda as string,
    fecha: (i.fecha_vencimiento as string | null) ?? null,
  }));
}

/** Pagos pendientes a una persona del equipo, para saldar en un toque. */
export async function quickUserPending(
  user_id: string
): Promise<QuickPendingItem[]> {
  const { supabase } = await ctx();
  const { data } = await supabase
    .from("team_payments")
    .select("id, concepto, monto, moneda, fecha_programada")
    .eq("user_id", user_id)
    .is("fecha_pago", null)
    .order("fecha_programada", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    concepto: p.concepto as string,
    monto: Number(p.monto),
    moneda: p.moneda as string,
    fecha: (p.fecha_programada as string | null) ?? null,
  }));
}

/** Registra un cobro nuevo ya cobrado (entra al cashflow del día). */
export async function quickIncome(input: {
  cliente_id: string;
  monto: number;
  moneda: string;
  concepto: string;
  fecha: string;
}) {
  const { supabase, userId } = await ctx();
  if (!Number.isFinite(input.monto) || input.monto <= 0)
    return { error: "Monto inválido." };
  const { error } = await supabase.from("client_invoices").insert({
    cliente_id: input.cliente_id,
    periodo: input.fecha.slice(0, 7),
    concepto: input.concepto.trim() || "Cobro",
    monto: input.monto,
    moneda: input.moneda || "ARS",
    fecha_emision: input.fecha,
    fecha_cobro: input.fecha, // ya cobrado
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

/** Registra un pago nuevo al equipo, ya pagado. */
export async function quickTeamPay(input: {
  user_id: string;
  monto: number;
  moneda: string;
  concepto: string;
  fecha: string;
}) {
  const { supabase, userId } = await ctx();
  if (!Number.isFinite(input.monto) || input.monto <= 0)
    return { error: "Monto inválido." };
  const { error } = await supabase.from("team_payments").insert({
    user_id: input.user_id,
    periodo: input.fecha.slice(0, 7),
    concepto: input.concepto.trim() || "Pago",
    monto: input.monto,
    moneda: input.moneda || "ARS",
    fecha_programada: input.fecha,
    fecha_pago: input.fecha, // ya pagado
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

/** Registra un gasto nuevo, ya pagado. */
export async function quickExpensePaid(input: {
  categoria: ExpenseCategory;
  proveedor?: string | null;
  concepto: string;
  monto: number;
  moneda: string;
  fecha: string;
  cliente_id?: string | null;
}) {
  if (!Number.isFinite(input.monto) || input.monto <= 0)
    return { error: "Monto inválido." };
  return createExpense({
    categoria: input.categoria,
    proveedor: input.proveedor ?? null,
    concepto: input.concepto.trim() || "Gasto",
    monto: input.monto,
    moneda: input.moneda || "ARS",
    periodo: input.fecha.slice(0, 7),
    fecha_programada: input.fecha,
    fecha_pago: input.fecha, // ya pagado
    cliente_id: input.cliente_id ?? null,
  });
}
