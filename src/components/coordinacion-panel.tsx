"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  packCost,
  productionBase,
  mbCost,
  type AgencyRates,
  type AgencySettings,
  type PackName,
  type PackParam,
  type RatePack,
} from "@/lib/coordinacion";
import { saveAgencySettings } from "@/app/(app)/coordinacion/actions";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";

export interface PanoramaRow {
  id: string;
  nombre: string;
  pack: string;
  ingreso: number;
  costo: number;
  margen: number;
}

const RATE_PACKS: RatePack[] = ["Presencia", "Crecimiento", "Escala", "Personalizado"];

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}
function pctOf(margen: number, ingreso: number) {
  return ingreso > 0 ? Math.round((margen / ingreso) * 100) : 0;
}

function NumInput({
  value,
  onChange,
  prefix,
}: {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {prefix}
        </span>
      )}
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-8 w-full rounded-md border bg-card px-2 text-sm tabular-nums outline-none focus:border-primary",
          prefix && "pl-5"
        )}
      />
    </div>
  );
}

export function CoordinacionPanel({
  initial,
  panorama,
}: {
  initial: AgencySettings;
  panorama: PanoramaRow[];
}) {
  const router = useRouter();
  const [packs, setPacks] = useState<PackParam[]>(initial.packs);
  const [rates, setRates] = useState(initial.rates);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  // Simulador
  const [simPack, setSimPack] = useState<PackName>("Crecimiento");
  const [simCloser, setSimCloser] = useState(true);
  const [simReferido, setSimReferido] = useState(false);
  const [simManual, setSimManual] = useState(true);

  function patchPack(id: PackName, field: keyof PackParam, n: number) {
    setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: n } : p)));
    setDirty(true);
  }
  function patchRate(path: string, n: number) {
    setRates((prev) => {
      const next = structuredClone(prev);
      if (path.startsWith("cm.")) next.cm[path.slice(3) as RatePack] = n;
      else if (path.startsWith("mb.")) next.media_buyer[path.slice(3) as RatePack] = n;
      else (next as unknown as Record<string, number>)[path] = n;
      return next;
    });
    setDirty(true);
  }

  function save() {
    start(async () => {
      const res = await saveAgencySettings({ packs, rates });
      if (res?.error) return void toast.error(res.error);
      toast.success("Parámetros guardados.");
      setDirty(false);
      router.refresh();
    });
  }

  const packRows = useMemo(
    () =>
      packs.map((p) => {
        const costo = packCost(p, rates);
        const margen = p.precio - costo;
        return { p, costo, margen, pct: pctOf(margen, p.precio) };
      }),
    [packs, rates]
  );

  // Simulador: primer mes vs. meses siguientes vs. año 1
  // La comisión del closer/referido es % del precio del pack seleccionado.
  const sim = useMemo(() => {
    const p = packs.find((x) => x.id === simPack) ?? packs[0];
    const costoRec = packCost(p, rates);
    const margenRec = p.precio - costoRec;
    const closerFull = Math.round(p.precio * (rates.comision_cierre ?? 0.1));
    const referidoFull = Math.round(p.precio * (rates.comision_lead_propio ?? 0.05));
    const ambosFull = Math.round(p.precio * ((rates.comision_cierre ?? 0.1) + (rates.comision_lead_propio ?? 0.05)));
    const closerMonto = simCloser ? closerFull : 0;
    const referidoMonto = simReferido ? referidoFull : 0;
    const manualMonto = simManual ? rates.manual_marca : 0;
    const oneTime = closerMonto + referidoMonto + manualMonto;
    const margenMes1 = margenRec - oneTime;
    const anio1 = margenMes1 + margenRec * 11;
    return {
      p,
      costoRec,
      margenRec,
      closerFull,
      referidoFull,
      ambosFull,
      closerMonto,
      referidoMonto,
      manualMonto,
      oneTime,
      margenMes1,
      anio1,
    };
  }, [packs, rates, simPack, simCloser, simReferido, simManual]);

  // Panorama real (totales)
  const tot = useMemo(() => {
    const ingreso = panorama.reduce((a, r) => a + r.ingreso, 0);
    const costo = panorama.reduce((a, r) => a + r.costo, 0);
    return { ingreso, costo, margen: ingreso - costo, n: panorama.length };
  }, [panorama]);

  return (
    <div className="space-y-5 pb-24">
      {/* ── PANORAMA REAL ───────────────────────────── */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Panorama real de la agencia</h2>
          <p className="text-xs text-muted-foreground">
            Todos los servicios activos con números reales: lo que cobrás vs. lo
            que te cuesta producirlo, según el modelo de tarifas de abajo.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <StatCard label="Ingreso mensual" value={fmt(tot.ingreso)} />
          <StatCard label="Costo producción" value={fmt(tot.costo)} muted />
          <StatCard
            label="Margen mensual"
            value={fmt(tot.margen)}
            tone={tot.margen >= 0 ? "good" : "bad"}
          />
          <StatCard label="Margen %" value={`${pctOf(tot.margen, tot.ingreso)}%`} tone="good" />
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Cuenta</th>
                <th className="pb-2 font-medium">Pack</th>
                <th className="pb-2 text-right font-medium">Ingreso</th>
                <th className="pb-2 text-right font-medium">Costo</th>
                <th className="pb-2 text-right font-medium">Margen</th>
                <th className="pb-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {panorama.map((r) => {
                const pct = pctOf(r.margen, r.ingreso);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 font-medium">{r.nombre}</td>
                    <td className="py-2 text-muted-foreground">{r.pack}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(r.ingreso)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(r.costo)}</td>
                    <td className={cn("py-2 text-right font-semibold tabular-nums", r.margen < 0 ? "text-red-600" : "text-emerald-600")}>
                      {fmt(r.margen)}
                    </td>
                    <td className={cn("py-2 text-right font-semibold tabular-nums", pct < 25 ? "text-amber-600" : "text-emerald-600")}>
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Ingreso = monto real de los servicios mensuales del cliente. Costo =
            CM + (posts × diseño) + (reels × edición) + media buyer del pack. Los
            Personalizado usan las cantidades cargadas en cada cuenta.
          </p>
        </div>
      </section>

      {/* ── Configuración avanzada (colapsable) ──────── */}
      <details className="group rounded-xl border bg-card [&_section]:rounded-none [&_section]:border-0 [&_section]:border-t [&_section]:bg-transparent">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Tarifas, packs y simuladores</h2>
            <p className="text-xs text-muted-foreground">
              La economía de cada pack, el modelo de tarifas por rol y los
              simuladores. Lo abrís solo cuando querés ajustar precios o probar
              un escenario.
            </p>
          </div>
          <span className="shrink-0 rounded-md border px-2 py-1 text-xs text-muted-foreground">
            <span className="group-open:hidden">Mostrar</span>
            <span className="hidden group-open:inline">Ocultar</span>
          </span>
        </summary>

      {/* ── SIMULADOR ───────────────────────────────── */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Simulador de escenarios</h2>
          <p className="text-xs text-muted-foreground">
            Probá un cliente nuevo y mirá la ganancia del primer mes (con costos
            de una vez) vs. los meses siguientes.
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {packs.map((p) => (
              <button
                key={p.id}
                onClick={() => setSimPack(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  simPack === p.id ? "border-primary bg-primary/10 text-foreground" : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {p.id} · {fmt(p.precio)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={simCloser} onChange={(e) => setSimCloser(e.target.checked)} className="h-4 w-4 accent-primary" />
              Comisión closer · {Math.round((rates.comision_cierre ?? 0) * 100)}% (<span className="font-medium">{fmt(sim.closerFull)}</span>)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={simReferido} onChange={(e) => setSimReferido(e.target.checked)} className="h-4 w-4 accent-primary" />
              Lead referido por el equipo · {Math.round((rates.comision_lead_propio ?? 0) * 100)}% (<span className="font-medium">{fmt(sim.referidoFull)}</span>)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={simManual} onChange={(e) => setSimManual(e.target.checked)} className="h-4 w-4 accent-primary" />
              Manual de marca el 1er mes ({fmt(rates.manual_marca)})
            </label>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
            <StatCard label="Margen recurrente" value={fmt(sim.margenRec)} sub={`/mes · ${pctOf(sim.margenRec, sim.p.precio)}%`} tone="good" />
            <StatCard label="Costos 1er mes" value={fmt(sim.oneTime)} sub="una vez" muted />
            <StatCard label="Margen 1er mes" value={fmt(sim.margenMes1)} sub={`${pctOf(sim.margenMes1, sim.p.precio)}% del 1er mes`} tone={sim.margenMes1 >= 0 ? "good" : "bad"} />
            <StatCard label="Ganancia año 1" value={fmt(sim.anio1)} sub="mes1 + 11 recurrentes" tone="good" />
          </div>
        </div>
      </section>

      {/* ── ECONOMÍA POR PACK ───────────────────────── */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Economía por pack (precio de lista)</h2>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Pack</th>
                <th className="pb-2 text-right font-medium">Precio</th>
                <th className="pb-2 text-right font-medium">Costo</th>
                <th className="pb-2 text-right font-medium">Margen</th>
                <th className="pb-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {packRows.map(({ p, costo, margen, pct }) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">{p.id}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(p.precio)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(costo)}</td>
                  <td className={cn("py-2 text-right font-semibold tabular-nums", margen < 0 ? "text-red-600" : "text-emerald-600")}>{fmt(margen)}</td>
                  <td className={cn("py-2 text-right font-semibold tabular-nums", pct < 25 ? "text-amber-600" : "text-emerald-600")}>{pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── TARIFAS ─────────────────────────────────── */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Tarifas por rol</h2>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Diseño · por pieza"><NumInput prefix="$" value={rates.diseno_pieza} onChange={(n) => patchRate("diseno_pieza", n)} /></Field>
            <Field label="Diseño · portada de reel"><NumInput prefix="$" value={rates.portada_reel ?? 0} onChange={(n) => patchRate("portada_reel", n)} /></Field>
            <Field label="Edición · por reel"><NumInput prefix="$" value={rates.edicion_reel} onChange={(n) => patchRate("edicion_reel", n)} /></Field>
            <Field label="Manual de marca (único)"><NumInput prefix="$" value={rates.manual_marca} onChange={(n) => patchRate("manual_marca", n)} /></Field>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Arranque de cliente nuevo
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Puesta en marcha (pago único)">
                <NumInput prefix="$" value={rates.puesta_en_marcha ?? 0} onChange={(n) => patchRate("puesta_en_marcha", n)} />
              </Field>
              <Field label="Extra onboarding equipo · %">
                <NumInput
                  prefix="%"
                  value={Math.round((rates.onboarding_extra_pct ?? 0) * 100)}
                  onChange={(n) => patchRate("onboarding_extra_pct", n / 100)}
                />
              </Field>
            </div>
            <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
              <p>
                <b className="text-emerald-700 dark:text-emerald-400">Puesta en marcha</b>:
                lo que le <b>COBRÁS al cliente</b> (se suma a su 1ª factura).
              </p>
              <p>
                <b className="text-amber-700 dark:text-amber-400">Extra de onboarding</b>:
                lo que le <b>PAGÁS al equipo</b> (CM + Paid Media) el 1er mes de cada
                cuenta. Aplica desde julio 2026; en 0% no se paga a nadie.
              </p>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comercial / comisiones
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Cierre · % del 1er mes">
                <NumInput prefix="%" value={Math.round((rates.comision_cierre ?? 0) * 100)} onChange={(n) => patchRate("comision_cierre", n / 100)} />
              </Field>
              <Field label="Lead propio · % del 1er mes">
                <NumInput prefix="%" value={Math.round((rates.comision_lead_propio ?? 0) * 100)} onChange={(n) => patchRate("comision_lead_propio", n / 100)} />
              </Field>
              <Field label="Comisión de coordinación · % del abono">
                <NumInput prefix="%" value={Math.round((rates.comision_coordinacion ?? 0) * 100)} onChange={(n) => patchRate("comision_coordinacion", n / 100)} />
              </Field>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Comisión del comercial que cierra: <b>cierre + lead propio</b> sobre el
              1er mes. La <b>coordinación</b> cobra su % del abono de cada cuenta que
              coordina, todos los meses.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Diseño gráfico standalone (servicio aparte, sin gestión de redes)
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Diseñador de la cuenta · %">
                <NumInput
                  prefix="%"
                  value={Math.round((rates.diseno_standalone_disenador_pct ?? 0) * 100)}
                  onChange={(n) => patchRate("diseno_standalone_disenador_pct", n / 100)}
                />
              </Field>
              <Field label="Coordinación de diseño · %">
                <NumInput
                  prefix="%"
                  value={Math.round((rates.diseno_standalone_coord_pct ?? 0) * 100)}
                  onChange={(n) => patchRate("diseno_standalone_coord_pct", n / 100)}
                />
              </Field>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Del monto mensual del servicio de diseño standalone: el diseñador de
              la cuenta cobra{" "}
              {Math.round((rates.diseno_standalone_disenador_pct ?? 0) * 100)}% y la
              coordinación de diseño {Math.round((rates.diseno_standalone_coord_pct ?? 0) * 100)}%.
              La agencia se queda el{" "}
              {100 -
                Math.round(
                  ((rates.diseno_standalone_disenador_pct ?? 0) +
                    (rates.diseno_standalone_coord_pct ?? 0)) *
                    100
                )}
              % restante.
            </p>
          </div>
          <RateLadder title="Community Manager · por pack" prefix="cm" rates={rates.cm} onChange={patchRate} />
          <RateLadder title="Media Buyer · por pack" prefix="mb" rates={rates.media_buyer} onChange={patchRate} />
        </div>
      </section>

      {/* ── PACKS ───────────────────────────────────── */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Packs</h2>
          <p className="text-xs text-muted-foreground">Precio de lista y cantidades de contenido.</p>
        </div>
        <div className="space-y-4 p-4">
          {packs.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="mb-2 font-medium">{p.id}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Field label="Precio cliente"><NumInput prefix="$" value={p.precio} onChange={(n) => patchPack(p.id, "precio", n)} /></Field>
                <Field label="Reels"><NumInput value={p.reels} onChange={(n) => patchPack(p.id, "reels", n)} /></Field>
                <Field label="Portadas"><NumInput value={p.portadas ?? p.reels} onChange={(n) => patchPack(p.id, "portadas", n)} /></Field>
                <Field label="Posts"><NumInput value={p.posts} onChange={(n) => patchPack(p.id, "posts", n)} /></Field>
                <Field label="Días stories"><NumInput value={p.stories} onChange={(n) => patchPack(p.id, "stories", n)} /></Field>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Portadas = cuántos reels llevan portada (la hace la diseñadora, {fmt(rates.portada_reel ?? 0)} c/u).
                Por defecto una por reel; bajala si algún reel va sin portada.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COTIZADOR PERSONALIZADO ─────────────────── */}
      <CustomPackEstimator rates={rates} />
      </details>

      {dirty && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg">
          <span className="text-sm text-muted-foreground">Cambios sin guardar</span>
          <button onClick={save} disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}

// Cotizador de pack a medida: estima cuánto cobrar siguiendo la misma lógica de
// costos de los packs (CM + posts×diseño + reels×edición + pauta opcional) y
// proyecta el precio a distintos márgenes sanos.
function CustomPackEstimator({ rates }: { rates: AgencyRates }) {
  const [posts, setPosts] = useState(4);
  const [reels, setReels] = useState(4);
  const [stories, setStories] = useState(8);
  const [precio, setPrecio] = useState(400000);
  const [incluyePauta, setIncluyePauta] = useState(false);
  // Costos posibles del primer mes (one-time)
  const [conManual, setConManual] = useState(false);
  const [conCloser, setConCloser] = useState(false);
  const [conReferido, setConReferido] = useState(false);
  const [conOnboarding, setConOnboarding] = useState(false);

  // Costo fijo de producción (no depende del precio).
  const costoFijo =
    productionBase("Personalizado", posts, reels, rates) +
    (incluyePauta ? mbCost("Personalizado", rates) : 0);

  // Coordinación: SIEMPRE se cuenta (la coordinadora cobra un % del abono).
  const coordMonto = Math.round(precio * (rates.comision_coordinacion ?? 0));
  const costo = costoFijo + coordMonto; // costo recurrente mensual real
  const margenRec = precio - costo;

  // Extra de onboarding del 1er mes: % extra que le pagás a la CM y al Paid Media
  // ese primer mes, sobre su tarifa, por el arranque de la cuenta.
  const onbPct = rates.onboarding_extra_pct ?? 0;
  const cmBase = rates.cm?.["Personalizado"] ?? 0;
  const mbBase = incluyePauta ? mbCost("Personalizado", rates) : 0;
  const onboardingExtra = conOnboarding ? Math.round((cmBase + mbBase) * onbPct) : 0;

  // One-time del 1er mes: manual de marca + comisiones (% del precio cotizado) +
  // extra de onboarding del equipo.
  const oneTime =
    (conManual ? rates.manual_marca : 0) +
    (conCloser ? Math.round(precio * (rates.comision_cierre ?? 0.1)) : 0) +
    (conReferido ? Math.round(precio * (rates.comision_lead_propio ?? 0.05)) : 0) +
    onboardingExtra;
  const margenMes1 = margenRec - oneTime;
  const hayOneTime = oneTime > 0;

  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Cotizador de pack personalizado</h2>
        <p className="text-xs text-muted-foreground">
          Armá un pack a medida, poné el <b>precio que le cotizarías al cliente</b> y
          mirá tus costos y tu ganancia. El costo usa la misma lógica que los packs
          (CM + diseño por pieza + edición y portada por reel + media buyer si
          incluís pauta) y <b>siempre</b> descuenta la comisión de coordinación.
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Posts / carruseles"><NumInput value={posts} onChange={setPosts} /></Field>
          <Field label="Reels"><NumInput value={reels} onChange={setReels} /></Field>
          <Field label="Días stories"><NumInput value={stories} onChange={setStories} /></Field>
          <Field label="Precio cotizado al cliente"><NumInput prefix="$" value={precio} onChange={setPrecio} /></Field>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Check label="Incluye pauta (media buyer)" checked={incluyePauta} onChange={setIncluyePauta} />
          <Check label={`Manual de marca 1er mes (${fmt(rates.manual_marca)})`} checked={conManual} onChange={setConManual} />
          <Check label={`Comisión cierre ${Math.round((rates.comision_cierre ?? 0) * 100)}% (1er mes)`} checked={conCloser} onChange={setConCloser} />
          <Check label={`Comisión lead propio ${Math.round((rates.comision_lead_propio ?? 0) * 100)}% (1er mes)`} checked={conReferido} onChange={setConReferido} />
          <Check label={`Extra onboarding equipo ${Math.round(onbPct * 100)}% (1er mes)`} checked={conOnboarding} onChange={setConOnboarding} />
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
          <StatCard
            label="Costo mensual"
            value={fmt(costo)}
            sub={`incl. coordinación ${fmt(coordMonto)}`}
            muted
          />
          <StatCard
            label="Ganancia recurrente"
            value={fmt(margenRec)}
            sub="por mes"
            tone={margenRec >= 0 ? "good" : "bad"}
          />
          <StatCard
            label="Margen %"
            value={`${pctOf(margenRec, precio)}%`}
            tone={margenRec >= 0 ? "good" : "bad"}
          />
        </div>

        {hayOneTime && (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
            <StatCard label="Costos 1er mes" value={fmt(oneTime)} sub="una vez (manual + comisión)" muted />
            <StatCard
              label="Ganancia 1er mes"
              value={fmt(margenMes1)}
              sub={`${pctOf(margenMes1, precio)}% del 1er mes`}
              tone={margenMes1 >= 0 ? "good" : "bad"}
            />
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          La <b>ganancia recurrente</b> (2° mes en adelante) = precio − costo mensual
          (producción + coordinación + pauta si la marcás). La <b>ganancia del 1er
          mes</b> descuenta además los costos de arranque que tildes. El{" "}
          <b>extra de onboarding</b> es el {Math.round(onbPct * 100)}% que le pagás a
          la CM y al Paid Media <b>solo ese primer mes</b>, sobre su tarifa, por el
          laburo del arranque. Como referencia, los packs rinden 24–40%; bajar del
          25% deja la cuenta muy fina.
        </p>
      </div>
    </section>
  );
}

// Checkbox con label, reutilizable.
function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}

function RateLadder({
  title,
  prefix,
  rates,
  onChange,
}: {
  title: string;
  prefix: "cm" | "mb";
  rates: Record<string, number>;
  onChange: (path: string, n: number) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-4">
        {RATE_PACKS.map((rp) => (
          <Field key={rp} label={rp}>
            <NumInput prefix="$" value={rates[rp] ?? 0} onChange={(n) => onChange(`${prefix}.${rp}`, n)} />
          </Field>
        ))}
      </div>
    </div>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
