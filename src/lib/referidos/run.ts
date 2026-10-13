/**
 * El ejecutor de los referidos (13/10/2026): lo corre el cron diario.
 *
 * 1. Pendiente → ganado: el recomendado ya pagó dos meses.
 * 2. Ganado → aplicado: en el primer mes DESPUÉS de ganarlo, el 10% sale como
 *    una línea negativa en las facturas del que recomendó («Descuento por
 *    recomendar a X»). Cobros la suma sola al total del mes.
 *
 * Tolera que la migración 0198 no esté: sin la tabla, no hace nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PCT_RECOMENDADO, clienteQueRecomendo, conceptoDescuento, descuentoReferido, estaGanado } from "./referidos";

type Referido = {
  id: string;
  recomienda_id: string;
  nuevo_id: string;
  estado: "pendiente" | "ganado" | "aplicado";
  ganado_at: string | null;
};

export async function actualizarReferidos(admin: SupabaseClient): Promise<{ ganados: number }> {
  const { data, error } = await admin.from("referidos").select("id, nuevo_id").eq("estado", "pendiente");
  if (error || !data?.length) return { ganados: 0 };
  const pendientes = data as { id: string; nuevo_id: string }[];
  const { data: pagas } = await admin
    .from("client_invoices")
    .select("cliente_id, periodo")
    .in(
      "cliente_id",
      pendientes.map((r) => r.nuevo_id)
    )
    .not("fecha_cobro", "is", null)
    .not("service_id", "is", null)
    .gt("monto", 0);
  const periodos = new Map<string, string[]>();
  for (const f of (pagas ?? []) as { cliente_id: string; periodo: string }[]) {
    periodos.set(f.cliente_id, [...(periodos.get(f.cliente_id) ?? []), f.periodo]);
  }
  let ganados = 0;
  for (const r of pendientes) {
    if (!estaGanado(periodos.get(r.nuevo_id) ?? [])) continue;
    const { error: e } = await admin
      .from("referidos")
      .update({ estado: "ganado", ganado_at: new Date().toISOString() })
      .eq("id", r.id)
      .eq("estado", "pendiente");
    if (!e) ganados++;
  }
  return { ganados };
}

/** El período (YYYY-MM, hora de Córdoba) de un timestamp. */
function periodoDe(iso: string): string {
  return new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 7);
}

export async function aplicarDescuentos(
  admin: SupabaseClient,
  periodo: string
): Promise<{ aplicados: number }> {
  const { data, error } = await admin
    .from("referidos")
    .select("id, recomienda_id, nuevo_id, estado, ganado_at, nuevo:clients!referidos_nuevo_id_fkey(nombre)")
    .eq("estado", "ganado");
  if (error || !data?.length) return { aplicados: 0 };
  const ganados = (data as unknown as (Referido & { nuevo: { nombre: string } | null })[])
    // "En su próxima factura": nunca en el mes en que lo ganó (esa factura ya
    // salió y capaz ya la pagó).
    .filter((r) => r.ganado_at && periodoDe(r.ganado_at) < periodo);
  if (!ganados.length) return { aplicados: 0 };

  const { data: facturas } = await admin
    .from("client_invoices")
    .select("cliente_id, monto, moneda, fecha_vencimiento")
    .eq("periodo", periodo)
    .in(
      "cliente_id",
      [...new Set(ganados.map((r) => r.recomienda_id))]
    )
    .not("service_id", "is", null)
    .gt("monto", 0);
  const abono = new Map<string, { monto: number; moneda: string; vence: string | null }>();
  for (const f of (facturas ?? []) as { cliente_id: string; monto: number; moneda: string | null; fecha_vencimiento: string | null }[]) {
    const a = abono.get(f.cliente_id) ?? { monto: 0, moneda: f.moneda ?? "ARS", vence: f.fecha_vencimiento };
    a.monto += Number(f.monto);
    abono.set(f.cliente_id, a);
  }

  let aplicados = 0;
  for (const r of ganados) {
    const a = abono.get(r.recomienda_id);
    // Sin factura este mes (pausado, se fue o todavía no se generó): espera.
    if (!a) continue;
    const monto = descuentoReferido(a.monto);
    if (monto <= 0) continue;
    // Primero se marca (con el estado como candado), después la factura: si
    // el cron corre dos veces a la vez, solo uno la crea.
    const { data: tomado } = await admin
      .from("referidos")
      .update({ estado: "aplicado", aplicado_periodo: periodo, monto_descuento: monto })
      .eq("id", r.id)
      .eq("estado", "ganado")
      .select("id");
    if (!tomado?.length) continue;
    const { data: inv, error: e } = await admin
      .from("client_invoices")
      .insert({
        cliente_id: r.recomienda_id,
        service_id: null,
        periodo,
        concepto: conceptoDescuento(r.nuevo?.nombre ?? "un cliente", periodo),
        monto: -monto,
        moneda: a.moneda,
        fecha_emision: `${periodo}-01`,
        fecha_vencimiento: a.vence,
      })
      .select("id")
      .single();
    if (e || !inv) {
      // Si la factura no salió, vuelve a quedar para la próxima corrida.
      await admin.from("referidos").update({ estado: "ganado", aplicado_periodo: null, monto_descuento: null }).eq("id", r.id);
      continue;
    }
    await admin.from("referidos").update({ invoice_id: (inv as { id: string }).id }).eq("id", r.id);
    aplicados++;
  }
  return { aplicados };
}

/**
 * Anota quién recomendó a una cuenta (o lo borra con `recomiendaId` null). Si
 * la cuenta nueva no tiene otro descuento cargado, le pone el 10% del primer
 * mes. Un referido que ya se ganó no se toca: el descuento ya es del otro.
 */
export async function registrarReferido(
  admin: SupabaseClient,
  nuevoId: string,
  recomiendaId: string | null
): Promise<{ ok: true } | { error: string }> {
  const { data: actual, error: e0 } = await admin
    .from("referidos")
    .select("id, recomienda_id, estado")
    .eq("nuevo_id", nuevoId)
    .maybeSingle();
  if (e0) return { error: "Falta aplicar la migración 0198 (referidos)." };
  const a = actual as { id: string; recomienda_id: string; estado: string } | null;
  if (a && a.estado !== "pendiente" && a.recomienda_id !== recomiendaId) {
    return { error: "Ese descuento ya se le dio a quien lo recomendó: no se puede cambiar." };
  }
  if (!recomiendaId) {
    if (a) await admin.from("referidos").delete().eq("id", a.id);
    return { ok: true };
  }
  if (recomiendaId === nuevoId) return { error: "Una cuenta no se puede recomendar a sí misma." };
  if (a) {
    if (a.recomienda_id !== recomiendaId) {
      await admin.from("referidos").update({ recomienda_id: recomiendaId }).eq("id", a.id);
    }
  } else {
    const { error } = await admin.from("referidos").insert({ recomienda_id: recomiendaId, nuevo_id: nuevoId });
    if (error) return { error: error.message };
  }

  await asegurarDescuentoNuevo(admin, nuevoId);
  return { ok: true };
}

/**
 * Lo que hay que restarle al recordatorio de cobro de cada cliente en el mes:
 * el descuento ya aplicado ese mes, o el 10% por cada referido ganado que
 * todavía espera su factura. Así el WhatsApp pide lo mismo que dice Cobros.
 */
export async function descuentosParaRecordatorio(
  admin: SupabaseClient,
  periodo: string
): Promise<Map<string, (montoDelMes: number) => number>> {
  const out = new Map<string, (m: number) => number>();
  const { data, error } = await admin
    .from("referidos")
    .select("recomienda_id, estado, ganado_at, aplicado_periodo, monto_descuento")
    .in("estado", ["ganado", "aplicado"]);
  if (error || !data) return out;
  const fijo = new Map<string, number>();
  const pendientes = new Map<string, number>();
  for (const r of data as { recomienda_id: string; estado: string; ganado_at: string | null; aplicado_periodo: string | null; monto_descuento: number | null }[]) {
    if (r.estado === "aplicado" && r.aplicado_periodo === periodo) {
      fijo.set(r.recomienda_id, (fijo.get(r.recomienda_id) ?? 0) + Number(r.monto_descuento ?? 0));
    } else if (r.estado === "ganado" && r.ganado_at && periodoDe(r.ganado_at) < periodo) {
      pendientes.set(r.recomienda_id, (pendientes.get(r.recomienda_id) ?? 0) + 1);
    }
  }
  for (const id of new Set([...fijo.keys(), ...pendientes.keys()])) {
    out.set(id, (m) => Math.max(0, m - (fijo.get(id) ?? 0) - (pendientes.get(id) ?? 0) * descuentoReferido(m)));
  }
  return out;
}

/**
 * Con lo que cargaron en «¿De dónde vino?»: si es un referido de un cliente,
 * lo anota (y le pone el 10% al nuevo); si dejó de serlo, lo borra. Lo llaman
 * el alta y la edición de la ficha y la propuesta. Nunca rompe el guardado.
 */
export async function sincronizarReferido(
  admin: SupabaseClient,
  clienteId: string,
  origen: string | null | undefined,
  detalle: string | null | undefined
): Promise<void> {
  try {
    if (origen === undefined) return;
    let recomienda: string | null = null;
    if (origen === "referido") {
      const { data } = await admin
        .from("clients")
        .select("id, nombre")
        .eq("estado", "activo")
        .eq("es_interno", false)
        .neq("id", clienteId);
      recomienda = clienteQueRecomendo(detalle, (data ?? []) as { id: string; nombre: string }[]);
    }
    await registrarReferido(admin, clienteId, recomienda);
  } catch {
    // El referido es un extra: la ficha se guarda igual.
  }
}

/**
 * El 10% del primer mes del recomendado, salvo que ya tenga otro descuento.
 * Solo cuando la cuenta ya tiene fecha de inicio (una propuesta no la tiene, y
 * un descuento "por 1 mes" sin fecha quedaría para siempre). Lo corre también
 * el cron diario, ANTES de armar las facturas, para las propuestas que arrancan.
 */
export async function asegurarDescuentoNuevo(admin: SupabaseClient, soloNuevoId?: string): Promise<void> {
  let q = admin.from("referidos").select("id, nuevo_id").eq("descuento_nuevo", false);
  if (soloNuevoId) q = q.eq("nuevo_id", soloNuevoId);
  const { data, error } = await q;
  if (error || !data?.length) return;
  for (const r of data as { id: string; nuevo_id: string }[]) {
    const { data: c } = await admin
      .from("clients")
      .select("fecha_inicio, contrato_fecha_inicio, contrato_descuento_pct, contrato_descuento_monto")
      .eq("id", r.nuevo_id)
      .maybeSingle();
    const cli = c as {
      fecha_inicio: string | null;
      contrato_fecha_inicio: string | null;
      contrato_descuento_pct: number | null;
      contrato_descuento_monto: number | null;
    } | null;
    const inicio = cli?.contrato_fecha_inicio ?? cli?.fecha_inicio;
    if (!cli || !inicio) continue;
    if (!cli.contrato_descuento_pct && !cli.contrato_descuento_monto) {
      await admin
        .from("clients")
        .update({ contrato_descuento_pct: PCT_RECOMENDADO, contrato_descuento_meses: 1, contrato_fecha_inicio: inicio })
        .eq("id", r.nuevo_id);
    }
    // Si ya tenía otro descuento, no se pisa: se da por resuelto igual.
    await admin.from("referidos").update({ descuento_nuevo: true }).eq("id", r.id);
  }
}
