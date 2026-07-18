import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveClients } from "@/lib/cache";
import { getExchangeRates } from "@/lib/exchange";
import { isOverdue, currentPeriod, periodLabel, fmtCurrency } from "@/lib/finanzas";
import {
  buildPaymentReminder,
  buildGroupedPaymentReminder,
  reminderAmount,
  whatsappLink,
  normalizePhone,
  type ReminderClient,
} from "@/lib/payment-reminder";
import { GenerateMonthButton } from "@/components/generate-month-button";
import { InvoicesTable, type InvoiceTableRow } from "@/components/invoices-table";
import { MonthPicker } from "@/components/month-picker";
import { PaymentReminderCard, type ReminderCardData } from "@/components/payment-reminder-card";
import { Card, CardContent } from "@/components/ui/card";
import { AGENCY } from "@/lib/agency";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Filter = "todas" | "pendientes" | "vencidas" | "cobradas";
type Vista = "facturas" | "recordatorios";

interface ReminderClientRow extends ReminderClient {
  id: string;
  pack: string | null;
  contacto_telefono: string | null;
}

export default async function CobrosPage({
  searchParams,
}: {
  searchParams: { f?: string; m?: string; v?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();

  // Vista: facturas (default) o recordatorios de WhatsApp. Antes eran 2
  // páginas; es el mismo flujo ("¿quién me debe?" → le mando el recordatorio).
  const vista: Vista = searchParams.v === "recordatorios" ? "recordatorios" : "facturas";
  const mParam = searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : null;

  const toggle = (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          { key: "facturas", label: "Facturas", href: "/finanzas/cobros" },
          {
            key: "recordatorios",
            label: "Recordatorios WhatsApp",
            href: "/finanzas/cobros?v=recordatorios",
          },
        ] as const
      ).map((opt) => (
        <Link
          key={opt.key}
          href={`${opt.href}${mParam ? `${opt.href.includes("?") ? "&" : "?"}m=${mParam}` : ""}`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            vista === opt.key
              ? "border-primary bg-primary/10 text-foreground"
              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );

  // ── Vista RECORDATORIOS ──
  if (vista === "recordatorios") {
    const periodo = mParam ?? currentPeriod();

    const { data } = await supabase
      .from("clients")
      .select(
        "id, nombre, pack, monto_mensual, contacto_nombre, contacto_telefono, contrato_moneda, contrato_descuento_pct, contrato_descuento_monto"
      )
      .eq("estado", "activo")
      .eq("es_interno", false)
      .order("nombre");

    const clients = (data ?? []) as ReminderClientRow[];

    // Un mismo titular puede tener varias cuentas (marcas). Las agrupamos por
    // teléfono normalizado para mandarle UN solo mensaje con el total sumado y el
    // detalle por marca. Las cuentas sin teléfono usable quedan como tarjeta suelta.
    const groups = new Map<string, ReminderClientRow[]>();
    for (const c of clients) {
      const key = normalizePhone(c.contacto_telefono) ?? `__solo_${c.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const cards: ReminderCardData[] = [...groups.values()].map((group) => {
      const primary = group[0];
      const esGrupo = group.length > 1;
      const mensaje = esGrupo
        ? buildGroupedPaymentReminder(group, periodo)
        : buildPaymentReminder(primary, periodo);

      // Monto combinado (por moneda) del grupo.
      const totales = new Map<string, number>();
      for (const c of group) {
        const { monto, moneda } = reminderAmount(c);
        if (monto > 0) totales.set(moneda, (totales.get(moneda) ?? 0) + monto);
      }
      const total = [...totales.values()].reduce((a, v) => a + v, 0);
      const sinMonto = total <= 0;
      const montoLabel = sinMonto
        ? "⚠ sin monto cargado"
        : [...totales.entries()].map(([mon, v]) => fmtCurrency(v, mon)).join(" + ");

      const link = whatsappLink(primary.contacto_telefono, mensaje);
      // El componente re-arma el link con el texto vivo: le paso solo los dígitos.
      const telefono = link ? link.split("/").pop()!.split("?")[0] : null;
      return {
        id: group.map((c) => c.id).join("-"),
        nombre: group.map((c) => c.nombre).join(" + "),
        pack: esGrupo ? `${group.length} cuentas · mismo titular` : primary.pack,
        montoLabel,
        sinMonto,
        mensaje,
        waLink: link,
        telefono,
      };
    });

    cards.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    const sinMontoCount = cards.filter((c) => c.sinMonto).length;

    return (
      <div className="space-y-5">
        <Link
          href="/finanzas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Finanzas
        </Link>

        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="h-6 w-6 text-primary" /> Recordatorios de pago
          </h1>
          <p className="text-muted-foreground">
            Mensaje listo para mandar por WhatsApp a cada cliente activo, con el
            monto del mes y tu alias. Ideal mandarlo el 1° (o un par de días antes)
            para cobrar a tiempo y poder pagarle al equipo. Si un mismo titular
            tiene varias cuentas con el mismo teléfono, se agrupan en un solo
            mensaje con el total sumado.
          </p>
        </div>

        {toggle}

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm">
            Cobrando: <b>{periodLabel(periodo)}</b>
          </div>
          <MonthPicker value={periodo} />
          <div className="ml-auto flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            Alias: <b>{AGENCY.bank.alias}</b>
            <CopyButton value={AGENCY.bank.alias} />
            <span className="text-muted-foreground">·</span>
            CVU
            <CopyButton value={AGENCY.bank.cvu} />
          </div>
        </div>

        {sinMontoCount > 0 && (
          <Card className="border-amber-300">
            <CardContent className="p-3 text-sm text-amber-700">
              ⚠ {sinMontoCount} cliente{sinMontoCount > 1 ? "s" : ""} sin{" "}
              <code>monto_mensual</code> cargado. El mensaje sale con &quot;monto a
              confirmar&quot; — completá el monto en la ficha del cliente o editá el
              mensaje antes de enviarlo.
            </CardContent>
          </Card>
        )}

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay clientes activos.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {cards.map((c) => (
              <PaymentReminderCard key={c.id} data={c} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Vista FACTURAS (default) ──
  const rates = await getExchangeRates();

  const filterParam = (searchParams.f ?? "pendientes") as Filter;
  const filter: Filter = ["todas", "pendientes", "vencidas", "cobradas"].includes(filterParam)
    ? filterParam
    : "pendientes";
  const monthFilter = mParam;

  const [{ data: invoicesData }, clients] = await Promise.all([
    supabase
      .from("client_invoices")
      .select(
        "id, cliente_id, monto, moneda, periodo, concepto, fecha_emision, fecha_vencimiento, fecha_cobro, metodo_pago, notas, cliente:clients(id,nombre)"
      )
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    getActiveClients(),
  ]);

  const all = (invoicesData ?? []) as unknown as InvoiceTableRow[];

  let rows = all.filter((i) => {
    if (filter === "pendientes") return !i.fecha_cobro;
    if (filter === "cobradas") return !!i.fecha_cobro;
    if (filter === "vencidas") return isOverdue(i.fecha_vencimiento, i.fecha_cobro);
    return true;
  });
  if (monthFilter) rows = rows.filter((i) => i.periodo === monthFilter);

  const counts = {
    todas: all.length,
    pendientes: all.filter((i) => !i.fecha_cobro).length,
    vencidas: all.filter((i) => isOverdue(i.fecha_vencimiento, i.fecha_cobro)).length,
    cobradas: all.filter((i) => !!i.fecha_cobro).length,
  };

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Cuentas por cobrar</h1>
        <p className="text-muted-foreground">
          Lo que te deben los clientes este mes y cuándo. Lo más rápido es{" "}
          <b>Generar el mes</b> (crea el cobro de cada cliente con abono) y después
          marcás <b>cobrado</b> cuando te paguen.
        </p>
      </div>

      {toggle}

      <div className="flex flex-wrap items-center gap-2">
        {(["pendientes", "vencidas", "cobradas", "todas"] as const).map((k) => (
          <Link
            key={k}
            href={`/finanzas/cobros?f=${k}${monthFilter ? `&m=${monthFilter}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
              k === "vencidas" && filter !== k && counts.vencidas > 0 && "border-red-300 text-red-700"
            )}
          >
            {labelFor(k)} ({counts[k]})
          </Link>
        ))}
        <MonthPicker value={monthFilter} />
      </div>

      <InvoicesTable rows={rows} rates={rates} clients={clients} />

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Generar los cobros del mes en bloque
          </div>
          <p className="text-xs text-muted-foreground">
            Crea de una el cobro de cada cliente activo con abono mensual cargado.
            A los clientes que arrancan este mes les suma además la{" "}
            <b>puesta en marcha</b> (pago único de arranque). No duplica si ya
            existían. Después solo marcás cobrado cuando te paguen.
          </p>
          <GenerateMonthButton kind="invoices" />
        </CardContent>
      </Card>
    </div>
  );
}

function labelFor(k: "pendientes" | "vencidas" | "cobradas" | "todas") {
  const m: Record<string, string> = {
    pendientes: "Pendientes",
    vencidas: "Vencidas",
    cobradas: "Cobradas",
    todas: "Todas",
  };
  return m[k];
}
