import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers } from "@/lib/cache";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS } from "@/lib/finanzas";
import {
  SubscriptionsManager,
  type SubscriptionRow,
  monthlyARS,
} from "@/components/subscriptions-manager";

export const dynamic = "force-dynamic";

export default async function SuscripcionesPage() {
  await requireFeature("finanzas");
  const supabase = createClient();
  const rates = await getExchangeRates();

  const [{ data: subsRaw }, usersData] = await Promise.all([
    supabase
      .from("subscriptions")
      .select(
        "id, nombre, categoria, costo, moneda, ciclo, proxima_renovacion, metodo_pago, administrador_id, url, activa, notas"
      )
      .order("activa", { ascending: false })
      .order("nombre"),
    getActiveUsers(),
  ]);

  const subs = (subsRaw ?? []) as SubscriptionRow[];
  const users = usersData as { id: string; nombre: string }[];

  const activas = subs.filter((s) => s.activa);
  const totalMensualARS = activas.reduce(
    (a, s) => a + toARS(monthlyARS(s), s.moneda, rates),
    0
  );
  const totalAnualARS = totalMensualARS * 12;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/finanzas"
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Finanzas
        </Link>
        <h1 className="text-2xl font-bold">Suscripciones y plataformas</h1>
        <p className="text-muted-foreground">
          Todo lo recurrente que paga la agencia (SaaS, herramientas). Registrá
          el pago cuando toque y entra al cashflow como gasto del mes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card label="Suscripciones activas" value={String(activas.length)} />
        <Card label="Costo mensual (ARS)" value={fmtARS(totalMensualARS)} sub="normalizado al blue" />
        <Card label="Proyección anual" value={fmtARS(totalAnualARS)} sub="× 12 meses" />
      </div>

      <SubscriptionsManager
        subs={subs}
        users={users}
        usdRate={rates.USD}
        eurRate={rates.EUR}
      />
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
