import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import { hoyYmd } from "@/lib/dates";
import { construirAlertas, type AlertaItem } from "@/lib/finanzas/alertas";
import { Card, CardContent } from "@/components/ui/card";

/**
 * La tira roja de "esto está atrasado". Lo único que se salvó del hub de
 * Finanzas cuando se sacó: el resto del hub eran links a otras pantallas.
 *
 * No muestra nada cuando no hay nada atrasado — una tarjeta permanente en cero
 * se vuelve invisible a la semana.
 */
export async function FinanzasAlertas() {
  const supabase = createClient();
  const hoy = hoyYmd();
  const rates = await getExchangeRates();
  const aArs = (m: number, moneda: string) => toARS(Number(m), moneda, rates);

  const [{ data: cobros }, { data: pagos }, { data: gastos }] = await Promise.all([
    supabase
      .from("client_invoices")
      .select("monto, moneda, fecha_vencimiento, fecha_cobro")
      .is("fecha_cobro", null),
    supabase
      .from("team_payments")
      .select("monto, moneda, fecha_programada, fecha_pago")
      .is("fecha_pago", null),
    supabase
      .from("expenses")
      .select("monto, moneda, fecha_programada, fecha_pago")
      .is("fecha_pago", null),
  ]);

  const alertas = construirAlertas(
    {
      cobros: ((cobros ?? []) as Array<Record<string, unknown>>).map(
        (c) =>
          ({
            fecha: c.fecha_vencimiento,
            monto: c.monto,
            moneda: c.moneda,
            fecha_cobro: c.fecha_cobro,
          }) as AlertaItem
      ),
      pagos: ((pagos ?? []) as Array<Record<string, unknown>>).map(
        (p) =>
          ({
            fecha: p.fecha_programada,
            monto: p.monto,
            moneda: p.moneda,
            fecha_pago: p.fecha_pago,
          }) as AlertaItem
      ),
      gastos: ((gastos ?? []) as Array<Record<string, unknown>>).map(
        (e) =>
          ({
            fecha: e.fecha_programada,
            monto: e.monto,
            moneda: e.moneda,
            fecha_pago: e.fecha_pago,
          }) as AlertaItem
      ),
    },
    hoy,
    aArs
  );

  if (alertas.length === 0) return null;

  return (
    <Card className="border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20">
      <CardContent className="space-y-1 p-3 text-sm">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" /> Atención
        </div>
        {alertas.map((a) => (
          <div key={a.href} className="flex items-center justify-between gap-3">
            <Link href={a.href} className="text-xs underline hover:no-underline">
              {a.texto}
            </Link>
            <span className="shrink-0 font-semibold tabular-nums">{fmtARS(a.monto)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
