// Generación de las facturas del mes, con el ADMIN client (service role).
//
// Reemplaza al RPC `jd_generate_invoices_for_period` (que exige un usuario
// staff logueado vía auth.uid(), así que no puede correr desde un cron) y a la
// lógica de puesta en marcha que vivía en finanzas/actions. Una sola fuente:
// la usan el botón de Cobros/Panorama y el cron del día 1.
//
// Idempotente: los abonos no se duplican (busca por service_id+período) y la
// puesta en marcha tampoco (busca por concepto). Se puede correr mil veces.

import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeSettings } from "@/lib/coordinacion";

export interface GeneratedInvoices {
  abonos: number;
  puestaEnMarcha: number;
}

export async function generateInvoicesForPeriod(
  admin: SupabaseClient,
  periodo: string,
  creadoPorId: string | null
): Promise<GeneratedInvoices> {
  const [{ data: clientsRaw }, { data: svcRaw }, { data: existingRaw }, { data: settingsRow }] =
    await Promise.all([
      admin
        .from("clients")
        .select("id, nombre, fecha_inicio, contrato_moneda")
        .eq("estado", "activo")
        .eq("es_interno", false),
      admin
        .from("client_services")
        .select("id, cliente_id, tipo, pack, monto_mensual, moneda, facturacion")
        .eq("activo", true)
        .not("monto_mensual", "is", null),
      admin.from("client_invoices").select("service_id, cliente_id, concepto").eq("periodo", periodo),
      admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    ]);

  const clients = (clientsRaw ?? []) as {
    id: string;
    nombre: string;
    fecha_inicio: string | null;
    contrato_moneda: string | null;
  }[];
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const existing = (existingRaw ?? []) as {
    service_id: string | null;
    cliente_id: string;
    concepto: string;
  }[];
  const invoicedServiceIds = new Set(existing.map((i) => i.service_id).filter(Boolean));

  // ── Abonos mensuales: una factura por servicio recurrente con monto ──
  let abonos = 0;
  for (const s of (svcRaw ?? []) as {
    id: string;
    cliente_id: string;
    tipo: string;
    pack: string | null;
    monto_mensual: number;
    moneda: string | null;
    facturacion: string | null;
  }[]) {
    if ((s.facturacion ?? "mensual") !== "mensual") continue;
    const cliente = clientById.get(s.cliente_id);
    if (!cliente) continue; // inactivo o interno
    if (invoicedServiceIds.has(s.id)) continue;

    const { error } = await admin.from("client_invoices").insert({
      cliente_id: s.cliente_id,
      service_id: s.id,
      periodo,
      concepto: `${cliente.nombre} · ${s.tipo}${s.pack ? ` (${s.pack})` : ""} — ${periodo}`,
      monto: s.monto_mensual,
      moneda: s.moneda ?? "ARS",
      fecha_emision: `${periodo}-01`,
      fecha_vencimiento: `${periodo}-10`,
      creado_por_id: creadoPorId,
    });
    if (!error) abonos++;
  }

  // ── Puesta en marcha: pago único del PRIMER mes de cada cuenta nueva ──
  const puesta = mergeSettings(settingsRow).rates.puesta_en_marcha ?? 0;
  let puestaEnMarcha = 0;
  if (puesta > 0) {
    const conGestion = new Set(
      ((svcRaw ?? []) as { cliente_id: string; tipo: string }[])
        .filter((s) => s.tipo === "gestion_redes")
        .map((s) => s.cliente_id)
    );
    const yaTienen = new Set(
      existing.filter((i) => i.concepto.startsWith("Puesta en marcha")).map((i) => i.cliente_id)
    );
    for (const c of clients) {
      if ((c.fecha_inicio ?? "").slice(0, 7) !== periodo) continue;
      if (!conGestion.has(c.id) || yaTienen.has(c.id)) continue;
      const fecha = (c.fecha_inicio ?? `${periodo}-01`).slice(0, 10);
      const { error } = await admin.from("client_invoices").insert({
        cliente_id: c.id,
        service_id: null,
        periodo,
        concepto: `Puesta en marcha — ${c.nombre}`,
        monto: puesta,
        moneda: c.contrato_moneda || "ARS",
        fecha_emision: fecha,
        fecha_vencimiento: fecha,
        creado_por_id: creadoPorId,
      });
      if (!error) puestaEnMarcha++;
    }
  }

  return { abonos, puestaEnMarcha };
}
