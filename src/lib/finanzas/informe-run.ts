import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyYmd } from "@/lib/dates";
import { getExchangeRates } from "@/lib/exchange";
import { toARS } from "@/lib/finanzas";
import { mergeSettings, type AgencySettings } from "@/lib/coordinacion";
import { ultimosPeriodos, armarSerie, type MovimientoARS } from "./resumen";
import { filasClientes, filasEquipo, cuadres, type ServicioInforme } from "./informe-mensual";
import {
  construirInforme,
  type DatosInforme,
  type FilaCobro,
  type FilaFijo,
  type FilaMovimiento,
} from "./informe-xlsx";

/**
 * Junta de la base todo lo que necesita el informe y lo arma.
 *
 * Se lee de las mismas tablas que el resumen y con el mismo conversor de
 * moneda, a propósito: la hoja de la app y la planilla tienen que decir lo
 * mismo o ninguna de las dos sirve. Los cuadres del informe lo verifican.
 */

const MESES = 12;

export async function generarInforme(
  db: SupabaseClient,
  periodo: string
): Promise<{ buffer: Buffer; periodo: string }> {
  const periodos = ultimosPeriodos(periodo, MESES);
  const desde = `${periodos[0]}-01`;

  const [
    { data: invs },
    { data: pays },
    { data: exps },
    { data: svcs },
    { data: settingsRaw },
    { data: entregas },
    rates,
  ] = await Promise.all([
    db
      .from("client_invoices")
      .select("id, monto, moneda, periodo, concepto, fecha_cobro, cliente:clients(nombre)")
      .order("periodo", { ascending: false }),
    db
      .from("team_payments")
      .select("monto, moneda, periodo, concepto, fecha_pago, usuario:users!team_payments_user_id_fkey(nombre)")
      .not("fecha_pago", "is", null)
      .gte("fecha_pago", desde),
    db
      .from("expenses")
      .select("monto, moneda, periodo, concepto, proveedor, categoria, recurrente, fecha_pago")
      .not("fecha_pago", "is", null)
      .gte("fecha_pago", desde),
    db
      .from("client_services")
      .select(
        "tipo, pack, monto_mensual, moneda, costo_override, costo_pct, costo_override_user, media_buyer_aplica, pack_detalle, cliente:clients(nombre, id, estado, es_interno, fecha_inicio)"
      )
      .eq("activo", true),
    db.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    // Entregas parciales, para el saldo de cada factura.
    db.from("invoice_payments").select("invoice_id, monto"),
    getExchangeRates(),
  ]);

  const ars = (m: unknown, mon: unknown) => toARS(Number(m) || 0, String(mon ?? "ARS"), rates);
  const settings: AgencySettings = mergeSettings(settingsRaw as Partial<AgencySettings> | null);

  interface InvRow {
    id: string;
    monto: number;
    moneda: string;
    periodo: string;
    concepto: string;
    fecha_cobro: string | null;
    cliente: { nombre: string } | null;
  }
  interface PayRow {
    monto: number;
    moneda: string;
    periodo: string;
    concepto: string;
    fecha_pago: string;
    usuario: { nombre: string } | null;
  }
  interface ExpRow {
    monto: number;
    moneda: string;
    periodo: string;
    concepto: string;
    proveedor: string | null;
    categoria: string;
    recurrente: boolean;
    fecha_pago: string;
  }
  interface SvcRow {
    tipo: string;
    pack: string | null;
    monto_mensual: number | null;
    moneda: string | null;
    costo_override: number | null;
    costo_pct: number | null;
    costo_override_user: string | null;
    media_buyer_aplica: boolean | null;
    pack_detalle: Record<string, number> | null;
    cliente: {
      nombre: string;
      id: string;
      estado: string;
      es_interno: boolean;
      fecha_inicio: string | null;
    } | null;
  }

  const invoices = (invs ?? []) as unknown as InvRow[];
  const pagos = (pays ?? []) as unknown as PayRow[];
  const gastos = (exps ?? []) as unknown as ExpRow[];
  const servicios = (svcs ?? []) as unknown as SvcRow[];

  // ── La serie mensual: exactamente la misma que usa /finanzas/resumen ──
  const movs: MovimientoARS[] = [
    ...invoices
      .filter((i) => i.fecha_cobro && i.fecha_cobro >= desde)
      .map((i) => ({ fecha: i.fecha_cobro!, montoARS: ars(i.monto, i.moneda), tipo: "cobro" as const })),
    ...pagos.map((p) => ({ fecha: p.fecha_pago, montoARS: ars(p.monto, p.moneda), tipo: "equipo" as const })),
    ...gastos.map((e) => ({ fecha: e.fecha_pago, montoARS: ars(e.monto, e.moneda), tipo: "gasto" as const })),
  ];
  const serie = armarSerie(periodos, movs);
  const mes = serie.find((m) => m.periodo === periodo)!;

  // ── Clientes ──
  const paraCostear: ServicioInforme[] = servicios
    .filter((s) => s.cliente && s.cliente.estado === "activo" && !s.cliente.es_interno)
    .map((s) => ({
      cliente: s.cliente!.nombre,
      clienteId: s.cliente!.id,
      tipo: s.tipo,
      pack: s.pack,
      monto_mensual: s.monto_mensual,
      moneda: s.moneda,
      costo_override: s.costo_override,
      costo_pct: s.costo_pct,
      costo_override_user: s.costo_override_user,
      media_buyer_aplica: s.media_buyer_aplica,
      pack_detalle: s.pack_detalle,
      desde: s.cliente!.fecha_inicio,
    }));
  const clientes = filasClientes(paraCostear, settings, periodo);

  // ── Equipo ──
  const equipo = filasEquipo(
    pagos.map((p) => ({
      persona: p.usuario?.nombre ?? "Sin asignar",
      periodo: p.periodo,
      montoARS: ars(p.monto, p.moneda),
    })),
    periodos
  );

  // ── Gastos fijos del mes ──
  const fijos: FilaFijo[] = gastos
    .filter((e) => e.periodo === periodo)
    .map((e) => ({
      concepto: e.concepto,
      proveedor: e.proveedor ?? e.categoria,
      montoOriginal: Number(e.monto) || 0,
      moneda: e.moneda ?? "ARS",
      montoARS: ars(e.monto, e.moneda),
    }))
    .sort((a, b) => b.montoARS - a.montoARS);

  // ── Cobros: el mes pedido y todo lo que quedó pendiente de cualquier mes ──
  const entregado = new Map<string, number>();
  for (const p of ((entregas ?? []) as { invoice_id: string; monto: number }[])) {
    entregado.set(p.invoice_id, (entregado.get(p.invoice_id) ?? 0) + (Number(p.monto) || 0));
  }
  const cobros: FilaCobro[] = invoices
    .filter((i) => i.periodo === periodo || !i.fecha_cobro)
    .map((i) => {
      const monto = Number(i.monto) || 0;
      // El saldo tiene que descontar las entregas a cuenta. Power Collections
      // debe $175.000 de julio, no $350.000: la mitad ya la entregó.
      const aCuenta = entregado.get(i.id) ?? 0;
      return {
        cliente: i.cliente?.nombre ?? "—",
        periodo: i.periodo,
        concepto: i.concepto,
        monto,
        moneda: i.moneda ?? "ARS",
        cobrado: !!i.fecha_cobro,
        fechaCobro: i.fecha_cobro,
        aCuenta,
        saldo: i.fecha_cobro ? 0 : Math.max(0, monto - aCuenta),
      };
    })
    .sort((a, b) => (a.cobrado === b.cobrado ? b.periodo.localeCompare(a.periodo) : a.cobrado ? 1 : -1));

  // ── Movimientos: el libro completo de la ventana ──
  const movimientos: FilaMovimiento[] = [
    ...invoices
      .filter((i) => i.fecha_cobro && i.fecha_cobro >= desde)
      .map((i) => ({
        fecha: i.fecha_cobro!,
        tipo: "Cobro" as const,
        contraparte: i.cliente?.nombre ?? "—",
        concepto: i.concepto,
        montoARS: ars(i.monto, i.moneda),
      })),
    ...pagos.map((p) => ({
      fecha: p.fecha_pago,
      tipo: "Equipo" as const,
      contraparte: p.usuario?.nombre ?? "—",
      concepto: p.concepto,
      montoARS: -ars(p.monto, p.moneda),
    })),
    ...gastos.map((e) => ({
      fecha: e.fecha_pago,
      tipo: "Gasto" as const,
      contraparte: e.proveedor ?? e.categoria,
      concepto: e.concepto,
      montoARS: -ars(e.monto, e.moneda),
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  // ── Los controles cruzados ──
  const sumaCobrosDelMes = cobros
    .filter((c) => c.cobrado && c.fechaCobro?.startsWith(periodo))
    .reduce((a, c) => a + toARS(c.monto, c.moneda, rates), 0);
  const sumaEquipoDelMes = equipo.reduce((a, f) => a + (f.porMes[periodo] ?? 0), 0);
  const sumaFijosDelMes = fijos.reduce((a, f) => a + f.montoARS, 0);

  const datos: DatosInforme = {
    periodo,
    generadoEl: new Date().toISOString(),
    dolar: rates.USDC,
    serie,
    clientes,
    equipo,
    fijos,
    cobros,
    movimientos,
    cuadres: cuadres({
      entroResumen: mes.entro,
      sumaCobrosDelMes,
      equipoResumen: mes.equipo,
      sumaEquipoDelMes,
      fijosResumen: mes.gastos,
      sumaFijosDelMes,
    }),
  };

  return { buffer: await construirInforme(datos), periodo };
}

/** El período que corresponde por defecto: el mes en curso. */
export function periodoPorDefecto(): string {
  return hoyYmd().slice(0, 7);
}
