"use server";

import { hoyYmd } from "@/lib/dates";

import { revalidatePath } from "next/cache";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * Acciones de la pantalla simple de cobros.
 *
 * Clave del diseño: la factura NO tiene que existir de antes. Si el cliente es
 * activo y tiene abono, la fila aparece igual y se crea recién cuando el dueño
 * toca algo. Antes había que "generar las facturas del mes" primero, y por eso
 * nunca se registraba un cobro: julio cerró con 15 facturas y 0 cobradas.
 */

function invalidate() {
  revalidatePath("/cobros");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/mes");
  revalidatePath("/finanzas/cobros");
}

async function ctx() {
  const me = await requireFeature("finanzas");
  return { admin: createAdmin(), userId: me.id };
}

/** Busca la factura del cliente en el período, o la crea con el abono. */
async function asegurarFactura(
  admin: ReturnType<typeof createAdmin>,
  input: { clienteId: string; periodo: string; monto: number; concepto: string; userId: string }
): Promise<{ id: string } | { error: string }> {
  const { data: existente } = await admin
    .from("client_invoices")
    .select("id")
    .eq("cliente_id", input.clienteId)
    .eq("periodo", input.periodo)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existente) return { id: (existente as { id: string }).id };

  const { data, error } = await admin
    .from("client_invoices")
    .insert({
      cliente_id: input.clienteId,
      periodo: input.periodo,
      concepto: input.concepto.slice(0, 200),
      monto: input.monto,
      moneda: "ARS",
      creado_por_id: input.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/** "Me pagó": sella la fecha de cobro de hoy (creando la factura si no estaba). */
export async function marcarCobrado(input: {
  clienteId: string;
  periodo: string;
  monto: number;
  concepto?: string;
  fecha?: string;
}) {
  const { admin, userId } = await ctx();
  const res = await asegurarFactura(admin, {
    clienteId: input.clienteId,
    periodo: input.periodo,
    monto: input.monto,
    concepto: input.concepto || `Abono ${input.periodo}`,
    userId,
  });
  if ("error" in res) return { error: res.error };

  const hoy = input.fecha ?? hoyYmd();
  const { error } = await admin
    .from("client_invoices")
    .update({ fecha_cobro: hoy, monto: input.monto })
    .eq("id", res.id);
  if (error) return { error: error.message };

  // Si la cuenta estaba ESPERANDO EL PAGO, el pago la convierte en cliente.
  // Es el único momento en que alguien pasa a contar como cliente de verdad.
  const { data: cli } = await admin
    .from("clients")
    .select("estado")
    .eq("id", input.clienteId)
    .maybeSingle();
  let activado = false;
  if ((cli as { estado?: string } | null)?.estado === "esperando_pago") {
    const { error: upErr } = await admin
      .from("clients")
      .update({ estado: "activo", fecha_activado: new Date().toISOString() })
      .eq("id", input.clienteId);
    activado = !upErr;
  }

  invalidate();
  revalidatePath("/clientes");
  return { ok: true as const, activado };
}

/** Deshace el cobro (se marcó sin querer). */
export async function desmarcarCobrado(clienteId: string, periodo: string) {
  const { admin } = await ctx();
  const { error } = await admin
    .from("client_invoices")
    .update({ fecha_cobro: null })
    .eq("cliente_id", clienteId)
    .eq("periodo", periodo);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}

/** Cambia cuánto pagó de verdad (a veces no es el abono exacto). */
export async function guardarMonto(input: {
  clienteId: string;
  periodo: string;
  monto: number;
  concepto?: string;
}) {
  const { admin, userId } = await ctx();
  const res = await asegurarFactura(admin, {
    clienteId: input.clienteId,
    periodo: input.periodo,
    monto: input.monto,
    concepto: input.concepto || `Abono ${input.periodo}`,
    userId,
  });
  if ("error" in res) return { error: res.error };
  const { error } = await admin
    .from("client_invoices")
    .update({ monto: input.monto })
    .eq("id", res.id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}

/** La anotación que hoy vive en la cabeza: "me paga el 10", "pagó la mitad". */
export async function guardarNota(input: {
  clienteId: string;
  periodo: string;
  nota: string;
  monto: number;
}) {
  const { admin, userId } = await ctx();
  const res = await asegurarFactura(admin, {
    clienteId: input.clienteId,
    periodo: input.periodo,
    monto: input.monto,
    concepto: `Abono ${input.periodo}`,
    userId,
  });
  if ("error" in res) return { error: res.error };
  const { error } = await admin
    .from("client_invoices")
    .update({ notas: input.nota.trim().slice(0, 500) || null })
    .eq("id", res.id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}
