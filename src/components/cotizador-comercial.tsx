"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Minus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PackName } from "@/lib/coordinacion";
import {
  cotizarComercial,
  IDS_UNA_VEZ,
  ID_PAUTA_SUELTA,
  type MinimosPorPack,
  type PackComercial,
  type ServicioComercial,
} from "@/lib/comercial/cotizador-comercial";

const $ = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

/**
 * El cotizador del comercial. Tres pasos y un resultado, sin costos del equipo
 * a la vista. El tope de descuento ya viene calculado del servidor.
 */
export function CotizadorComercial({
  packs,
  servicios,
  minimos,
  pctCierre,
  pctCartera,
}: {
  packs: PackComercial[];
  servicios: ServicioComercial[];
  minimos: MinimosPorPack;
  pctCierre: number;
  pctCartera: number;
}) {
  const [pack, setPack] = useState<PackName | null>(packs[0]?.id ?? null);
  const [conPauta, setConPauta] = useState(true);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [horas, setHoras] = useState(1);
  const [descuento, setDescuento] = useState(0);
  const [copiado, setCopiado] = useState(false);

  const r = useMemo(
    () =>
      cotizarComercial({
        propuesta: { pack, conPauta, servicios: elegidos, horasJornada: horas, descuento },
        packs,
        servicios,
        minimos,
        pctCierre,
        pctCartera,
      }),
    [pack, conPauta, elegidos, horas, descuento, packs, servicios, minimos, pctCierre, pctCartera]
  );

  // Con pack, la pauta suelta no se ofrece: ya viene incluida.
  const visibles = servicios.filter((s) => !(pack && s.id === ID_PAUTA_SUELTA));
  const mensuales = visibles.filter((s) => !IDS_UNA_VEZ.includes(s.id));
  const unicos = visibles.filter((s) => IDS_UNA_VEZ.includes(s.id));

  function toggle(id: string) {
    setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function elegirPack(id: PackName | null) {
    setPack(id);
    setDescuento(0);
  }

  async function copiar() {
    const lineas = [
      ...r.mensuales.map((l) => `• ${l.nombre}${l.detalle ? ` (${l.detalle})` : ""}: ${$(l.precio)}`),
      `Abono mensual: ${$(r.abonoMensual)}`,
      ...(r.unaVez.length
        ? ["", "Una sola vez:", ...r.unaVez.map((l) => `• ${l.nombre}: ${$(l.precio)}`), `Primer mes: ${$(r.primerMes)}`]
        : []),
    ];
    try {
      await navigator.clipboard.writeText(lineas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {/* ── 1. Pack ── */}
        <Paso n={1} titulo="Elegí el pack de redes">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {packs.map((p) => (
              <Opcion key={p.id} activa={pack === p.id} onClick={() => elegirPack(p.id)}>
                <div className="font-semibold">{p.id}</div>
                <div className="mt-1 text-lg font-bold tabular-nums">{$(p.precio)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.reels} reels · {p.posts} posteos · {p.stories} días de historias
                </div>
              </Opcion>
            ))}
            <Opcion activa={pack === null} onClick={() => elegirPack(null)}>
              <div className="font-semibold">Sin redes</div>
              <div className="mt-1 text-xs text-muted-foreground">Solo pauta u otros servicios</div>
            </Opcion>
          </div>
          {pack && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={conPauta}
                onChange={(e) => {
                  setConPauta(e.target.checked);
                  setDescuento(0);
                }}
                className="h-4 w-4 accent-primary"
              />
              Incluye gestión de pauta
              <span className="text-muted-foreground">(sin pauta, −$50.000)</span>
            </label>
          )}
        </Paso>

        {/* ── 2. Servicios ── */}
        <Paso n={2} titulo="Sumá servicios">
          <Grupo titulo="Por mes">
            {mensuales.map((s) => (
              <Chip key={s.id} activo={elegidos.includes(s.id)} onClick={() => toggle(s.id)} precio={s.precio}>
                {s.nombre}
              </Chip>
            ))}
          </Grupo>
          <Grupo titulo="Una sola vez">
            {unicos.map((s) => (
              <Chip key={s.id} activo={elegidos.includes(s.id)} onClick={() => toggle(s.id)} precio={s.precio}>
                {s.nombre}
              </Chip>
            ))}
          </Grupo>
          {elegidos.includes("jornada") && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span>Horas de la jornada</span>
              <Contador valor={horas} onChange={setHoras} min={1} max={12} />
              <span className="text-muted-foreground">la 1ª a precio de lista, cada extra $25.000</span>
            </div>
          )}
        </Paso>

        {/* ── 3. Descuento ── */}
        {pack && (
          <Paso n={3} titulo="Descuento">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={descuento || ""}
                  placeholder="0"
                  onChange={(e) => setDescuento(Number(e.target.value) || 0)}
                  className="h-10 w-40 rounded-md border bg-background pl-7 pr-3 text-sm tabular-nums"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                por mes · <b className="text-foreground">hasta {$(r.descuentoMaximo ?? 0)}</b>
              </span>
            </div>
            {r.descuentoRecortado && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                Más de {$(r.descuentoMaximo ?? 0)} la cuenta pierde plata el primer mes. Se aplicó el máximo.
              </p>
            )}
            {r.descuentoMaximo === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">Este pack no admite descuento.</p>
            )}
          </Paso>
        )}
      </div>

      {/* ── Resultado ── */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">El cliente paga</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{$(r.abonoMensual)}</div>
          <div className="text-sm text-muted-foreground">por mes</div>

          {r.mensuales.length > 0 && (
            <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
              {r.mensuales.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className={cn(l.precio < 0 && "text-primary")}>
                    {l.nombre}
                    {l.detalle && <span className="block text-xs text-muted-foreground">{l.detalle}</span>}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", l.precio < 0 && "text-primary")}>
                    {l.precio < 0 ? `− ${$(-l.precio)}` : $(l.precio)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {r.unaVez.length > 0 && (
            <>
              <div className="mt-4 border-t pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Una sola vez
              </div>
              <ul className="mt-2 space-y-2 text-sm">
                {r.unaVez.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {l.nombre}
                      {l.detalle && <span className="block text-xs text-muted-foreground">{l.detalle}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{$(l.precio)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
                <span>Primer mes</span>
                <span className="tabular-nums">{$(r.primerMes)}</span>
              </div>
            </>
          )}

          <button
            onClick={copiar}
            disabled={r.abonoMensual === 0 && r.pagosUnicos === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar para WhatsApp"}
          </button>
        </div>

        {r.abonoMensual > 0 && (
          <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Tu comisión si la cerrás
            </div>
            <div className="mt-2 flex justify-between text-sm">
              <span>Mes 1</span>
              <span className="font-semibold tabular-nums">{$(r.comision.mes1)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span>Desde el mes 2, por mes</span>
              <span className="font-semibold tabular-nums">{$(r.comision.mensual)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Mientras el cliente siga y pague. Lo de una sola vez no suma comisión.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {n}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors hover:border-primary/50",
        activa && "border-primary bg-primary/10"
      )}
    >
      {children}
    </button>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{titulo}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  precio,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  precio: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-primary/50",
        activo && "border-primary bg-primary/10"
      )}
    >
      {activo ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
      {children}
      <span className="tabular-nums text-muted-foreground">{$(precio)}</span>
    </button>
  );
}

function Contador({
  valor,
  onChange,
  min,
  max,
}: {
  valor: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center rounded-md border">
      <button type="button" className="p-2 hover:bg-muted" onClick={() => onChange(Math.max(min, valor - 1))}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center tabular-nums">{valor}</span>
      <button type="button" className="p-2 hover:bg-muted" onClick={() => onChange(Math.min(max, valor + 1))}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
