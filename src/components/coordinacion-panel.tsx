"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  packCost,
  type AgencySettings,
  type PackName,
  type PackParam,
} from "@/lib/coordinacion";
import { saveAgencySettings } from "@/app/(app)/coordinacion/actions";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function NumInput({
  value,
  onChange,
  prefix,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
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

export function CoordinacionPanel({ initial }: { initial: AgencySettings }) {
  const router = useRouter();
  const [packs, setPacks] = useState<PackParam[]>(initial.packs);
  const [rates, setRates] = useState(initial.rates);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();

  function patchPack(id: PackName, field: keyof PackParam, n: number) {
    setPacks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: n } : p))
    );
    setDirty(true);
  }
  function patchRate(path: string, n: number) {
    setRates((prev) => {
      const next = structuredClone(prev);
      if (path.startsWith("cm.")) next.cm[path.slice(3) as PackName] = n;
      else if (path.startsWith("mb.")) next.media_buyer[path.slice(3) as PackName] = n;
      else (next as unknown as Record<string, number>)[path] = n;
      return next;
    });
    setDirty(true);
  }

  function save() {
    start(async () => {
      const res = await saveAgencySettings({ packs, rates });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Parámetros guardados.");
      setDirty(false);
      router.refresh();
    });
  }

  const rows = useMemo(
    () =>
      packs.map((p) => {
        const costo = packCost(p, rates);
        const margen = p.precio - costo;
        const pct = p.precio > 0 ? Math.round((margen / p.precio) * 100) : 0;
        return { p, costo, margen, pct };
      }),
    [packs, rates]
  );

  return (
    <div className="space-y-5 pb-24">
      {/* Economía por pack — lo más visible */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Economía por pack</h2>
          <p className="text-xs text-muted-foreground">
            Cuánto te cuesta brindar cada pack vs. cuánto te paga el cliente. Se
            recalcula al toque cuando cambiás cualquier valor abajo.
          </p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Pack</th>
                <th className="pb-2 text-right font-medium">Precio cliente</th>
                <th className="pb-2 text-right font-medium">Costo de brindarlo</th>
                <th className="pb-2 text-right font-medium">Margen</th>
                <th className="pb-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, costo, margen, pct }) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">{p.id}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(p.precio)}</td>
                  <td className="py-2 text-right tabular-nums text-muted-foreground">
                    {fmt(costo)}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right font-semibold tabular-nums",
                      margen < 0 ? "text-red-600" : "text-emerald-600"
                    )}
                  >
                    {fmt(margen)}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right font-semibold tabular-nums",
                      pct < 25 ? "text-amber-600" : "text-emerald-600"
                    )}
                  >
                    {pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Costo = CM + (posts × diseño) + (reels × edición) + media buyer. Las
            historias las lleva la CM (incluidas). El manual de marca es un pago
            único, no entra en el costo mensual.
          </p>
        </div>
      </section>

      {/* Tarifas por rol */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Tarifas por rol</h2>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Diseño · por pieza">
              <NumInput prefix="$" value={rates.diseno_pieza} onChange={(n) => patchRate("diseno_pieza", n)} />
            </Field>
            <Field label="Edición · por reel">
              <NumInput prefix="$" value={rates.edicion_reel} onChange={(n) => patchRate("edicion_reel", n)} />
            </Field>
            <Field label="Manual de marca (único)">
              <NumInput prefix="$" value={rates.manual_marca} onChange={(n) => patchRate("manual_marca", n)} />
            </Field>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Community Manager · por pack
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {packs.map((p) => (
                <Field key={p.id} label={p.id}>
                  <NumInput prefix="$" value={rates.cm[p.id]} onChange={(n) => patchRate("cm." + p.id, n)} />
                </Field>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Media Buyer · por pack
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {packs.map((p) => (
                <Field key={p.id} label={p.id}>
                  <NumInput prefix="$" value={rates.media_buyer[p.id]} onChange={(n) => patchRate("mb." + p.id, n)} />
                </Field>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Packs */}
      <section className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Packs</h2>
          <p className="text-xs text-muted-foreground">
            Precio de lista y cantidades de contenido de cada pack.
          </p>
        </div>
        <div className="space-y-4 p-4">
          {packs.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="mb-2 font-medium">{p.id}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Precio cliente">
                  <NumInput prefix="$" value={p.precio} onChange={(n) => patchPack(p.id, "precio", n)} />
                </Field>
                <Field label="Reels">
                  <NumInput value={p.reels} onChange={(n) => patchPack(p.id, "reels", n)} />
                </Field>
                <Field label="Posts">
                  <NumInput value={p.posts} onChange={(n) => patchPack(p.id, "posts", n)} />
                </Field>
                <Field label="Días stories">
                  <NumInput value={p.stories} onChange={(n) => patchPack(p.id, "stories", n)} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Barra de guardado */}
      {dirty && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-lg">
          <span className="text-sm text-muted-foreground">Cambios sin guardar</span>
          <button
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      )}
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
