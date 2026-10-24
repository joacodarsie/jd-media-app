import Link from "next/link";
import { BloquePlegable } from "@/components/bloque-plegable";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { periodLabel } from "@/lib/finanzas";
import { cargarRitmoDelMes } from "@/lib/contenidos/ritmo-mes-run";
import { tendencia, type RitmoCuenta } from "@/lib/contenidos/ritmo-mes";

/** Contra el mes anterior a la misma altura: flecha y los dos porcentajes. */
function Tendencia({ c, mesAnt }: { c: RitmoCuenta; mesAnt: string }) {
  const t = tendencia(c.cumplimiento, c.anterior);
  if (!t) return null;
  const tono =
    t === "peor"
      ? "bg-red-500/15 text-red-700 dark:text-red-300"
      : t === "mejor"
        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-1.5 tabular-nums ${tono}`} title={`A esta altura de ${mesAnt} iba ${c.anterior}%; ahora va ${c.cumplimiento}%`}>
      {t === "peor" ? "↓" : t === "mejor" ? "↑" : "="} {mesAnt} {c.anterior}% → {c.cumplimiento}%
    </span>
  );
}

/**
 * Ritmo del mes en Mi día de coordinación y dirección (23/10/2026): una barra
 * por cuenta con lo que salió (verde), lo atrasado (rojo) y la marca de dónde
 * tendría que ir hoy. Las que van al día quedan en una sola línea. Ver
 * lib/contenidos/ritmo-mes.ts.
 */
export async function RitmoDelMes() {
  const hoy = hoyYmd();
  const cuentas = await cargarRitmoDelMes(createAdmin(), hoy).catch(() => []);
  if (!cuentas.length) return null;
  const problemas = cuentas.filter((c) => c.estado !== "al_dia");
  const alDia = cuentas.filter((c) => c.estado === "al_dia");
  const mes = periodLabel(hoy.slice(0, 7)).toLowerCase().replace(/\s*(de\s+)?\d{4}$/, "");
  const [y, m] = hoy.split("-").map(Number);
  const mesAnt = periodLabel(new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)).toLowerCase().slice(0, 3);

  return (
    <BloquePlegable
      id="ritmo"
      emoji="🥁"
      titulo={`Ritmo de ${mes}`}
      resumen={problemas.length ? `${problemas.length} de ${cuentas.length} cuentas van atrás o se les viene la semana encima.` : "Todas las cuentas van al día."}
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-3 rounded-sm bg-emerald-500" /> salió</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-3 rounded-sm bg-red-500" /> atrasada</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-0.5 bg-foreground" /> dónde tendría que ir hoy</span>
        <span>↑↓ contra {mesAnt} a esta misma altura</span>
      </div>

      {problemas.length > 0 && (
        <ul className="mt-3 space-y-2.5">
          {problemas.map((c) => {
            const pct = (n: number) => `${(n / c.plan) * 100}%`;
            return (
              <li key={c.clienteId}>
                <Link href={`/contenidos?cliente=${c.clienteId}`} className="group block rounded-lg px-1 py-0.5 hover:bg-muted/60">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="font-medium group-hover:underline">{c.cliente}</span>
                    <span className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="tabular-nums text-muted-foreground">
                        {c.salieron}/{c.plan}
                      </span>
                      <Tendencia c={c} mesAnt={mesAnt} />
                      {c.atrasadas > 0 && <span className="rounded-full bg-red-500/15 px-1.5 text-red-700 dark:text-red-300">{c.atrasadas} atrasada{c.atrasadas === 1 ? "" : "s"}</span>}
                      {c.enRiesgo > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-amber-800 dark:text-amber-200">⚠ {c.enRiesgo} sin arrancar esta semana</span>}
                      {c.esperandoCliente > 0 && <span className="rounded-full bg-sky-500/15 px-1.5 text-sky-800 dark:text-sky-200">⏳ {c.esperandoCliente} del cliente</span>}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: pct(c.salieron) }} />
                    <div className="absolute inset-y-0 bg-red-500" style={{ left: pct(c.salieron), width: pct(c.atrasadas) }} />
                    <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `calc(${pct(c.deberian)} - 1px)` }} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {alDia.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          ✅ Al día:{" "}
          {alDia.map((c, i) => (
            <span key={c.clienteId}>
              {i > 0 && ", "}
              <Link href={`/contenidos?cliente=${c.clienteId}`} className="hover:underline">
                {c.cliente}
              </Link>
              {c.atrasadas > 0 && <span className="text-red-600 dark:text-red-400"> (1 atrasada)</span>}
              {tendencia(c.cumplimiento, c.anterior) === "peor" && (
                <span className="text-red-600 dark:text-red-400" title={`A esta altura de ${mesAnt} iba ${c.anterior}%; ahora va ${c.cumplimiento}%`}>
                  {" "}↓
                </span>
              )}
            </span>
          ))}
        </p>
      )}
    </BloquePlegable>
  );
}
