import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentPeriod, periodLabel, fmtCurrency } from "@/lib/finanzas";
import {
  buildPaymentReminder,
  buildGroupedPaymentReminder,
  reminderAmount,
  whatsappLink,
  normalizePhone,
  type ReminderClient,
} from "@/lib/payment-reminder";
import { MonthPicker } from "@/components/month-picker";
import { PaymentReminderCard, type ReminderCardData } from "@/components/payment-reminder-card";
import { Card, CardContent } from "@/components/ui/card";
import { AGENCY } from "@/lib/agency";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

interface ClientRow extends ReminderClient {
  id: string;
  pack: string | null;
  contacto_telefono: string | null;
}

export default async function RecordatoriosPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  await requireFeature("finanzas");
  const supabase = createClient();

  const periodo =
    searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : currentPeriod();

  const { data } = await supabase
    .from("clients")
    .select(
      "id, nombre, pack, monto_mensual, contacto_nombre, contacto_telefono, contrato_moneda, contrato_descuento_pct, contrato_descuento_monto"
    )
    .eq("estado", "activo")
    .eq("es_interno", false)
    .order("nombre");

  const clients = (data ?? []) as ClientRow[];

  // Un mismo titular puede tener varias cuentas (marcas). Las agrupamos por
  // teléfono normalizado para mandarle UN solo mensaje con el total sumado y el
  // detalle por marca. Las cuentas sin teléfono usable quedan como tarjeta suelta.
  const groups = new Map<string, ClientRow[]>();
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">
          Cobrando: <b>{periodLabel(periodo)}</b>
        </div>
        <MonthPicker value={periodo} />
        <div className="ml-auto flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
          Alias: <b>{AGENCY.bank.alias}</b>
          <CopyButton value={AGENCY.bank.alias} />
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
