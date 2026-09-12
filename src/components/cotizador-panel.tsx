"use client";

import { useMemo, useState } from "react";
import { Calculator, Info, ChevronDown } from "lucide-react";
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
 * poner.
 *
 * La pantalla está partida a propósito en dos columnas de tiempo: el MES 1 y el
 * MES 2 EN ADELANTE. Son dos negocios distintos —el primero paga el manual de
 * marca, la comisión del comercial y el plus de arranque, y los otros no— y
 * mirarlos juntos en un solo número escondía que muchas cuentas arrancan en
 * pérdida y recién se recuperan más adelante.
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
  // Si la venta la cerró el dueño, no hay comisión que pagar. Antes se cobraba
  // siempre y el primer mes salía más caro de lo que era.
  const [conCierre, setConCierre] = useState(true);

  const costo = useMemo(() => costoDeItems(items, rates), [items, rates]);
  const fijos = conFijos ? fijosProrrateados : 0;
  const res = useMemo(
    () =>
      resultadoDePrecio(precio, costo, rates, {
        fijosProrrateados: fijos,
        conComisionCierre: conCierre,
      }),
    [precio, costo, rates, fijos, conCierre]
  );

  const set = <K extends keyof ItemsCotizacion>(k: K, v: ItemsCotizacion[K]) =>
    setItems((p) => ({ ...p, [k]: v }));

  const pctMostrado = conFijos ? res.margenNetoPct : res.margenPct;
  const recurrente = conFijos ? res.margenNeto : res.margen;
  const primerMes = conFijos ? res.margenPrimerMesNeto : res.margenPrimerMes;
  const costoDelMes = res.costoMensual + fijos;
  const tono = recurrente < 0 ? "malo" : pctMostrado < 25 ? "flojo" : "bien";

  // Cuántos meses hay que aguantar la cuenta para recuperar el arranque. Es el
  // número que vuelve tangible la retención: si se va antes, fue pérdida.
  const mesesParaRecuperar =
    primerMes >= 0 ? 1 : recurrente > 0 ? 1 + Math.ceil(-primerMes / recurrente) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
      {/* ══ IZQUIERDA: qué incluye y qué cuesta ══ */}
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

        {/* ── Todos los meses ── */}
        <div className="mt-5 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lo que te cuesta todos los meses
          </p>
          <ul className="mt-2 space-y-1.5">
            {costo.lineas.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Cargá algún componente para ver el costo.
              </li>
            )}
            {costo.lineas
              .filter((l) => !l.unaVez)
              .map((l) => (
                <li key={l.concepto} className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    {l.concepto} <span className="text-xs text-muted-foreground">{l.detalle}</span>
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
            {res.coordGeneral > 0 && (
              <li className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  Coordinación general{" "}
                  <span className="text-xs text-muted-foreground">
                    {Math.round((rates.comision_coord_general ?? 0) * 100)}% del precio
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{ars(res.coordGeneral)}</span>
              </li>
            )}
            {fijos > 0 && (
              <li className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  Gastos fijos{" "}
                  <span className="text-xs text-muted-foreground">su parte de la estructura</span>
                </span>
                <span className="shrink-0 tabular-nums">{ars(fijos)}</span>
              </li>
            )}
            <li className="flex items-baseline justify-between gap-3 border-t pt-2 text-sm font-bold">
              <span>Costo del mes</span>
              <span className="tabular-nums">{ars(costoDelMes)}</span>
            </li>
          </ul>

          <ExplicacionFijos
            conFijos={conFijos}
            setConFijos={setConFijos}
            fijosProrrateados={fijosProrrateados}
            fijosMensuales={fijosMensuales}
            cuentasActivas={cuentasActivas}
          />
        </div>

        {/* ── Solo el primer mes ── */}
        <div className="mt-5 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lo que pagás una sola vez, al arrancar
          </p>

          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={conCierre}
              onChange={(e) => setConCierre(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            La cerró un comercial (comisión{" "}
            {Math.round((rates.comision_cierre ?? 0) * 100)}% del primer abono)
          </label>

          <ul className="mt-2 space-y-1.5">
            {res.arranqueLineas.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Sin costos de arranque: el primer mes deja lo mismo que los demás.
              </li>
            )}
            {res.arranqueLineas.map((l) => (
              <li key={l.concepto} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  {l.concepto} <span className="text-xs text-muted-foreground">{l.detalle}</span>
                </span>
                <span className="shrink-0 tabular-nums">{ars(l.monto)}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 border-t pt-2 text-sm font-bold">
              <span>Costo del arranque</span>
              <span className="tabular-nums">{ars(res.arranque)}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* ══ DERECHA: qué te deja, mes 1 contra mes 2 ══ */}
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
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Precio al cliente
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold">$</span>
            <Input
              value={String(precio)}
              onChange={(e) => setPrecio(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
              className="h-11 w-44 text-xl font-bold tabular-nums"
              inputMode="numeric"
            />
          </div>

          {/* La comparativa: son dos negocios distintos. */}
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-1 text-left font-semibold">&nbsp;</th>
                <th className="pb-1 text-right font-semibold">Mes 1</th>
                <th className="pb-1 text-right font-semibold">Mes 2 en adelante</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <Fila label="Precio" mes1={precio} mes2={precio} />
              <Fila label="Costo del mes" mes1={-costoDelMes} mes2={-costoDelMes} />
              <Fila
                label="Costo del arranque"
                mes1={-res.arranque}
                mes2={null}
                nota="manual de marca, comisión y plus"
              />
              <tr className="border-t">
                <td className="pt-2 font-bold">Te queda</td>
                <td
                  className={cn(
                    "pt-2 text-right text-lg font-bold",
                    primerMes < 0 && "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {ars(primerMes)}
                </td>
                <td className="pt-2 text-right text-lg font-bold">{ars(recurrente)}</td>
              </tr>
              <tr className="text-xs text-muted-foreground">
                <td />
                <td className="text-right">
                  {precio > 0 ? `${Math.round((primerMes / precio) * 100)}% del precio` : "—"}
                </td>
                <td className="text-right">{Math.round(pctMostrado)}% del precio</td>
              </tr>
            </tbody>
          </table>

          {primerMes < 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              El primer mes da pérdida.{" "}
              {mesesParaRecuperar
                ? `Hay que aguantar la cuenta hasta el mes ${mesesParaRecuperar} solo para volver a cero.`
                : "Con este margen no se recupera nunca."}
            </p>
          )}
          {primerMes >= 0 && recurrente >= 0 && pctMostrado < 25 && (
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Margen flojo: cualquier mes con una pieza de más lo come entero.
            </p>
          )}
          {recurrente < 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              A este precio la cuenta te cuesta plata todos los meses, no solo el primero.
            </p>
          )}
        </div>

        {/* Precio sugerido por margen objetivo */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Qué precio poner</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Para que la cuenta te deje esto <b>del mes 2 en adelante</b>, ya con su parte de todo
            descontada.
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
                  <p className="mt-1 text-lg font-bold tabular-nums">{p ? ars(p) : "—"}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({
  label,
  mes1,
  mes2,
  nota,
}: {
  label: string;
  mes1: number;
  mes2: number | null;
  nota?: string;
}) {
  return (
    <tr>
      <td className="py-0.5">
        {label}
        {nota && <span className="ml-1 text-xs text-muted-foreground">{nota}</span>}
      </td>
      <td className="py-0.5 text-right">{ars(mes1)}</td>
      <td className="py-0.5 text-right">
        {mes2 === null ? <span className="text-muted-foreground">—</span> : ars(mes2)}
      </td>
    </tr>
  );
}

/**
 * Qué son los gastos fijos y por qué aparecen dentro de UNA cotización.
 *
 * Es la parte que más confunde: el monotributo o Canva no son de ningún cliente
 * en particular, pero se pagan igual. Si no se reparten, cada cuenta parece
 * dejar más de lo que deja y la suma no cierra con la plata que queda en la
 * cuenta a fin de mes.
 */
function ExplicacionFijos({
  conFijos,
  setConFijos,
  fijosProrrateados,
  fijosMensuales,
  cuentasActivas,
}: {
  conFijos: boolean;
  setConFijos: (v: boolean) => void;
  fijosProrrateados: number;
  fijosMensuales: number;
  cuentasActivas: number;
}) {
  return (
    <div className="mt-3 rounded-lg border bg-muted/40 p-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={conFijos}
          onChange={(e) => setConFijos(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Cobrarle a esta cuenta su parte de los gastos fijos ({ars(fijosProrrateados)})
      </label>
      <details className="group mt-1">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
          ¿Qué son y por qué se los cargo a un cliente?
        </summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            Son los gastos que pagás <b>tengas 1 cliente o 20</b>: monotributo, Canva, las
            licencias de IA, la cuenta propia de JD Media. Hoy suman{" "}
            <b className="text-foreground">{ars(fijosMensuales)} por mes</b> y no son de ningún
            cliente en particular.
          </p>
          <p>
            Pero alguien los tiene que pagar, y los pagan los clientes. Así que se reparten en
            partes iguales entre las{" "}
            <b className="text-foreground">{cuentasActivas} cuentas activas</b>:{" "}
            {ars(fijosMensuales)} ÷ {cuentasActivas} ={" "}
            <b className="text-foreground">{ars(fijosProrrateados)} a cada una</b>.
          </p>
          <p>
            <b className="text-foreground">Para qué sirve:</b> si mirás el margen sin esto, una
            cuenta puede parecer que te deja $60.000 cuando en realidad te deja $5.000. Con el
            tilde puesto, la suma de lo que dejan todas las cuentas es la plata que te queda de
            verdad a fin de mes.
          </p>
          <p>
            Ojo con una trampa: si sumás una cuenta más, esta cifra <b>baja para todas</b> (los
            mismos fijos entre más cuentas). Por eso crecer mejora el margen de las que ya tenés.
          </p>
        </div>
      </details>
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
