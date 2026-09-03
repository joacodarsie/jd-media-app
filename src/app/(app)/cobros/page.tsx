import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod, periodLabel } from "@/lib/finanzas";
import { isClientPausedFor } from "@/lib/client-pause";
import { MonthPicker } from "@/components/month-picker";
import { CobrosSimple, type FilaCliente } from "@/components/cobros-simple";
import { totalCobrado, totalPendiente } from "@/lib/finanzas/cobro-gestion";

export const dynamic = "force-dynamic";

/**
 * "¿Quién me pagó?" — la versión mínima de cobros.
 *
 * Existe porque el dueño lleva los cobros DE MEMORIA: julio cerró con 15
 * facturas emitidas y 0 marcadas como cobradas. Finanzas tiene 19 subpantallas
 * y él mismo dijo que se marea. Acá hay una sola lista, una fila por cliente
 * activo, y tres cosas por fila: cuánto, ¿pagó?, y una nota.
 *
 * No hace falta "generar las facturas del mes": la fila aparece igual y la
 * factura se crea sola cuando toca algo.
 */
export default async function CobrosSimplePage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  await requireFeature("finanzas");
  const admin = createAdmin();
  const periodo =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();

  const [{ data: clientesRaw }, { data: invRaw }] = await Promise.all([
    // Se incluyen los que están ESPERANDO PAGO: son justamente los que hay que
    // cobrar, y marcarlos acá es lo que los convierte en clientes.
    admin
      .from("clients")
      .select(
        "id, nombre, monto_mensual, estado, es_interno, contacto_nombre, contacto_telefono, pausas"
      )
      .in("estado", ["activo", "esperando_pago"])
      .order("nombre"),
    admin
      .from("client_invoices")
      .select("id, cliente_id, monto, fecha_cobro, notas, gestion_estado")
      .eq("periodo", periodo),
  ]);

  const invoices = (invRaw ?? []) as {
    id: string;
    cliente_id: string;
    monto: number;
    fecha_cobro: string | null;
    notas: string | null;
    gestion_estado: string | null;
  }[];
  const porCliente = new Map(invoices.map((i) => [i.cliente_id, i]));

  // Entregas a cuenta del mes. Si falta la migración 0155, la pantalla anda
  // igual: simplemente no hay pagos parciales.
  const pagosPorFactura = new Map<
    string,
    { id: string; monto: number; fecha: string; nota: string | null }[]
  >();
  if (invoices.length > 0) {
    const { data: pagosRaw } = await admin
      .from("invoice_payments")
      .select("id, invoice_id, monto, fecha, nota")
      .in(
        "invoice_id",
        invoices.map((i) => i.id),
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

  const filas: FilaCliente[] = ((clientesRaw ?? []) as {
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

  // Los totales cuentan las entregas a cuenta: "falta cobrar" tiene que ser lo
  // que falta DE VERDAD, no el abono entero de alguien que ya dejó la mitad.
  const cobrado = totalCobrado(filas);
  const falta = totalPendiente(filas);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">¿Quién me pagó?</h1>
          <p className="text-muted-foreground">
            {periodLabel(periodo)}. Marcá el que te pagó y listo.
          </p>
        </div>
        <MonthPicker value={periodo} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="text-xs text-emerald-800 dark:text-emerald-300">Ya entró</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
            ${cobrado.toLocaleString("es-AR")}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Falta cobrar</p>
          <p className="text-2xl font-bold tabular-nums">${falta.toLocaleString("es-AR")}</p>
        </div>
      </div>

      <CobrosSimple filas={filas} periodo={periodo} />

      <p className="text-xs text-muted-foreground">
        ¿Necesitás el detalle (a quién le pagás vos, gastos, mensajes de cobro)?
        Está en{" "}
        <Link href="/finanzas/mes" className="underline">
          La plata del mes
        </Link>
        . Esta pantalla es solo para marcar lo que entra.
      </p>
    </div>
  );
}
