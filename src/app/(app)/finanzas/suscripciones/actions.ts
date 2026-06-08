"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/auth";
import { currentPeriod } from "@/lib/finanzas";
import type { ExpenseCategory } from "@/app/(app)/finanzas/actions";

async function ctx() {
  await requireFeature("finanzas");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

const PATH = "/finanzas/suscripciones";

export type SubscriptionCiclo = "mensual" | "trimestral" | "anual";

export interface SubscriptionInput {
  nombre: string;
  categoria: ExpenseCategory;
  costo: number;
  moneda: string;
  ciclo: SubscriptionCiclo;
  proxima_renovacion?: string | null;
  metodo_pago?: string | null;
  administrador_id?: string | null;
  url?: string | null;
  activa: boolean;
  notas?: string | null;
}

export async function createSubscription(input: SubscriptionInput) {
  const { supabase, userId } = await ctx();
  if (!input.nombre.trim()) return { error: "Poné un nombre." };
  if (!Number.isFinite(input.costo) || input.costo <= 0) return { error: "Costo inválido." };
  const { error } = await supabase.from("subscriptions").insert({
    nombre: input.nombre.trim(),
    categoria: input.categoria,
    costo: input.costo,
    moneda: input.moneda || "ARS",
    ciclo: input.ciclo,
    proxima_renovacion: input.proxima_renovacion || null,
    metodo_pago: input.metodo_pago?.trim() || null,
    administrador_id: input.administrador_id || null,
    url: input.url?.trim() || null,
    activa: input.activa,
    notas: input.notas?.trim() || null,
    creado_por_id: userId,
  });
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function updateSubscription(id: string, input: SubscriptionInput) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("subscriptions")
    .update({
      nombre: input.nombre.trim(),
      categoria: input.categoria,
      costo: input.costo,
      moneda: input.moneda || "ARS",
      ciclo: input.ciclo,
      proxima_renovacion: input.proxima_renovacion || null,
      metodo_pago: input.metodo_pago?.trim() || null,
      administrador_id: input.administrador_id || null,
      url: input.url?.trim() || null,
      activa: input.activa,
      notas: input.notas?.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteSubscription(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

function addCycle(dateStr: string | null, ciclo: SubscriptionCiclo): string {
  const base = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const d = new Date(base);
  if (ciclo === "mensual") d.setMonth(d.getMonth() + 1);
  else if (ciclo === "trimestral") d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Registra el pago de una suscripción como un gasto del mes (entra al cashflow)
 * y avanza la próxima renovación según el ciclo. Idempotente por concepto+período.
 */
export async function registerSubscriptionPayment(id: string) {
  const { supabase, userId } = await ctx();
  const { data: sub, error: e0 } = await supabase
    .from("subscriptions")
    .select("id, nombre, categoria, costo, moneda, ciclo, proxima_renovacion")
    .eq("id", id)
    .maybeSingle();
  if (e0) return { error: e0.message };
  if (!sub) return { error: "No se encontró la suscripción." };

  const periodo = currentPeriod();
  const today = new Date().toISOString().slice(0, 10);
  const concepto = `Suscripción ${sub.nombre} (${periodo})`;

  const { data: existing } = await supabase
    .from("expenses")
    .select("id")
    .eq("concepto", concepto)
    .eq("periodo", periodo)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("expenses").insert({
      categoria: sub.categoria,
      proveedor: sub.nombre,
      concepto,
      monto: sub.costo,
      moneda: sub.moneda,
      periodo,
      fecha_pago: today,
      recurrente: true,
      creado_por_id: userId,
    });
    if (error) return { error: error.message };
  }

  // Avanzar la próxima renovación según el ciclo.
  const next = addCycle(
    sub.proxima_renovacion as string | null,
    sub.ciclo as SubscriptionCiclo
  );
  await supabase.from("subscriptions").update({ proxima_renovacion: next }).eq("id", id);

  revalidatePath(PATH);
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/gastos");
  return { ok: true, dup: !!existing };
}
