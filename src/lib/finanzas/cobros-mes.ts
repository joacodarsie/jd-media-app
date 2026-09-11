import { createAdmin } from "@/lib/supabase/admin";
import { isClientPausedFor } from "@/lib/client-pause";
import { estadoDeCobro } from "@/lib/finanzas/cobro-gestion";

/**
 * De dónde salen los cobros de un mes — un solo lugar.
 *
 * Antes cada pantalla armaba la lista por su cuenta y por eso los números no
 * coincidían entre sí: Finanzas contaba TODAS las facturas del período y la
 * pantalla de cobros solo las de cuentas activas. El dueño veía "12 sin cobrar"
 * en un lado y otra cosa en el otro, y dejó de creerle a las dos.
 *
 * Acá se separan dos cosas que no son lo mismo:
 *  - `filas`: lo que hay que cobrar ESTE mes (cuentas vivas, sin pausar).
 *  - `viejas`: facturas sin cobrar que quedaron colgadas — de meses anteriores
 *    o de cuentas que ya se dieron de baja. Es deuda real o basura de carga,
 *    pero no es "el mes": mezclarla infla el pendiente y ensucia el número.
 */

export interface PagoEntrega {
  id: string;
  monto: number;
  fecha: string;
  nota: string | null;
}

export interface FilaCobro {
  clienteId: string;
  nombre: string;
  monto: number;
  cobradoEl: string | null;
  nota: string | null;
  contacto: string | null;
  telefono: string | null;
  esperandoPago: boolean;
  etapa: string | null;
  pagos: PagoEntrega[];
}

export interface FacturaColgada {
  id: string;
  clienteId: string;
  nombre: string;
  estado: string;
  periodo: string;
  monto: number;
  /** Lo que ya entregó a cuenta: lo que falta es `monto - entregado`. */
  entregado: number;
  /** Por qué quedó afuera del mes: se fue la cuenta, o es de un mes anterior. */
  motivo: "cuenta_de_baja" | "mes_anterior";
}

/** Estados en los que una cuenta todavía se factura. */
const ESTADOS_QUE_SE_COBRAN = ["activo", "esperando_pago"];

export function clasificarColgada(estado: string, periodo: string, periodoActual: string) {
  if (!ESTADOS_QUE_SE_COBRAN.includes(estado)) return "cuenta_de_baja" as const;
  if (periodo < periodoActual) return "mes_anterior" as const;
  return null;
}

export async function cargarCobrosDelMes(periodo: string): Promise<{
  filas: FilaCobro[];
  viejas: FacturaColgada[];
}> {
  const admin = createAdmin();

  const [{ data: clientesRaw }, { data: invRaw }] = await Promise.all([
    admin
      .from("clients")
      .select(
        "id, nombre, monto_mensual, estado, es_interno, contacto_nombre, contacto_telefono, pausas"
      )
      .in("estado", ESTADOS_QUE_SE_COBRAN)
      .order("nombre"),
    // Todas las facturas sin cobrar + las del período: con eso alcanza para
    // armar el mes y para saber qué quedó colgado de antes.
    admin
      .from("client_invoices")
      .select(
        "id, cliente_id, periodo, monto, fecha_cobro, notas, gestion_estado, clients(nombre, estado, es_interno)"
      )
      .or(`periodo.eq.${periodo},fecha_cobro.is.null`),
  ]);

  type InvRow = {
    id: string;
    cliente_id: string;
    periodo: string;
    monto: number;
    fecha_cobro: string | null;
    notas: string | null;
    gestion_estado: string | null;
    clients: { nombre: string; estado: string; es_interno: boolean } | null;
  };
  const invoices = (invRaw ?? []) as unknown as InvRow[];

  const delMes = invoices.filter((i) => i.periodo === periodo);
  const porCliente = new Map(delMes.map((i) => [i.cliente_id, i]));

  // Entregas a cuenta. Si falta la migración 0155 la pantalla anda igual:
  // simplemente no hay pagos parciales.
  const pagosPorFactura = new Map<string, PagoEntrega[]>();
  if (invoices.length > 0) {
    const { data: pagosRaw } = await admin
      .from("invoice_payments")
      .select("id, invoice_id, monto, fecha, nota")
      .in(
        "invoice_id",
        invoices.map((i) => i.id)
      )
      .order("fecha");
    for (const p of (pagosRaw ?? []) as {
      id: string;
      invoice_id: string;
      monto: number;
      fecha: string;
      nota: string | null;
    }[]) {
      const arr = pagosPorFactura.get(p.invoice_id) ?? [];
      arr.push({ id: p.id, monto: Number(p.monto), fecha: p.fecha, nota: p.nota });
      pagosPorFactura.set(p.invoice_id, arr);
    }
  }

  const filas: FilaCobro[] = ((clientesRaw ?? []) as {
    id: string;
    nombre: string;
    monto_mensual: number | null;
    estado: string;
    es_interno: boolean;
    contacto_nombre: string | null;
    contacto_telefono: string | null;
    pausas: string[] | null;
  }[])
    .filter((c) => !c.es_interno)
    // Una cuenta pausada este mes no se factura: si apareciera acá sumaría a
    // "falta cobrar" una plata que nadie debe.
    .filter((c) => !isClientPausedFor(c.pausas, periodo))
    .map((c) => {
      const inv = porCliente.get(c.id);
      return {
        clienteId: c.id,
        nombre: c.nombre,
        monto: Number(inv?.monto ?? c.monto_mensual ?? 0),
        cobradoEl: inv?.fecha_cobro ?? null,
        nota: inv?.notas ?? null,
        contacto: c.contacto_nombre,
        telefono: c.contacto_telefono,
        esperandoPago: c.estado === "esperando_pago",
        etapa: inv?.gestion_estado ?? null,
        pagos: inv ? (pagosPorFactura.get(inv.id) ?? []) : [],
      };
    });

  const enElMes = new Set(filas.map((f) => f.clienteId));
  const viejas: FacturaColgada[] = invoices
    .filter((i) => !i.fecha_cobro)
    .filter((i) => !i.clients?.es_interno)
    // Lo que ya se ve arriba no se repite abajo.
    .filter((i) => !(i.periodo === periodo && enElMes.has(i.cliente_id)))
    .map((i) => {
      const motivo = clasificarColgada(i.clients?.estado ?? "", i.periodo, periodo);
      if (!motivo) return null;
      const entregado = (pagosPorFactura.get(i.id) ?? []).reduce((a, p) => a + p.monto, 0);
      return {
        id: i.id,
        clienteId: i.cliente_id,
        nombre: i.clients?.nombre ?? "—",
        estado: i.clients?.estado ?? "—",
        periodo: i.periodo,
        monto: Number(i.monto),
        entregado,
        motivo,
      };
    })
    .filter((x): x is FacturaColgada => x !== null)
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.nombre.localeCompare(b.nombre));

  return { filas, viejas };
}

/** Cuántas cuentas del mes siguen sin saldar. Es el número del sidebar. */
export function cuantasFaltanCobrar(filas: FilaCobro[]): number {
  return filas.filter(
    (f) => !estadoDeCobro({ monto: f.monto, pagos: f.pagos, cobradoEl: f.cobradoEl }).saldado
  ).length;
}
