import Link from "next/link";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { computeClientsRisk, type ClientRisk } from "@/lib/clientes/riesgo";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NIVEL = {
  alto: { label: "Alto", badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", row: "bg-red-50/40 dark:bg-red-950/10" },
  medio: { label: "Medio", badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", row: "" },
  bajo: { label: "OK", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", row: "" },
} as const;

export default async function RiesgoPage() {
  await requireRole(["admin"]);
  const rows = await computeClientsRisk(createAdmin());

  const alto = rows.filter((r) => r.nivel === "alto").length;
  const medio = rows.filter((r) => r.nivel === "medio").length;
  const conRiesgo = rows.filter((r) => r.nivel !== "bajo");
  const ok = rows.filter((r) => r.nivel === "bajo");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldAlert className="h-6 w-6 text-primary" /> Riesgo de cuentas
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Qué cliente está en peligro <b>antes</b> de perderlo. Cruza señales reales:
          cobros vencidos, producción atrasada vs el pack, caída de seguidores y cambios
          pedidos. Ordenado por mayor riesgo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Riesgo alto" value={alto} tone={alto > 0 ? "red" : "muted"} />
        <Kpi label="Riesgo medio" value={medio} tone={medio > 0 ? "amber" : "muted"} />
        <Kpi label="Sin señales" value={ok.length} tone="emerald" />
      </div>

      {conRiesgo.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Ninguna cuenta con señales
            de riesgo. Todo en orden.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Riesgo</th>
                    <th className="px-3 py-2">Señales</th>
                  </tr>
                </thead>
                <tbody>
                  {conRiesgo.map((r) => (
                    <RiskRow key={r.id} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {ok.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-muted-foreground">
            Cuentas sin señales ({ok.length})
          </summary>
          <div className="flex flex-wrap gap-2 border-t p-3">
            {ok.map((r) => (
              <Link
                key={r.id}
                href={`/clientes/${r.id}`}
                className="rounded-full border bg-muted/30 px-2.5 py-1 text-xs hover:border-primary/40"
              >
                {r.nombre}
              </Link>
            ))}
          </div>
        </details>
      )}

      <p className="text-[11px] text-muted-foreground">
        💡 Pesos: cobro vencido (+3), producción atrasada pasada la mitad del mes (+2),
        caída de seguidores (+2), 2+ cambios pedidos (+1). Alto = 3+ · Medio = 1-2.
      </p>
    </div>
  );
}

function RiskRow({ r }: { r: ClientRisk }) {
  const n = NIVEL[r.nivel];
  return (
    <tr className={cn("border-b last:border-0 hover:bg-muted/30", n.row)}>
      <td className="px-3 py-2">
        <Link href={`/clientes/${r.id}`} className="font-medium hover:underline">
          {r.nombre}
        </Link>
        {r.pack && <span className="ml-2 text-[10px] text-muted-foreground">{r.pack}</span>}
      </td>
      <td className="px-3 py-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", n.badge)}>
          {n.label}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {r.señales.map((s, i) => (
            <span
              key={i}
              className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "emerald" | "muted";
}) {
  const accent = {
    red: "text-red-700 dark:text-red-400",
    amber: "text-amber-700 dark:text-amber-400",
    emerald: "text-emerald-700 dark:text-emerald-400",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className={cn("text-3xl font-bold tabular-nums", accent)}>{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
