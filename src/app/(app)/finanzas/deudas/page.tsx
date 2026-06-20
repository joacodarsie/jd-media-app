import Link from "next/link";
import { ArrowLeft, HandCoins } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS, fmtCurrency } from "@/lib/finanzas";
import { DebtsManager, type DebtRow } from "@/components/debts-manager";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DeudasPage() {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const rates = await getExchangeRates();

  const { data } = await admin
    .from("debts")
    .select("id, acreedor, monto, moneda, detalle, fecha, saldada, fecha_saldada")
    .order("saldada", { ascending: true })
    .order("created_at", { ascending: false });

  const debts = (data ?? []) as DebtRow[];
  const totalARS = debts
    .filter((d) => !d.saldada)
    .reduce((a, d) => a + toARS(Number(d.monto), d.moneda, rates), 0);

  // Resumen por moneda (para verlo en la moneda original también).
  const porMoneda = new Map<string, number>();
  for (const d of debts) {
    if (d.saldada) continue;
    porMoneda.set(d.moneda, (porMoneda.get(d.moneda) ?? 0) + Number(d.monto));
  }

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
          <HandCoins className="h-6 w-6 text-primary" /> Deudas
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Lo que debés, para ver tu posición real (no solo la ganancia del mes).
          Privado: solo lo ves vos.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total que debés
            </div>
            <div className="text-3xl font-bold tabular-nums text-red-600">
              {fmtARS(totalARS)}
            </div>
            {porMoneda.size > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {[...porMoneda.entries()].map(([m, v]) => fmtCurrency(v, m)).join(" · ")}
                {porMoneda.size > 1 || !porMoneda.has("ARS") ? " (convertido al blue)" : ""}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Dólar blue: ARS {rates.USD.toLocaleString("es-AR")}
          </div>
        </CardContent>
      </Card>

      <DebtsManager debts={debts} />
    </div>
  );
}
