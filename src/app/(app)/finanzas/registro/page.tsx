import Link from "next/link";
import { ArrowLeft, Table2 } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, currentPeriod, prevPeriod } from "@/lib/finanzas";
import { FinancialRegistry, type RegistryRow } from "@/components/financial-registry";

export const dynamic = "force-dynamic";

const MONTHS = 18;

export default async function RegistroPage() {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  // Ventana de meses (clave YYYY-MM).
  const periods: string[] = [];
  let p = currentPeriod();
  for (let i = 0; i < MONTHS; i++) {
    periods.unshift(p);
    p = prevPeriod(p);
  }

  const [{ data: invoices }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("client_invoices").select("monto, moneda, fecha_cobro").not("fecha_cobro", "is", null),
    supabase.from("team_payments").select("monto, moneda, fecha_pago").not("fecha_pago", "is", null),
    supabase.from("expenses").select("monto, moneda, fecha_pago").not("fecha_pago", "is", null),
  ]);

  const map = new Map<string, RegistryRow>();
  for (const per of periods) map.set(per, { periodo: per, ingresos: 0, sueldos: 0, gastos: 0 });
  const monthOf = (d: string | null) => (d ? d.slice(0, 7) : null);

  for (const i of invoices ?? []) {
    const m = monthOf(i.fecha_cobro as string | null);
    if (m && map.has(m)) map.get(m)!.ingresos += toARS(Number(i.monto), i.moneda as string, rates);
  }
  for (const pay of payments ?? []) {
    const m = monthOf(pay.fecha_pago as string | null);
    if (m && map.has(m)) map.get(m)!.sueldos += toARS(Number(pay.monto), pay.moneda as string, rates);
  }
  for (const e of expenses ?? []) {
    const m = monthOf(e.fecha_pago as string | null);
    if (m && map.has(m)) map.get(m)!.gastos += toARS(Number(e.monto), e.moneda as string, rates);
  }

  const rows = periods.map((per) => map.get(per)!);

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
          <Table2 className="h-6 w-6 text-primary" /> Registro
        </h1>
        <p className="text-muted-foreground">
          El historial de la agencia como planilla: mes a mes, lo que entró, lo que
          salió, el neto y el crecimiento. Ordenable y descargable a Excel.
        </p>
      </div>

      <FinancialRegistry rows={rows} />
    </div>
  );
}
