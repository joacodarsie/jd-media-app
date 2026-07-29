import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod, periodLabel } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { MonthPicker } from "@/components/month-picker";
import { MesPanel, type FilaCobro, type FilaPago } from "@/components/mes-panel";

export const dynamic = "force-dynamic";

/**
 * "La plata del mes": una sola pantalla para responder las dos preguntas que
 * importan — a quién le cobro y a quién le pago, cuánto y por qué. Antes había
 * que cruzar Cobros, Pagos y Sueldos a mano, y por eso no se cargaba nada.
 */
export default async function MesPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const me = await requireFeature("finanzas");
  const admin = createAdmin();
  const periodo =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();

  const [payroll, { data: invRaw }] = await Promise.all([
    buildPeriodPayroll(admin, periodo),
    admin
      .from("client_invoices")
      .select("id, cliente_id, concepto, monto, moneda, fecha_cobro, fecha_vencimiento")
      .eq("periodo", periodo),
  ]);

  const invoices = (invRaw ?? []) as {
    id: string;
    cliente_id: string;
    concepto: string;
    monto: number;
    moneda: string;
    fecha_cobro: string | null;
    fecha_vencimiento: string | null;
  }[];

  // Datos de contacto de las cuentas facturadas (para el mensaje de cobro).
  const clienteIds = [...new Set(invoices.map((i) => i.cliente_id))];
  const { data: clientsRaw } = clienteIds.length
    ? await admin
        .from("clients")
        .select("id, nombre, contacto_nombre, contacto_telefono")
        .in("id", clienteIds)
    : { data: [] };
  const clientes = new Map(
    ((clientsRaw ?? []) as {
      id: string;
      nombre: string;
      contacto_nombre: string | null;
      contacto_telefono: string | null;
    }[]).map((c) => [c.id, c])
  );

  // Una fila por CUENTA (si tiene varias facturas del mes, se suman: es una
  // sola transferencia y un solo mensaje).
  const porCliente = new Map<string, FilaCobro>();
  for (const inv of invoices) {
    const c = clientes.get(inv.cliente_id);
    const actual = porCliente.get(inv.cliente_id);
    if (actual) {
      actual.monto += Number(inv.monto);
      actual.facturaIds.push(inv.id);
      actual.conceptos.push(inv.concepto);
      actual.cobrada = actual.cobrada && !!inv.fecha_cobro;
      if (inv.fecha_vencimiento && (!actual.vencimiento || inv.fecha_vencimiento < actual.vencimiento))
        actual.vencimiento = inv.fecha_vencimiento;
    } else {
      porCliente.set(inv.cliente_id, {
        clienteId: inv.cliente_id,
        cliente: c?.nombre ?? "—",
        contactoNombre: c?.contacto_nombre ?? null,
        telefono: c?.contacto_telefono ?? null,
        monto: Number(inv.monto),
        moneda: inv.moneda || "ARS",
        facturaIds: [inv.id],
        conceptos: [inv.concepto],
        cobrada: !!inv.fecha_cobro,
        vencimiento: inv.fecha_vencimiento,
      });
    }
  }
  const cobros = [...porCliente.values()].sort(
    (a, b) => Number(a.cobrada) - Number(b.cobrada) || b.monto - a.monto
  );

  // Teléfonos del equipo, para mandarles el aviso de pago.
  const { data: usersRaw } = await admin
    .from("users")
    .select("id, telefono, whatsapp_phone")
    .eq("activo", true);
  const tel = new Map(
    ((usersRaw ?? []) as { id: string; telefono: string | null; whatsapp_phone: string | null }[]).map(
      (u) => [u.id, u.whatsapp_phone || u.telefono || null]
    )
  );

  const pagos: FilaPago[] = payroll.people
    .filter((p) => p.total > 0)
    .map((p) => ({
      userId: p.userId,
      nombre: p.nombre,
      telefono: tel.get(p.userId) ?? null,
      alias: p.alias,
      titular: p.titular,
      total: p.total,
      lineas: [
        ...p.autoLines.map((l) => ({
          concepto: l.concepto,
          cliente: l.cliente,
          monto: l.monto,
        })),
        ...p.manualItems.map((i) => ({
          concepto: i.concepto,
          cliente: i.cliente,
          monto: i.monto,
        })),
      ],
      pagado: p.pagado,
    }))
    .sort((a, b) => Number(a.pagado) - Number(b.pagado) || b.total - a.total);

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Finanzas
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wallet className="h-6 w-6 text-primary" /> La plata del mes
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Todo {periodLabel(periodo)} en una pantalla: a quién le cobrás y a quién le
            pagás, cuánto y <b>por qué</b>. Tocá una fila para ver el detalle y el
            mensaje ya escrito.
          </p>
        </div>
        <MonthPicker value={periodo} />
      </div>

      <MesPanel
        periodo={periodo}
        cobros={cobros}
        pagos={pagos}
        concepto={payroll.salaryConcepto}
        miNombre={me.nombre ?? null}
      />
    </div>
  );
}
