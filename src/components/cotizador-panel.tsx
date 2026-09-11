"use client";

import { useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AgencyRates, RatePack } from "@/lib/coordinacion";
import {
  costoDeItems,
  resultadoDePrecio,
  precioParaMargen,
  type ItemsCotizacion,
} from "@/lib/finanzas/cotizador";
import { cn } from "@/lib/utils";

const PACKS: RatePack[] = ["Presencia", "Crecimiento", "Escala", "Personalizado"];
const OBJETIVOS = [35, 45, 55];

function ars(n: number) {
  const s = Math.abs(Math.round(n)).toLocaleString("es-AR");
  return `${n < 0 ? "−" : ""}$${s}`;
}

/**
 * Cotizador a medida.
 *
 * Arma una combinación cualquiera de componentes y responde las dos preguntas
 * que antes se contestaban a ojo: cuánto cuesta entregarlo y qué precio hay que
 * poner. El margen que muestra ya descuenta la parte de gastos fijos que le
 * toca a la cuenta — sin eso el número miente por lo alto.
 */
export function CotizadorPanel({
  rates,
  fijosProrrateados,
  cuentasActivas,
  fijosMensuales,
}: {
  rates: AgencyRates;
  fijosProrrateados: number;
  cuentasActivas: number;
  fijosMensuales: number;
}) {
  const [items, setItems] = useState<ItemsCotizacion>({
    reels: 4,
    piezas: 4,
    cm: "Presencia",
    mediaBuyer: "Presencia",
    manualMarca: true,
    otros: 0,
  });
  const [precio, setPrecio] = useState(400000);
  const [conFijos, setConFijos] = useState(true);

  const costo = useMemo(() => costoDeItems(items, rates), [items, rates]);
  const fijos = conFijos ? fijosProrrateados : 0;
  const res = useMemo(
    () => resultadoDePrecio(precio, costo, rates, { fijosProrrateados: fijos }),
    [precio, costo, rates, fijos]
  );

  const set = <K extends keyof ItemsCotizacion>(k: K, v: ItemsCotizacion[K]) =>
    setItems((p) => ({ ...p, [k]: v }));

  const pctMostrado = conFijos ? res.margenNetoPct : res.margenPct;
  const margenMostrado = conFijos ? res.margenNeto : res.margen;
  const tono = margenMostrado < 0 ? "malo" : pctMostrado < 25 ? "flojo" : "bien";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* ── Qué incluye ── */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Calculator className="h-4 w-4 text-muted-foreground" /> Qué incluye la propuesta
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Campo label="Reels por mes">
              <Num value={items.reels} onChange={(n) => set("reels", n)} />
            </Campo>
            <Campo label="Placas o carruseles">
              <Num value={items.piezas} onChange={(n) => set("piezas", n)} />
            </Campo>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo label="Community manager">
              <Select
                value={items.cm ?? ""}
                onChange={(v) => set("cm", (v || null) as RatePack | null)}
                vacio="Sin CM"
              />
            </Campo>
            <Campo label="Media buyer (pauta)">
              <Select
                value={items.mediaBuyer ?? ""}
                onChange={(v) => set("mediaBuyer", (v || null) as RatePack | null)}
                vacio="Sin pauta"
              />
            </Campo>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Campo label="Otros costos del mes">
              <Num value={items.otros} onChange={(n) => set("otros", n)} prefijo="$" />
            </Campo>
            <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={items.manualMarca}
                onChange={(e) => set("manualMarca", e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Manual de marca ({ars(rates.manual_marca)}, una vez)
            </label>
          </div>

          <div className="mt-5 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Lo que te cuesta
            </p>
            <ul className="mt-2 space-y-1.5">
              {costo.lineas.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Cargá algún componente para ver el costo.
                </li>
              )}
              {costo.lineas.filter((l) => !l.unaVez).map((l) => (
                <li key={l.concepto} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    {l.concepto}{" "}
                    <span className="text-xs text-muted-foreground">{l.detalle}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{ars(l.monto)}</span>
                </li>
              ))}
              {res.coordinacion > 0 && (
                <li className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    Coordinación{" "}
                    <span className="text-xs text-muted-foreground">
                      {Math.round((rates.comision_coordinacion ?? 0) * 100)}% del precio
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{ars(res.coordinacion)}</span>
                </li>
              )}
              {conFijos && fijos > 0 && (
                <li className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    Gastos fijos{" "}
                    <span className="text-xs text-muted-foreground">
                      su parte de {ars(fijosMensuales)} entre {cuentasActivas} cuentas
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{ars(fijos)}</span>
                </li>
              )}
              <li className="flex items-baseline justify-between gap-3 border-t pt-2 text-sm font-bold">
                <span>Costo del mes</span>
                <span className="tabular-nums">{ars(res.costoMensual + fijos)}</span>
              </li>
            </ul>

            {costo.lineas.some((l) => l.unaVez) && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Aparte, una sola vez
                </p>
                <ul className="mt-2 space-y-1.5">
                  {costo.lineas
                    .filter((l) => l.unaVez)
                    .map((l) => (
                      <li key={l.concepto} className="flex items-baseline justify-between gap-3 text-sm">
                        <span>
                          {l.concepto}{" "}
                          <span className="text-xs text-muted-foreground">{l.detalle}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{ars(l.monto)}</span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* ── Qué te deja ── */}
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-5",
              tono === "malo"
                ? "border-rose-400 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10"
                : tono === "flojo"
                  ? "border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
                  : "border-emerald-400 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
            )}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Precio al cliente
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold">$</span>
                  <Input
                    value={String(precio)}
                    onChange={(e) => setPrecio(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
                    className="h-11 w-40 text-xl font-bold tabular-nums"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Te queda
                </p>
                <p className="text-3xl font-bold tabular-nums">{ars(margenMostrado)}</p>
                <p className="text-sm font-semibold tabular-nums">
                  {Math.round(pctMostrado)}% del precio
                </p>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={conFijos}
                onChange={(e) => setConFijos(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              Descontar su parte de los gastos fijos ({ars(fijosProrrateados)} por cuenta)
            </label>

            {margenMostrado < 0 && (
              <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                A este precio la cuenta te cuesta plata todos los meses.
              </p>
            )}
            {margenMostrado >= 0 && pctMostrado < 25 && (
              <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Margen flojo: cualquier mes con una pieza de más lo come entero.
              </p>
            )}
          </div>

          {/* Precio sugerido por margen objetivo */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">Qué precio poner</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Para que la cuenta te deje esto después de pagar su parte de todo.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {OBJETIVOS.map((obj) => {
                const p = precioParaMargen(costo.recurrenteSinCoord, obj, rates, fijos);
                return (
                  <button
                    key={obj}
                    onClick={() => p && setPrecio(p)}
                    disabled={!p}
                    className="rounded-lg border p-3 text-left transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {obj}% para vos
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {p ? ars(p) : "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primer mes */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">El primer mes</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Costos de arranque</span>
                <span className="tabular-nums">{ars(res.arranque)}</span>
              </li>
              <li className="flex justify-between gap-3 font-semibold">
                <span>Te queda el primer mes</span>
                <span
                  className={cn(
                    "tabular-nums",
                    res.margenPrimerMes < 0 && "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {ars(res.margenPrimerMes)}
                </span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Incluye manual de marca, comisión de cierre ({Math.round((rates.comision_cierre ?? 0) * 100)}%)
              y el plus de primer mes. <b>Si la cuenta se va antes del mes 3, el arranque no se recupera.</b>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Num({
  value,
  onChange,
  prefijo,
}: {
  value: number;
  onChange: (n: number) => void;
  prefijo?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {prefijo && <span className="text-sm text-muted-foreground">{prefijo}</span>}
      <Input
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
        className="h-9 tabular-nums"
        inputMode="numeric"
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  vacio,
}: {
  value: string;
  onChange: (v: string) => void;
  vacio: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
    >
      <option value="">{vacio}</option>
      {PACKS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
