import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { CaraPersona } from "@/components/cara-persona";
import { NOMBRE_ROL, ROLES, type Rol } from "@/lib/equipo/roles";
import { METRICAS, metricasDe } from "@/lib/objetivos/equipo";
import { procesosDe } from "@/lib/procesos/procesos";
import { getActiveUsers } from "@/lib/cache";
import { ProcesoCard } from "@/components/proceso-vista";
import { cn } from "@/lib/utils";

/**
 * La ficha visual de un rol (21/10/2026): misión, de qué responde, su quincena
 * día por día, con quién trabaja, su parte del arranque, su ritmo, cómo se
 * mide y el manual paso a paso. La usan el Directorio, Mi perfil y la ficha
 * de cada persona. Contenido: `lib/equipo/roles.ts` + `positions`.
 */

/** Clases escritas enteras para que Tailwind las genere. */
export const TONO: Record<Rol["tono"], { suave: string; texto: string; fuerte: string; borde: string }> = {
  amber: { suave: "bg-amber-500/15", texto: "text-amber-700 dark:text-amber-300", fuerte: "bg-amber-500", borde: "ring-amber-500/40" },
  sky: { suave: "bg-sky-500/15", texto: "text-sky-700 dark:text-sky-300", fuerte: "bg-sky-500", borde: "ring-sky-500/40" },
  violet: { suave: "bg-violet-500/15", texto: "text-violet-700 dark:text-violet-300", fuerte: "bg-violet-500", borde: "ring-violet-500/40" },
  emerald: { suave: "bg-emerald-500/15", texto: "text-emerald-700 dark:text-emerald-300", fuerte: "bg-emerald-500", borde: "ring-emerald-500/40" },
  rose: { suave: "bg-rose-500/15", texto: "text-rose-700 dark:text-rose-300", fuerte: "bg-rose-500", borde: "ring-rose-500/40" },
  orange: { suave: "bg-orange-500/15", texto: "text-orange-700 dark:text-orange-300", fuerte: "bg-orange-500", borde: "ring-orange-500/40" },
  indigo: { suave: "bg-indigo-500/15", texto: "text-indigo-700 dark:text-indigo-300", fuerte: "bg-indigo-500", borde: "ring-indigo-500/40" },
  teal: { suave: "bg-teal-500/15", texto: "text-teal-700 dark:text-teal-300", fuerte: "bg-teal-500", borde: "ring-teal-500/40" },
  slate: { suave: "bg-slate-500/15", texto: "text-slate-700 dark:text-slate-300", fuerte: "bg-slate-500", borde: "ring-slate-500/40" },
};

export interface PuestoDB {
  id: string;
  nombre: string;
  descripcion?: string | null;
  alcance_incluye?: string | null;
  alcance_excluye?: string | null;
  kpis?: string | null;
  procesos?: string | null;
}

/** «1, 2, 3, 15, 16» → «1 al 3 · 15 y 16». */
export function rangos(dias: number[]): string {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  const tramos: [number, number][] = [];
  for (const n of d) {
    const ult = tramos[tramos.length - 1];
    if (ult && n === ult[1] + 1) ult[1] = n;
    else tramos.push([n, n]);
  }
  return tramos
    .map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a} y ${b}` : `${a} al ${b}`))
    .join(" · ");
}

export async function RolVista({
  rol,
  puesto,
  gente,
  hoy,
  compacto = false,
}: {
  rol: Rol;
  puesto?: PuestoDB | null;
  gente?: { id: string; nombre: string; avatar_url?: string | null }[];
  /** Día del mes de hoy (para marcarlo en la quincena). */
  hoy?: number;
  /** Sin el manual completo desplegado (para fichas dentro de otra página). */
  compacto?: boolean;
}) {
  const t = TONO[rol.tono];
  const nombre = NOMBRE_ROL[rol.area] ?? puesto?.nombre ?? rol.area;
  const metricas = metricasDe({ id: "x", nombre: "x", rol: "", area: rol.area });
  const procesos = procesosDe(rol.area);
  const equipo = (await getActiveUsers().catch(() => [])) as { id: string; nombre: string; avatar_url: string | null; area: string | null; area_secundaria: string | null }[];
  const genteDe = (area: string) => equipo.filter((u) => u.area === area || u.area_secundaria === area);
  const deDia = new Map<number, string>();
  for (const h of rol.ciclo) for (const d of h.dias) if (!deDia.has(d)) deDia.set(d, h.que);

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <section className={cn("relative overflow-hidden rounded-2xl border bg-card p-5 md:p-6", "animate-in fade-in slide-in-from-bottom-2 duration-500")}>
        <div className={cn("pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl", t.suave)} aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className={cn("flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl ring-1", t.suave, t.borde)}>{rol.emoji}</div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-[11px] font-semibold uppercase tracking-wider", t.texto)}>{rol.grupo}</p>
            <h2 className="text-2xl font-bold leading-tight">{nombre}</h2>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">{rol.mision}</p>
          </div>
          {gente && gente.length > 0 && (
            <div className="flex -space-x-2">
              {gente.slice(0, 6).map((g) => (
                <span key={g.id} title={g.nombre} className="rounded-full ring-2 ring-card">
                  <CaraPersona nombre={g.nombre} url={g.avatar_url} className="h-9 w-9 text-xs" />
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* De qué respondés */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">De qué responde</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rol.respondePor.map((r, i) => (
            <div
              key={r.titulo}
              className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border bg-card p-3 duration-500"
              style={{ animationDelay: `${i * 70}ms`, animationFillMode: "both" }}
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn("h-2 w-2 rounded-full", t.fuerte)} /> {r.titulo}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* La quincena, día por día */}
      {rol.ciclo.length > 0 && (
        <section className="rounded-2xl border bg-card p-4 md:p-5">
          <h3 className="text-sm font-semibold">Su mes, día por día</h3>
          <Link href="/procesos/como-trabajamos" className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            🗓️ Cómo funcionan las quincenas <ArrowRight className="h-3 w-3" />
          </Link>
          <div className="mt-3 space-y-1.5">
            {[
              [1, 15],
              [16, 31],
            ].map(([a, b]) => (
              <div key={a} className="grid gap-1" style={{ gridTemplateColumns: `repeat(16, minmax(0, 1fr))` }}>
                {Array.from({ length: b - a + 1 }, (_, i) => a + i).map((d) => {
                  const que = deDia.get(d);
                  const publica = d === 1 || d === 16;
                  return (
                    <div
                      key={d}
                      title={que ? `Día ${d}: ${que}` : publica ? `Día ${d}: se publica` : `Día ${d}`}
                      className={cn(
                        "relative flex aspect-square items-center justify-center rounded-md text-[10px] font-semibold tabular-nums sm:text-xs",
                        que ? cn(t.fuerte, "text-white") : "bg-muted/60 text-muted-foreground",
                        hoy === d && "ring-2 ring-foreground ring-offset-1 ring-offset-card"
                      )}
                    >
                      {d}
                      {publica && <span className="absolute -top-1.5 right-0 text-[10px]" aria-hidden="true">📣</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {rol.ciclo.map((h) => (
              <li key={h.que} className="flex items-start gap-2 text-xs">
                <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-sm", t.fuerte)} />
                <span>
                  <b>Días {rangos(h.dias)}</b> · {h.que}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Con quién trabaja */}
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h3 className="text-sm font-semibold">Con quién trabaja</h3>
        <div className="mt-3 grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
          <Vinculos titulo="Recibe de" lista={rol.recibeDe} genteDe={genteDe} />
          <div className="flex items-center justify-center gap-2 md:flex-col">
            <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground md:rotate-0" />
            <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1", t.suave, t.borde)}>
              <span aria-hidden="true">{rol.emoji}</span> {nombre}
            </div>
            <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground md:rotate-0" />
          </div>
          <Vinculos titulo="Entrega a" lista={rol.entregaA} genteDe={genteDe} />
        </div>
      </section>

      {/* Sus procesos */}
      {procesos.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">🧩 Sus procesos, paso a paso</h3>
            <Link href={`/procesos?rol=${encodeURIComponent(rol.area)}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Ver todos →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {procesos.slice(0, compacto ? 3 : 6).map((p) => (
              <ProcesoCard key={p.slug} proceso={p} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Arranque */}
        {rol.arranque.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 md:p-5">
            <h3 className="text-sm font-semibold">En una cuenta nueva</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Desde la reunión de diagnóstico (día 1) hasta que publica (día 15).</p>
            <ol className="relative mt-3 space-y-3 border-l-2 border-dashed pl-4">
              {rol.arranque.map((p) => (
                <li key={p.dia} className="relative text-sm">
                  <span className={cn("absolute -left-[25px] top-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white", t.fuerte)}>
                    {p.dia}
                  </span>
                  <b>Día {p.dia}</b> · {p.que}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Ritmo */}
        <section className="rounded-2xl border bg-card p-4 md:p-5">
          <h3 className="text-sm font-semibold">Su ritmo</h3>
          <div className="mt-3 space-y-3">
            {rol.ritmo.map((r) => (
              <div key={r.cuando}>
                <p className={cn("text-[11px] font-semibold uppercase tracking-wide", t.texto)}>{r.cuando}</p>
                <ul className="mt-1 space-y-1">
                  {r.que.map((q) => (
                    <li key={q} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {q}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Qué entra / qué no */}
      {(puesto?.alcance_incluye || puesto?.alcance_excluye) && (
        <div className="grid gap-4 md:grid-cols-2">
          {puesto?.alcance_incluye && (
            <section className="rounded-2xl border bg-card p-4 md:p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" /> Qué es suyo
              </h3>
              <div className="mt-2 text-sm">
                <Markdown>{puesto.alcance_incluye}</Markdown>
              </div>
            </section>
          )}
          {puesto?.alcance_excluye && (
            <section className="rounded-2xl border bg-card p-4 md:p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                <X className="h-4 w-4" /> Qué no es suyo
              </h3>
              <div className="mt-2 text-sm">
                <Markdown>{puesto.alcance_excluye}</Markdown>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Cómo se mide */}
      {metricas.length > 0 && (
        <section className="rounded-2xl border bg-card p-4 md:p-5">
          <h3 className="text-sm font-semibold">Cómo se mide</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Se mide solo con lo que pasa en la plataforma. El avance de cada uno está en «Tus objetivos».</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {metricas.map((m) => (
              <div key={m} className="rounded-xl bg-muted/40 p-3">
                <p className="text-sm font-medium">{METRICAS[m].label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{METRICAS[m].ayuda}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manual paso a paso */}
      {puesto?.procesos && (
        <details className="group rounded-2xl border bg-card p-4 md:p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
            El manual paso a paso
            <span className="text-xs font-normal text-muted-foreground group-open:hidden">Abrir</span>
          </summary>
          <div className="mt-3 text-sm">
            <Markdown>{puesto.procesos}</Markdown>
          </div>
        </details>
      )}

      {/* Herramientas */}
      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h3 className="text-sm font-semibold">Dónde se hace en la plataforma</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rol.herramientas.map((h) => (
            <Link key={h.href} href={h.href} className="group flex items-center justify-between rounded-xl border px-3 py-2 transition-colors hover:bg-muted/50">
              <span>
                <span className="block text-sm font-medium">{h.nombre}</span>
                <span className="block text-xs text-muted-foreground">{h.para}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Vinculos({
  titulo,
  lista,
  genteDe,
}: {
  titulo: string;
  lista: { area: string; que: string }[];
  genteDe: (area: string) => { id: string; nombre: string; avatar_url: string | null }[];
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {lista.map((v) => {
        const otro = ROLES.find((r) => r.area === v.area);
        const gente = genteDe(v.area);
        return (
          <div key={v.area + v.que} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span aria-hidden="true">{otro?.emoji ?? "🌐"}</span>
            <span className="min-w-0">
              <b className="block leading-tight">{NOMBRE_ROL[v.area] ?? v.area}</b>
              <span className="text-xs text-muted-foreground">{v.que}</span>
            </span>
            {gente.length > 0 && (
              <span className="ml-auto flex shrink-0 -space-x-1.5 self-center">
                {gente.slice(0, 3).map((g) => (
                  <span key={g.id} title={g.nombre} className="rounded-full ring-2 ring-card">
                    <CaraPersona nombre={g.nombre} url={g.avatar_url} className="h-6 w-6 text-[9px]" />
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
