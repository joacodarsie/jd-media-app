"use client";

// Resumen del mes: a dónde se va la plata de la nómina, agrupada por puesto.
// Responde "¿cuánto estoy pagando y por qué concepto?" sin abrir persona por persona.

import { fmtARS, periodLabel } from "@/lib/finanzas";
import type { PayRule, PayrollSummary } from "@/lib/payroll-summary";
import type { PersonPayroll } from "@/lib/payroll";
import { cn } from "@/lib/utils";

const fmt = (n: number) => fmtARS(n);
const firstName = (n: string) => n.split(" ")[0];

export function SueldosResumen({
  periodo,
  summary,
  rules,
  people,
}: {
  periodo: string;
  summary: PayrollSummary;
  rules: PayRule[];
  people: PersonPayroll[];
}) {
  const ruleByKey = new Map(rules.map((r) => [r.key, r]));
  const maxMonto = Math.max(1, ...summary.puestos.map((p) => Math.abs(p.monto)));
  const pagado = people.filter((p) => p.pagado).reduce((a, p) => a + p.total, 0);
  const pendiente = summary.total - pagado;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
        <Stat label="Total nómina" value={fmt(summary.total)} sub={periodLabel(periodo)} />
        <Stat label="Personas" value={String(people.length)} sub="cobran este mes" />
        <Stat label="Ya pagado" value={fmt(pagado)} tone={pagado > 0 ? "good" : undefined} />
        <Stat
          label="Falta pagar"
          value={fmt(pendiente)}
          tone={pendiente > 0 ? "bad" : "good"}
        />
      </div>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">A dónde va la plata este mes</h2>
          <p className="text-xs text-muted-foreground">
            Cada peso de la nómina, agrupado por el puesto que lo cobra. La regla
            de cada uno está en <strong>Cómo se paga cada puesto</strong>.
          </p>
        </div>

        {summary.puestos.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Todavía no hay nada calculado para este mes.
          </p>
        ) : (
          <ul className="divide-y">
            {summary.puestos.map((p) => {
              const regla = ruleByKey.get(p.key)?.regla;
              const negativo = p.monto < 0;
              return (
                <li key={p.key} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{p.label}</span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          negativo && "text-red-600"
                        )}
                      >
                        {fmt(p.monto)}
                      </span>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {Math.round(p.pctNomina)}%
                      </span>
                    </span>
                  </div>

                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", negativo ? "bg-red-500" : "bg-primary")}
                      style={{ width: `${(Math.abs(p.monto) / maxMonto) * 100}%` }}
                    />
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {p.personas.map((persona) => (
                      <span key={persona.userId}>
                        {firstName(persona.nombre)}{" "}
                        <span className="tabular-nums">{fmt(persona.monto)}</span>
                      </span>
                    ))}
                  </div>

                  {regla && (
                    <p className="mt-1 text-[11px] italic text-muted-foreground">{regla}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Cuánto cobra cada persona</h2>
          <p className="text-xs text-muted-foreground">
            El detalle de cada una, y el botón para pagarle, está en{" "}
            <strong>Por persona</strong>.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <tbody>
              {people.map((p) => (
                <tr key={p.userId} className="border-t first:border-t-0">
                  <td className="px-4 py-2 font-medium">{p.nombre}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(p.total)}</td>
                  <td className="w-24 px-4 py-2 text-right">
                    {p.pagado ? (
                      <Badge tone="good">Pagado</Badge>
                    ) : p.registrado ? (
                      <Badge tone="warn">Registrado</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg font-bold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-amber-600"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] capitalize text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Badge({ tone, children }: { tone: "good" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone === "good"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      )}
    >
      {children}
    </span>
  );
}
