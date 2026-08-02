"use server";

import { hoyYmd } from "@/lib/dates";

import { revalidatePath } from "next/cache";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * Acciones de los recordatorios de cobro. Todo es POR PERÍODO: lo que se edita
 * o se saca en julio no afecta a agosto.
 */

async function ctx() {
  const me = await requireFeature("finanzas");
  return { admin: createAdmin(), userId: me.id };
}

function invalidate() {
  revalidatePath("/finanzas/cobros");
  revalidatePath("/cobros");
}

function faltaMigracion(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

/** Guarda el texto editado a mano para que sobreviva a la recarga. */
export async function guardarMensajeRecordatorio(input: {
  periodo: string;
  grupoKey: string;
  mensaje: string;
}) {
  const { admin, userId } = await ctx();
  const { error } = await admin.from("payment_reminder_overrides").upsert(
    {
      periodo: input.periodo,
      grupo_key: input.grupoKey,
      mensaje: input.mensaje.slice(0, 4000),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "periodo,grupo_key" }
  );
  if (error) {
    if (faltaMigracion(error)) return { error: "Falta aplicar la migración 0147." };
    return { error: error.message };
  }
  invalidate();
  return { ok: true as const };
}

/** Vuelve al texto generado automáticamente (borra la edición). */
export async function restaurarMensajeRecordatorio(periodo: string, grupoKey: string) {
  const { admin } = await ctx();
  const { error } = await admin
    .from("payment_reminder_overrides")
    .update({ mensaje: null })
    .eq("periodo", periodo)
    .eq("grupo_key", grupoKey);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}

/** Saca (o vuelve a poner) un recordatorio de la lista de este mes. */
export async function ocultarRecordatorio(input: {
  periodo: string;
  grupoKey: string;
  oculto: boolean;
}) {
  const { admin, userId } = await ctx();
  const { error } = await admin.from("payment_reminder_overrides").upsert(
    {
      periodo: input.periodo,
      grupo_key: input.grupoKey,
      oculto: input.oculto,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "periodo,grupo_key" }
  );
  if (error) {
    if (faltaMigracion(error)) return { error: "Falta aplicar la migración 0147." };
    return { error: error.message };
  }
  invalidate();
  return { ok: true as const };
}

/**
 * "Ya cobré": marca cobradas las facturas del período de todas las cuentas del
 * grupo y saca el recordatorio de la lista. Si alguna cuenta no tenía factura
 * emitida, la crea — mismo criterio que la pantalla simple de cobros.
 */
export async function marcarGrupoCobrado(input: {
  periodo: string;
  grupoKey: string;
  clienteIds: string[];
}) {
  const { admin, userId } = await ctx();
  const hoy = hoyYmd();

  const { data: existentes } = await admin
    .from("client_invoices")
    .select("id, cliente_id")
    .eq("periodo", input.periodo)
    .in("cliente_id", input.clienteIds);

  const conFactura = new Set(
    ((existentes ?? []) as { cliente_id: string }[]).map((i) => i.cliente_id)
  );

  // Las que ya tenían factura: sellar la fecha de cobro.
  if (existentes?.length) {
    const { error } = await admin
      .from("client_invoices")
      .update({ fecha_cobro: hoy })
      .in(
        "id",
        (existentes as { id: string }[]).map((i) => i.id)
      );
    if (error) return { error: error.message };
  }

  // Las que no: crearla ya cobrada con el abono de la ficha.
  const faltantes = input.clienteIds.filter((id) => !conFactura.has(id));
  if (faltantes.length) {
    const { data: clientes } = await admin
      .from("clients")
      .select("id, monto_mensual")
      .in("id", faltantes);
    const filas = ((clientes ?? []) as { id: string; monto_mensual: number | null }[]).map(
      (c) => ({
        cliente_id: c.id,
        periodo: input.periodo,
        concepto: `Abono ${input.periodo}`,
        monto: Number(c.monto_mensual ?? 0),
        moneda: "ARS",
        fecha_cobro: hoy,
        creado_por_id: userId,
      })
    );
    if (filas.length) {
      const { error } = await admin.from("client_invoices").insert(filas);
      if (error) return { error: error.message };
    }
  }

  // Cobrado = no hay que mandarle recordatorio.
  await ocultarRecordatorio({
    periodo: input.periodo,
    grupoKey: input.grupoKey,
    oculto: true,
  });

  invalidate();
  return { ok: true as const, cobradas: input.clienteIds.length };
}
