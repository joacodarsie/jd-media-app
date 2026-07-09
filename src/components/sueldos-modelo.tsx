"use client";

// "Cómo se paga cada puesto": el modelo de pago escrito en palabras, con los
// números que están hoy cargados en Coordinación. Es la referencia que explica
// de dónde sale cada línea de la nómina.

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { fmtARS } from "@/lib/finanzas";
import type { AgencySettings } from "@/lib/coordinacion";
import { packPayoutBreakdown, type PayRule } from "@/lib/payroll-summary";
import { cn } from "@/lib/utils";

const fmt = (n: number) => fmtARS(n);

export function SueldosModelo({
  settings,
  rules,
}: {
  settings: AgencySettings;
  rules: PayRule[];
}) {
  const packs = packPayoutBreakdown(settings);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Cómo se paga cada puesto</h2>
          <p className="text-xs text-muted-foreground">
            Las reglas que usa la app para calcular la nómina, con las tarifas que
            tenés cargadas hoy. Si cambiás un número en Coordinación, cambia acá.
          </p>
        </div>
        <Link
          href="/coordinacion"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted"
        >
          <Settings2 className="h-4 w-4" /> Editar tarifas
        </Link>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {rules.map((r) => (
          <section key={r.key} className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold">{r.label}</h3>
            <p className="mt-1 text-sm">{r.regla}</p>
            {r.detalles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {r.detalles.map((d, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-xs text-muted-foreground before:text-muted-foreground/60 before:content-['·']"
                  >
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Un pack completo, repartido</h2>
          <p className="text-xs text-muted-foreground">
            Si una cuenta produce todo su pack y tiene pauta, esto es lo que se
            lleva cada puesto y lo que te queda a vos.
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Pack</th>
                <th className="pb-2 text-right font-medium">Cobrás</th>
                <th className="pb-2 text-right font-medium">CM</th>
                <th className="pb-2 text-right font-medium">Diseño</th>
                <th className="pb-2 text-right font-medium">Edición</th>
                <th className="pb-2 text-right font-medium">Pauta</th>
                <th className="pb-2 text-right font-medium">Coord.</th>
                <th className="pb-2 text-right font-medium">Coord. dis.</th>
                <th className="pb-2 text-right font-medium">Pagás</th>
                <th className="pb-2 text-right font-medium">Te queda</th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.pack} className="border-t">
                  <td className="py-2 font-medium">{p.pack}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(p.precio)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(p.cm)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(p.diseno)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(p.edicion)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(p.pauta)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(p.coordinacion)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(p.coordDiseno)}</td>
                  <td className="py-2 text-right font-medium tabular-nums">{fmt(p.total)}</td>
                  <td
                    className={cn(
                      "py-2 text-right font-semibold tabular-nums",
                      p.queda < 0 ? "text-red-600" : "text-emerald-600"
                    )}
                  >
                    {fmt(p.queda)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {p.precio > 0 ? `${Math.round((p.queda / p.precio) * 100)}%` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Si la cuenta <b>no</b> contrató pauta, ese pago no existe y te queda a
            vos. El primer mes se suman aparte la comisión del comercial y el extra
            de onboarding del equipo, y le cobrás al cliente la puesta en marcha (
            {fmt(settings.rates.puesta_en_marcha ?? 0)}).
          </p>
        </div>
      </section>
    </div>
  );
}
