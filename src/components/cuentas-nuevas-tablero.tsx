import Link from "next/link";
import type { CuentaNueva, Estado } from "@/lib/retencion/cuentas-nuevas";
import { cn } from "@/lib/utils";
import { ReunionSeDioBoton } from "@/components/reunion-se-dio-boton";

/**
 * Las cuentas en sus primeros 90 días, una tarjeta por cuenta, la peor arriba.
 * Cada tarjeta responde las cinco preguntas que deciden si la cuenta se queda
 * (ver `lib/retencion/cuentas-nuevas.ts`).
 */
const PUNTO: Record<Estado, string> = {
  ok: "bg-emerald-500",
  atento: "bg-amber-500",
  mal: "bg-red-500",
};

const PILL: Record<Estado, { txt: string; cls: string }> = {
  ok: { txt: "Bien", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  atento: { txt: "Atento", cls: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  mal: { txt: "En riesgo", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
};

export function CuentasNuevasTablero({ filas }: { filas: CuentaNueva[] }) {
  if (filas.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No hay cuentas en sus primeros 90 días.
      </div>
    );
  }
  return (
    <div className="jd-cascada grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {filas.map((f) => (
        <div
          key={f.id}
          className={cn(
            // Sin borde rojo (18/10/2026): el estado ya lo dice la etiqueta.
            "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50 animate-in fade-in duration-300"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/clientes/${f.id}`} className="font-semibold hover:underline">
                {f.nombre}
              </Link>
              <p className="text-xs text-muted-foreground">
                Día {f.dia} · {f.mes === 1 ? "primer mes" : `mes ${f.mes}`}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                PILL[f.estado].cls
              )}
            >
              {PILL[f.estado].txt}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {f.chequeos.map((c) => (
              <li key={c.clave} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", PUNTO[c.estado])} />
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span className={cn(c.estado === "mal" && "font-medium")}>{c.detalle}</span>
                </div>
                {c.reunionSinRegistrar && (
                  <ReunionSeDioBoton clienteId={f.id} fecha={c.reunionSinRegistrar} />
                )}
              </li>
            ))}
          </ul>
          {f.alertas.length > 0 && (
            <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
              {f.alertas.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
