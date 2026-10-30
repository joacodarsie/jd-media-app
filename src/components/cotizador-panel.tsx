"use client";

import { useMemo, useState } from "react";
import { Calculator, Info, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AgencyRates, PackParam, PrecioReferencia, RatePack } from "@/lib/coordinacion";
import {
  costoDeItems,
  resultadoDePrecio,
  precioParaMargen,
  precioSinPerdidaPrimerMes,
  type ExtraCotizacion,
  type ItemsCotizacion,
} from "@/lib/finanzas/cotizador";
import { cn } from "@/lib/utils";

const PACKS: RatePack[] = ["Presencia", "Crecimiento", "Escala", "Personalizado"];

/**
 * Los márgenes de referencia, dictados por el dueño: 30% es el mínimo real,
 * 40% lo sano para el pack más básico, 50% lo que conviene apuntar.
 */
const OBJETIVOS = [30, 40, 50];

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
 * Los gastos fijos NO entran acá, y es a propósito. El monotributo y Canva se
 * pagan igual con o sin este cliente, así que restárselos hace parecer que una
 * cuenta rentable da pérdida y lleva a rechazar plata que conviene tomar. Acá
 * la pregunta es una sola —¿esta cuenta le suma plata a la agencia?—; si la
 * estructura queda cubierta o no es una pregunta de la cartera entera, y se
 * responde en Finanzas.
 */
/** Lo que se cobra una sola vez: lo dice la nota del precio de referencia, o es de estos. */
const PAGO_UNICO = new Set(["branding", "desarrollo_web", "jornada"]);

export function CotizadorPanel({
  rates: ratesGuardadas,
  packs,
  referencias = [],
}: {
  rates: AgencyRates;
  packs: PackParam[];
  referencias?: PrecioReferencia[];
}) {
  // Para probar "¿y si la dirección creativa pasa al 10%?" sin tocar las tarifas
  // de verdad: todo el cotizador calcula con estos % y no se guarda nada.
  const [pctDireccion, setPctDireccion] = useState(ratesGuardadas.comision_direccion_creativa ?? 0);
  const [pctCartera, setPctCartera] = useState(ratesGuardadas.comision_cartera ?? 0);
  const rates = useMemo(
    () => ({ ...ratesGuardadas, comision_direccion_creativa: pctDireccion, comision_cartera: pctCartera }),
    [ratesGuardadas, pctDireccion, pctCartera]
  );
  const probando =
    pctDireccion !== (ratesGuardadas.comision_direccion_creativa ?? 0) ||
    pctCartera !== (ratesGuardadas.comision_cartera ?? 0);

  // El pack de lista del que se parte. Al tocar cualquier componente a mano la
  // propuesta pasa a ser "a medida".
  const [pack, setPack] = useState<string>("Presencia");
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
    () => resultadoDePrecio(precio, costo, rates, { conComisionCierre: conCierre }),
    [precio, costo, rates, conCierre]
  );

  const set = <K extends keyof ItemsCotizacion>(k: K, v: ItemsCotizacion[K]) => {
    setItems((p) => ({ ...p, [k]: v }));
    if (k !== "manualMarca" && k !== "otros") setPack("");
  };

  // Lo que se puede sumar a la propuesta: los precios de referencia que no son
  // la gestión de redes (esa se arma arriba).
  const agregables = referencias.filter((r) => !r.id.startsWith("redes_"));
  const extras = items.extras ?? [];
  const setExtras = (xs: ExtraCotizacion[]) => setItems((p) => ({ ...p, extras: xs }));

  function agregarExtra(refId: string) {
    const r = agregables.find((x) => x.id === refId);
    const nuevo: ExtraCotizacion = {
      id: `${refId || "otro"}_${Date.now()}`,
      nombre: r?.nombre ?? "",
      precio: r?.precio ?? 0,
      // Lo único que se sabe qué cuesta es la pauta (el media buyer). El resto
      // lo carga quien cotiza.
      costo: refId === "paid_media" ? (rates.media_buyer.Personalizado ?? 0) : 0,
      unaVez: r ? PAGO_UNICO.has(r.id) || /pago único/i.test(r.nota) : false,
    };
    setExtras([...extras, nuevo]);
  }

  function editarExtra(id: string, cambio: Partial<ExtraCotizacion>) {
    setExtras(extras.map((x) => (x.id === id ? { ...x, ...cambio } : x)));
  }

  /** Carga el desglose real de un pack de lista y su precio. */
  function elegirPack(id: string) {
    setPack(id);
    const p = packs.find((x) => x.id === id);
    if (!p) return;
    setItems((prev) => ({
      ...prev,
      reels: p.reels,
      piezas: p.posts,
      portadas: p.portadas,
      cm: p.id,
      mediaBuyer: p.id,
    }));
    setPrecio(p.precio);
  }

  // Lo que la cuenta APORTA, sin restarle los fijos (ver el comentario de arriba).
  const mes1 = res.margenPrimerMes;
  const recurrente = res.margen;
  const pct = res.margenPct;
  // El mes 1 el cliente paga también lo que es de una sola vez.
  const precioMes1 = res.precioMensual + costo.ingresoUnaVezExtras;
  const pctMes1 = precioMes1 > 0 ? (mes1 / precioMes1) * 100 : 0;

  // El piso de la cotización: el precio más bajo con el que el primer mes no da
  // pérdida. Todo lo que esté debajo de esto arranca en rojo.
  const piso = useMemo(
    () => precioSinPerdidaPrimerMes(costo, rates, { conComisionCierre: conCierre }),
    [costo, rates, conCierre]
  );

  // Las referencias de precio, cada una con lo que deja el mes 1 y el mes 2.
  // Se calculan con el mismo motor que el resto para que no puedan discrepar.
  // El margen que el dueño quiere probar, además de los de referencia.
  const [objetivo, setObjetivo] = useState(35);

  const opciones = useMemo(() => {
    const armar = (etiqueta: string, nota: string, p: number | null) => {
      if (p == null) return null;
      const r = resultadoDePrecio(p, costo, rates, { conComisionCierre: conCierre });
      return { etiqueta, nota, precio: p, mes1: r.margenPrimerMes, mes2: r.margen, pct: r.margenPct };
    };
    return [
      armar("Piso", "no perdés plata ni el primer mes", piso),
      ...[...OBJETIVOS, ...(OBJETIVOS.includes(objetivo) || objetivo <= 0 ? [] : [objetivo])]
        .sort((a, b) => a - b)
        .map((obj) =>
          armar(
            `${obj}%`,
            obj === objetivo && !OBJETIVOS.includes(obj)
              ? "tu objetivo"
              : obj === 30
                ? "el mínimo real"
                : obj === 40
                  ? "lo sano"
                  : "lo bueno",
            precioParaMargen(costo.recurrenteSinCoord, obj, rates, 0, {
              conComisionCierre: conCierre,
              extrasMensual: costo.ingresoMensualExtras,
            })
          )
        ),
    ].filter((o): o is NonNullable<typeof o> => o != null);
  }, [costo, rates, conCierre, piso, objetivo]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
      {/* ══ IZQUIERDA: qué incluye y qué cuesta ══ */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Calculator className="h-4 w-4 text-muted-foreground" /> Qué incluye la propuesta
        </h2>

        <div className="mt-4">
          <Campo label="Partir de un pack">
            <select
              value={pack}
              onChange={(e) => (e.target.value ? elegirPack(e.target.value) : setPack(""))}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">A medida</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.reels} reels · {p.posts} piezas · {ars(p.precio)}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
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

        {/* ── Otros servicios de la propuesta ── */}
        <div className="mt-5 border-t pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sumar a la propuesta
          </p>
          {extras.length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-[1fr_6.5rem_6.5rem_auto_auto] gap-2 text-[11px] text-muted-foreground">
                <span>Servicio</span>
                <span>Le cobrás</span>
                <span>Te cuesta</span>
                <span>Una vez</span>
                <span />
              </div>
              {extras.map((x) => (
                <div key={x.id} className="grid grid-cols-[1fr_6.5rem_6.5rem_auto_auto] items-center gap-2">
                  <Input value={x.nombre} onChange={(e) => editarExtra(x.id, { nombre: e.target.value })} className="h-9" placeholder="Qué es" />
                  <Num value={x.precio} onChange={(n) => editarExtra(x.id, { precio: n })} />
                  <Num value={x.costo} onChange={(n) => editarExtra(x.id, { costo: n })} />
                  <input
                    type="checkbox"
                    checked={x.unaVez}
                    onChange={(e) => editarExtra(x.id, { unaVez: e.target.checked })}
                    className="mx-auto h-4 w-4 accent-primary"
                    aria-label="Se cobra una sola vez"
                  />
                  <button
                    type="button"
                    onClick={() => setExtras(extras.filter((y) => y.id !== x.id))}
                    className="text-muted-foreground hover:text-rose-600"
                    aria-label="Sacar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {extras.some((x) => x.costo === 0) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Cargá cuánto te cuesta cada servicio (lo que le pagás a quien lo hace): si queda en $0 el margen sale inflado.
                </p>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) agregarExtra(e.target.value === "__otro" ? "" : e.target.value);
              }}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Agregar un servicio…</option>
              {agregables.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} · {ars(r.precio)}
                </option>
              ))}
              <option value="__otro">Otro (a mano)</option>
            </select>
          </div>
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
          {res.direccionCreativa > 0 && (
            <Linea
              concepto="Dirección creativa"
              detalle={`${Math.round((rates.comision_direccion_creativa ?? 0) * 100)}% del precio, desde el mes 1`}
              monto={res.direccionCreativa}
            />
          )}
          {res.cartera > 0 && (
            <Linea
              concepto="Comisión del closer"
              detalle={`${Math.round((rates.comision_cartera ?? 0) * 100)}% del precio, desde el mes 2`}
              monto={res.cartera}
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
              La cerró un comercial ({Math.round((rates.comision_cierre ?? 0) * 100)}% el primer mes y{" "}
              {Math.round((rates.comision_cartera ?? 0) * 100)}% desde el segundo)
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
            {extras.length > 0 ? "Precio de la gestión de redes (por mes)" : "Precio al cliente"}
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
          {extras.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Total por mes: <b className="text-foreground">{ars(res.precioMensual)}</b>
              {costo.ingresoUnaVezExtras > 0 && (
                <>
                  {" "}· pago único: <b className="text-foreground">{ars(costo.ingresoUnaVezExtras)}</b>
                </>
              )}
            </p>
          )}

          <div className={cn("mt-4 rounded-lg border p-3", probando && "border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Probar otros porcentajes {probando && <span className="text-amber-600 dark:text-amber-400">· simulando</span>}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Campo label="Dirección creativa">
                <Num value={Math.round(pctDireccion * 1000) / 10} onChange={(n) => setPctDireccion(n / 100)} prefijo="%" />
              </Campo>
              <Campo label="Closer desde el mes 2">
                <Num value={Math.round(pctCartera * 1000) / 10} onChange={(n) => setPctCartera(n / 100)} prefijo="%" />
              </Campo>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              No se guarda: es para ver qué pasaría. Los de verdad se cambian en Coordinación → Tarifas.
              {probando && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setPctDireccion(ratesGuardadas.comision_direccion_creativa ?? 0);
                      setPctCartera(ratesGuardadas.comision_cartera ?? 0);
                    }}
                  >
                    Volver a los actuales
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Periodo
              etiqueta="Mes 1"
              sub="el del arranque"
              precio={precioMes1}
              entrega={res.costoMensual - res.cartera}
              arranque={res.arranque}
              queda={mes1}
              pct={pctMes1}
              acento="arranque"
            />
            <Periodo
              etiqueta="Mes 2 en adelante"
              sub="el mes normal"
              precio={res.precioMensual}
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

        {/* Precios de referencia: el piso y los márgenes objetivo */}
        <QuePrecioPoner
          opciones={opciones}
          precioActual={precio}
          onElegir={setPrecio}
          objetivo={objetivo}
          onObjetivo={setObjetivo}
          piso={piso}
        />
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

interface OpcionPrecio {
  etiqueta: string;
  nota: string;
  precio: number;
  mes1: number;
  mes2: number;
  pct: number;
}

/**
 * Las referencias de precio, con lo que deja cada una el mes 1 y el mes 2.
 *
 * La regla que puso el dueño es "no perder plata nunca", y por eso el piso va
 * primero y aparte: un objetivo de margen razonable puede dejar igual el primer
 * mes en rojo, porque la comisión del comercial y el manual de marca se pagan
 * enteros ese mes. Mostrar solo el margen recurrente escondía eso.
 */
function QuePrecioPoner({
  opciones,
  precioActual,
  onElegir,
  piso,
  objetivo,
  onObjetivo,
}: {
  opciones: OpcionPrecio[];
  precioActual: number;
  onElegir: (p: number) => void;
  piso: number | null;
  objetivo: number;
  onObjetivo: (n: number) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Qué precio poner</h3>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Tu margen objetivo
          <Input
            value={String(objetivo)}
            onChange={(e) => onObjetivo(Math.min(Number(e.target.value.replace(/[^\d]/g, "")) || 0, 90))}
            className="h-7 w-14 text-right tabular-nums"
            inputMode="numeric"
          />
          %
        </label>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Tocá una fila para probarla arriba. El <b>%</b> es lo que te queda del mes 2 en adelante.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-1.5 text-left font-semibold">Precio</th>
              <th className="pb-1.5 text-right font-semibold">Mes 1</th>
              <th className="pb-1.5 text-right font-semibold">Mes 2 en adelante</th>
            </tr>
          </thead>
          <tbody>
            {opciones.map((o) => {
              const esPiso = piso != null && o.precio === piso && o.etiqueta === "Piso";
              const enRojo = o.mes1 < 0;
              return (
                <tr
                  key={o.etiqueta}
                  onClick={() => onElegir(o.precio)}
                  className={cn(
                    "cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/60",
                    o.precio === precioActual && "bg-muted"
                  )}
                >
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tabular-nums">{ars(o.precio)}</span>
                      {esPiso && (
                        <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase text-background">
                          Piso
                        </span>
                      )}
                      {!esPiso && (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {o.etiqueta}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{o.nota}</div>
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      enRojo && "font-semibold text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {ars(o.mes1)}
                    {enRojo && <div className="text-[10px] font-normal">perdés plata</div>}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {ars(o.mes2)}
                    <div className="text-[10px] text-muted-foreground">
                      {Math.round(o.pct)}% del precio
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {opciones.some((o) => o.mes1 < 0) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Las filas en rojo tienen un margen mensual razonable pero{" "}
          <b className="text-foreground">arrancan en pérdida</b>: el manual de marca y la comisión
          del comercial se pagan enteros el primer mes. Si vas a cobrar ahí, conviene cobrar la
          puesta en marcha aparte.
        </p>
      )}
    </div>
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
