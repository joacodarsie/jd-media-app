/**
 * El antes y el después de una cuenta (17/10/2026). Se arma solo con las
 * fotos automáticas del Instagram (lib/crecimiento): la grilla de antes contra
 * la de hoy, los números que cambiaron y la curva de seguidores. Sin JS en el
 * cliente: sirve igual para la ficha y para el portal.
 */
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Crecimiento, FotoCompleta } from "@/lib/crecimiento/cargar";
import { PortalIgChart } from "@/components/portal-ig-chart";
import { cn } from "@/lib/utils";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (iso: string) => `${+iso.slice(8, 10)} ${MESES[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");

function Grilla({ foto, titulo, marcada }: { foto: FotoCompleta; titulo: string; marcada?: boolean }) {
  const celdas = foto.grilla.slice(0, 9);
  return (
    <figure className={cn("rounded-2xl border p-3 sm:p-4", marcada ? "border-primary/60 bg-primary/5" : "bg-card")}>
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className={cn("text-xs font-bold uppercase tracking-widest", marcada ? "text-primary" : "text-muted-foreground")}>{titulo}</span>
        <span className="text-xs text-muted-foreground">{fechaCorta(foto.fecha)}</span>
      </figcaption>
      {celdas.length ? (
        <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
          {celdas.map((c, i) => (
            <a
              key={c.img}
              href={c.permalink ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block aspect-square overflow-hidden bg-muted animate-in fade-in zoom-in-95 fill-mode-both duration-500"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              {c.tipo === "VIDEO" && (
                <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">REEL</span>
              )}
            </a>
          ))}
        </div>
      ) : (
        <div className="grid aspect-square place-items-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
          <span className="px-6">Sin publicaciones todavía</span>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {foto.posts_mes ?? 0} {foto.posts_mes === 1 ? "publicación" : "publicaciones"} en los 30 días previos
        {foto.seguidores ? ` · ${fmt(foto.seguidores)} seguidores` : ""}
      </p>
    </figure>
  );
}

function Anillo({ puntaje }: { puntaje: number }) {
  const largo = 2 * Math.PI * 52;
  const color = puntaje >= 80 ? "#1fbf6a" : puntaje >= 60 ? "#e6b800" : puntaje >= 40 ? "#ff9a1f" : "#ff4d4d";
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-muted" />
        <circle
          cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round" stroke={color}
          strokeDasharray={largo} strokeDashoffset={largo * (1 - puntaje / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex items-baseline justify-center pt-9">
        <span className="text-3xl font-black tabular-nums">{puntaje}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

export function CrecimientoVista({ datos, nombre }: { datos: Crecimiento; nombre: string }) {
  const { inicio, hoy, comparaciones, seguidores, meses } = datos;
  if (!inicio && !hoy) return null;
  const ultima = hoy ?? inicio!;
  const flojos = (ultima.pilares ?? []).filter((p) => p.estado !== "bien").sort((a, b) => a.nota - b.nota).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* El antes y el después del feed */}
      {inicio && hoy ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">
            {meses ? `${meses} ${meses === 1 ? "mes" : "meses"} trabajando juntos` : "El antes y el después"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Grilla foto={inicio} titulo={inicio.real ? "Al arrancar" : "Antes de arrancar"} />
            <Grilla foto={hoy} titulo="Hoy" marcada />
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Cómo arranca {nombre}</h2>
          <div className="max-w-md">
            <Grilla foto={ultima} titulo="Al arrancar" marcada />
          </div>
          <p className="text-sm text-muted-foreground">
            Esta es la foto del arranque. En un mes se saca la siguiente sola y acá aparece el antes y el después.
          </p>
        </section>
      )}

      {/* Lo que cambió */}
      {comparaciones.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {comparaciones.map((c, i) => {
            const igual = c.antes === c.hoy;
            return (
              <div
                key={c.clave}
                className="rounded-2xl border bg-card p-4 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
                style={{ animationDelay: `${150 + i * 80}ms` }}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.titulo}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground line-through decoration-1">{fmt(c.antes)}</span>
                  <span className="text-2xl font-black tabular-nums">{fmt(c.hoy)}</span>
                </div>
                <div
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                    igual ? "bg-muted text-muted-foreground" : c.mejoro ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                  )}
                >
                  {igual ? <Minus className="h-3 w-3" /> : c.mejoro ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {igual ? "igual" : c.cambio}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{c.explicacion}</p>
              </div>
            );
          })}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Seguidores */}
        {seguidores.length >= 2 && (
          <section className="rounded-2xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold">Seguidores</h3>
            <PortalIgChart points={seguidores} />
          </section>
        )}

        {/* Cómo está hoy */}
        {ultima.puntaje !== null && (
          <section className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Cómo está la cuenta hoy</h3>
            <div className="flex items-center gap-5">
              <Anillo puntaje={ultima.puntaje} />
              <div className="flex-1 space-y-2">
                {(ultima.pilares ?? []).map((p) => (
                  <div key={p.clave}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold">{p.titulo}</span>
                      <span className="tabular-nums text-muted-foreground">{p.nota}/25</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", p.estado === "bien" ? "bg-emerald-500" : p.estado === "medio" ? "bg-amber-400" : "bg-rose-500")}
                        style={{ width: `${(p.nota / 25) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {flojos.length > 0 && (
              <ol className="mt-4 space-y-1.5 border-t pt-3 text-sm">
                {flojos.map((p, i) => (
                  <li key={p.clave} className="flex gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                    <span><b>{p.dato}.</b> {p.mejora}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
