"use client";

import { useMemo, useState } from "react";
import { Calculator, Info, ChevronDown, Check, X } from "lucide-react";
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

/** Debajo de esto el margen no aguanta un mes con una pieza de más. */
const MARGEN_FLOJO = 25;
/** El margen que se considera sano para una cuenta de gestión. */
const MARGEN_SANO = 40;

function ars(n: number) {
  const s = Math.abs(Math.round(n)).toLocaleString("es-AR");
  return `${n < 0 ? "−" : ""}$${s}`;
}

/**
 * Cotizador a medida.
 *
 * La pantalla está partida a propósito en dos tiempos: el MES 1 y el MES 2 EN
 * ADELANTE. Son dos negocios distintos —el primero paga el manual de marca, la
 * comisión del comercial y el plus de arranque, y los otros no— y verlos
 * sumados en un solo número escondía por qué una cuenta que dura poco no se
 * paga sola.
 *
 * Sobre los gastos fijos: NO se descuentan de lo que deja la cuenta, y es a
 * propósito. El monotributo y Canva se pagan igual con o sin este cliente, así
 * que restárselos hace parecer que una cuenta rentable da pérdida y lleva a
 * rechazar plata que conviene tomar. Lo que la cuenta deja es su APORTE; los
 * fijos se muestran aparte, como la vara que ese aporte tiene que superar.
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
  // Si la venta la cerró el dueño, no hay comisión que pagar.
  const [conCierre, setConCierre] = useState(true);

  const costo = useMemo(() => costoDeItems(items, rates), [items, rates]);
  const res = useMemo(
    () =>
      resultadoDePrecio(precio, costo, rates, {
        fijosProrrateados,
        conComisionCierre: conCierre,
      }),
    [precio, costo, rates, fijosProrrateados, conCierre]
  );

  const set = <K extends keyof ItemsCotizacion>(k: K, v: ItemsCotizacion[K]) =>
    setItems((p) => ({ ...p, [k]: v }));

  // Lo que la cuenta APORTA, sin restarle los fijos (ver el comentario de arriba).
  const mes1 = res.margenPrimerMes;
  const recurrente = res.margen;
  const pct = res.margenPct;
  const pctMes1 = precio > 0 ? (mes1 / precio) * 100 : 0;

  // Cuántos meses de la cuenta hacen falta para que lo aportado cubra lo que le
  // toca de estructura desde que arrancó.
  const cubreDesde =
    recurrente > fijosProrrateados
      ? 1 + Math.max(0, Math.ceil((fijosProrrateados - mes1) / (recurrente - fijosProrrateados)))
      : null;

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
        <Bloque titulo="Lo que te cuesta todos los meses" total={res.costoMensual}>
          {costo.lineas.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Cargá algún componente para ver el costo.
            </li>
          )}
          {costo.lineas
            .filter((l) => !l.unaVez)
            .map((l) => (
              <Linea key={l.concepto} concepto={l.concepto} detalle={l.detalle} monto={l.monto} />
            ))}
          {res.coordinacion > 0 && (
            <Linea
              concepto="Coordinación"
              detalle={`${Math.round((rates.comision_coordinacion ?? 0) * 100)}% del precio`}
              monto={res.coordinacion}
            />
          )}
          {res.coordGeneral > 0 && (
            <Linea
              concepto="Coordinación general"
              detalle={`${Math.round((rates.comision_coord_general ?? 0) * 100)}% del precio`}
              monto={res.coordGeneral}
            />
          )}
        </Bloque>

        {/* ── Solo el primer mes ── */}
        <Bloque titulo="Lo que pagás una sola vez, al arrancar" total={res.arranque}>
          <li className="pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={conCierre}
                onChange={(e) => setConCierre(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              La cerró un comercial (comisión{" "}
              {Math.round((rates.comision_cierre ?? 0) * 100)}% del primer abono)
            </label>
          </li>
          {res.arranqueLineas.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Sin costos de arranque: el primer mes deja lo mismo que los demás.
            </li>
          )}
          {res.arranqueLineas.map((l) => (
            <Linea key={l.concepto} concepto={l.concepto} detalle={l.detalle} monto={l.monto} />
          ))}
        </Bloque>
      </div>

      {/* ══ DERECHA: qué te deja ══ */}
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Precio al cliente
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-muted-foreground">$</span>
            <Input
              value={String(precio)}
              onChange={(e) => setPrecio(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
              className="h-12 w-48 text-2xl font-bold tabular-nums"
              inputMode="numeric"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Periodo
              etiqueta="Mes 1"
              sub="el del arranque"
              precio={precio}
              entrega={res.costoMensual}
              arranque={res.arranque}
              queda={mes1}
              pct={pctMes1}
              acento="arranque"
            />
            <Periodo
              etiqueta="Mes 2 en adelante"
              sub="el mes normal"
              precio={precio}
              entrega={res.costoMensual}
              arranque={null}
              queda={recurrente}
              pct={pct}
              acento={recurrente < 0 ? "malo" : Math.round(pct) < MARGEN_FLOJO ? "flojo" : "bien"}
            />
          </div>

          {recurrente < 0 ? (
            <Aviso tono="malo">
              A este precio la cuenta te cuesta plata <b>todos los meses</b>, no solo el primero.
            </Aviso>
          ) : Math.round(pct) < MARGEN_FLOJO ? (
            <Aviso tono="flojo">
              Margen flojo: debajo del {MARGEN_FLOJO}%, cualquier mes con una pieza de más se lo
              come entero.
            </Aviso>
          ) : Math.round(pct) < MARGEN_SANO ? (
            <Aviso tono="flojo">
              Aceptable, pero por debajo del {MARGEN_SANO}% que es lo sano para una cuenta de
              gestión.
            </Aviso>
          ) : null}
        </div>

        {/* La estructura: la vara que el aporte tiene que superar */}
        <Estructura
          fijosProrrateados={fijosProrrateados}
          fijosMensuales={fijosMensuales}
          cuentasActivas={cuentasActivas}
          mes1={mes1}
          recurrente={recurrente}
          cubreDesde={cubreDesde}
        />

        {/* Precio sugerido por margen objetivo */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Qué precio poner</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Para que la cuenta te deje esto <b>del mes 2 en adelante</b>, ya con su parte de la
            estructura cubierta.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {OBJETIVOS.map((obj) => {
              const p = precioParaMargen(costo.recurrenteSinCoord, obj, rates, fijosProrrateados);
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

/** Una de las dos columnas de tiempo: mes 1 o mes 2 en adelante. */
function Periodo({
  etiqueta,
  sub,
  precio,
  entrega,
  arranque,
  queda,
  pct,
  acento,
}: {
  etiqueta: string;
  sub: string;
  precio: number;
  entrega: number;
  arranque: number | null;
  queda: number;
  pct: number;
  acento: "arranque" | "bien" | "flojo" | "malo";
}) {
  const estilo = {
    arranque: "border-sky-300 bg-sky-50/70 dark:border-sky-500/30 dark:bg-sky-500/10",
    bien: "border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10",
    flojo: "border-amber-300 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10",
    malo: "border-rose-300 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10",
  }[acento];

  return (
    <div className={cn("rounded-lg border p-4", estilo)}>
      <p className="text-xs font-semibold uppercase tracking-wide">{etiqueta}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>

      <p
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          queda < 0 && "text-rose-600 dark:text-rose-400"
        )}
      >
        {ars(queda)}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        {Math.round(pct)}% del precio
      </p>

      <dl className="mt-3 space-y-0.5 border-t pt-2 text-xs tabular-nums">
        <Dato label="Precio" valor={ars(precio)} />
        <Dato label="Costo del mes" valor={`− ${ars(entrega)}`} />
        {arranque !== null && <Dato label="Costo del arranque" valor={`− ${ars(arranque)}`} />}
      </dl>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

/**
 * Qué son los gastos fijos y qué tienen que ver con esta cuenta.
 *
 * Es la parte que más confunde, y restarlos del margen de la cuenta era peor
 * que no mostrarlos: hacía parecer que un cliente rentable daba pérdida. Acá se
 * muestran como lo que son — la vara que el aporte de la cuenta tiene que
 * superar para que la agencia gane plata.
 */
function Estructura({
  fijosProrrateados,
  fijosMensuales,
  cuentasActivas,
  mes1,
  recurrente,
  cubreDesde,
}: {
  fijosProrrateados: number;
  fijosMensuales: number;
  cuentasActivas: number;
  mes1: number;
  recurrente: number;
  cubreDesde: number | null;
}) {
  const cubreRecurrente = recurrente >= fijosProrrateados;
  const cubreMes1 = mes1 >= fijosProrrateados;
  const siguiente = cuentasActivas + 1;

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold">Su parte de la estructura</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Lo de arriba es lo que la cuenta te <b>aporta</b>. Con ese aporte se paga la estructura
        que existe igual: hoy le tocan <b>{ars(fijosProrrateados)} por mes</b>.
      </p>

      <ul className="mt-3 space-y-1.5 text-sm">
        <Tilde ok={cubreMes1}>
          Mes 1: aporta {ars(mes1)} de los {ars(fijosProrrateados)} que le tocan
        </Tilde>
        <Tilde ok={cubreRecurrente}>
          Mes 2 en adelante: aporta {ars(recurrente)}
          {cubreRecurrente
            ? ` — ${ars(recurrente - fijosProrrateados)} limpios para vos`
            : " — no le alcanza para pagar su parte"}
        </Tilde>
      </ul>

      {!cubreMes1 && cubreDesde && cubreDesde > 1 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Recién en el <b className="text-foreground">mes {cubreDesde}</b> lo aportado alcanza
          para cubrir toda la estructura que le tocó desde que arrancó.{" "}
          <b className="text-foreground">Si se va antes, la pagaste vos.</b>
        </p>
      )}

      <details className="group mt-3 border-t pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
          ¿De dónde sale ese número?
        </summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            Son los gastos que pagás <b>tengas 1 cliente o 20</b>: monotributo, Canva, las
            licencias de IA, la cuenta propia de JD Media. Hoy suman{" "}
            <b className="text-foreground">{ars(fijosMensuales)} por mes</b> y se reparten entre
            las <b className="text-foreground">{cuentasActivas} cuentas activas</b>:{" "}
            {ars(fijosMensuales)} ÷ {cuentasActivas} ={" "}
            <b className="text-foreground">{ars(fijosProrrateados)} a cada una</b>.
          </p>
          <p>
            <b className="text-foreground">Por qué no se los resto a la cuenta:</b> estos gastos
            los pagás con este cliente o sin él. Si se los restara, una cuenta que te deja plata
            aparecería en rojo y podrías rechazar trabajo que te conviene tomar. Lo que la cuenta
            deja es su aporte; la estructura es la vara.
          </p>
          <p>
            <b className="text-foreground">Y hay una ventaja escondida:</b> con {siguiente}{" "}
            cuentas esta cifra baja a {ars(Math.round(fijosMensuales / siguiente))} para{" "}
            <b>todas</b>. Cada cliente nuevo mejora el resultado de los que ya tenés.
          </p>
        </div>
      </details>
    </div>
  );
}

function Tilde({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <span className="tabular-nums">{children}</span>
    </li>
  );
}

function Aviso({ tono, children }: { tono: "malo" | "flojo"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "mt-3 flex items-start gap-2 text-sm font-medium",
        tono === "malo"
          ? "text-rose-700 dark:text-rose-300"
          : "text-amber-800 dark:text-amber-300"
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Bloque({
  titulo,
  total,
  children,
}: {
  titulo: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <ul className="mt-2 space-y-1.5">
        {children}
        <li className="flex items-baseline justify-between gap-3 border-t pt-2 text-sm font-bold">
          <span>Total</span>
          <span className="tabular-nums">{ars(total)}</span>
        </li>
      </ul>
    </div>
  );
}

function Linea({
  concepto,
  detalle,
  monto,
}: {
  concepto: string;
  detalle: string;
  monto: number;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span>
        {concepto} <span className="text-xs text-muted-foreground">{detalle}</span>
      </span>
      <span className="shrink-0 tabular-nums">{ars(monto)}</span>
    </li>
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
