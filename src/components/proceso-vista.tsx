import Link from "next/link";
import { ArrowRight, MonitorSmartphone } from "lucide-react";
import { NOMBRE_ROL, ROLES } from "@/lib/equipo/roles";
import type { Proceso } from "@/lib/procesos/procesos";
import { cn } from "@/lib/utils";

/**
 * Un proceso dibujado como camino de pasos (21/10/2026): ícono grande, una
 * frase, quién lo hace y el botón a la pantalla donde se hace. Lo usan
 * /procesos/[slug] y la ficha de cada rol. Datos: `lib/procesos/procesos.ts`.
 */

function Quien({ area }: { area: string }) {
  if (area === "cliente") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">🙋 Cliente</span>;
  }
  const r = ROLES.find((x) => x.area === area);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
      <span aria-hidden="true">{r?.emoji ?? "👤"}</span> {NOMBRE_ROL[area] ?? area}
    </span>
  );
}

export function ProcesoVista({ proceso }: { proceso: Proceso }) {
  return (
    <ol className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {proceso.pasos.map((p, i) => (
        <li
          key={p.titulo}
          className="animate-in fade-in slide-in-from-bottom-2 relative flex gap-3 rounded-2xl border bg-card p-4 duration-500"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
        >
          <div className="flex shrink-0 flex-col items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl" aria-hidden="true">
              {p.icono}
            </span>
            <span className="mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">{i + 1}</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="font-semibold leading-tight">{p.titulo}</p>
            {p.detalle && <p className="text-xs leading-relaxed text-muted-foreground">{p.detalle}</p>}
            {(p.quien || p.donde) && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {p.quien && <Quien area={p.quien} />}
                {p.donde && (
                  <Link
                    href={p.donde.href}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                  >
                    <MonitorSmartphone className="h-3 w-3" /> {p.donde.nombre}
                  </Link>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
      <li className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl" aria-hidden="true">
          🏁
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Salió bien si</p>
          <p className="text-sm font-medium">{proceso.listo}</p>
        </div>
      </li>
    </ol>
  );
}

/** La tarjeta de un proceso en una grilla. */
export function ProcesoCard({ proceso, className }: { proceso: Proceso; className?: string }) {
  return (
    <Link
      href={`/procesos/${proceso.slug}`}
      className={cn("group flex flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:border-primary/40", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-2xl" aria-hidden="true">
          {proceso.emoji}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="font-semibold leading-tight">{proceso.titulo}</p>
      <p className="text-xs text-muted-foreground">{proceso.para}</p>
      <div className="mt-auto flex items-center gap-1 pt-1" aria-label={`${proceso.pasos.length} pasos`}>
        {proceso.pasos.map((p, i) => (
          <span key={i} title={p.titulo} className="text-sm leading-none" aria-hidden="true">
            {p.icono}
          </span>
        ))}
      </div>
    </Link>
  );
}
