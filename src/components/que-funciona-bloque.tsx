import { cargarQueFunciona } from "@/lib/aprendizaje/cargar";
import type { Grupo } from "@/lib/aprendizaje/que-funciona";
import { BloquePlegable } from "@/components/bloque-plegable";
import { cn } from "@/lib/utils";

/**
 * «Qué funciona en esta cuenta» (24/10/2026): las frases que importan en el
 * resumen y, al abrirlo, los formatos, días y horarios con sus barras y las 3
 * mejores piezas. Ver lib/aprendizaje.
 */
export async function QueFuncionaBloque({ clienteId }: { clienteId: string }) {
  const r = await cargarQueFunciona(clienteId).catch(() => null);
  if (!r) return null;
  if (!r.ok)
    return (
      <BloquePlegable emoji="🧪" titulo="Qué funciona en esta cuenta" resumen={r.motivo}>
        <p className="text-sm text-muted-foreground">{r.motivo}</p>
      </BloquePlegable>
    );
  const q = r.datos;
  const veces = (x: number) => `${(Math.round(x * 10) / 10).toLocaleString("es-AR")}×`;
  return (
    <BloquePlegable emoji="🧪" titulo="Qué funciona en esta cuenta" resumen={q.frases[0]}>
      <ul className="space-y-1 text-sm">
        {q.frases.map((f) => (
          <li key={f}>✦ {f}</li>
        ))}
      </ul>
      {q.posts > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Medido en las últimas {q.posts} publicaciones de @{r.usuario} (desde el {q.desde?.slice(8, 10)}/{q.desde?.slice(5, 7)}): {q.promedio} me gusta y comentarios de promedio.
        </p>
      )}
      {q.formatos.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Barras titulo="Formato" grupos={q.formatos} />
          <Barras titulo="Día" grupos={q.dias} />
          <Barras titulo="Horario" grupos={q.franjas.map((g) => ({ ...g, nombre: g.nombre.replace(/^la |^el /, "") }))} />
        </div>
      )}
      {q.top.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Las que más funcionaron</div>
          <div className="grid grid-cols-3 gap-2">
            {q.top.map((t, i) => (
              <a key={i} href={t.permalink ?? "#"} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border bg-muted/30">
                {t.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.imagen} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-full object-cover transition group-hover:opacity-90" />
                ) : (
                  <div className="grid aspect-square place-items-center text-2xl">🎬</div>
                )}
                <div className="px-2 py-1 text-[11px]">
                  <b>{veces(t.x)}</b> <span className="text-muted-foreground">· {t.formato} · {t.fecha.slice(8, 10)}/{t.fecha.slice(5, 7)}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </BloquePlegable>
  );
}

function Barras({ titulo, grupos }: { titulo: string; grupos: Grupo[] }) {
  const max = Math.max(1, ...grupos.map((g) => g.promedio));
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <ul className="space-y-1">
        {grupos.map((g, i) => (
          <li key={g.nombre} className="text-xs">
            <div className="flex justify-between gap-2">
              <span className={cn("truncate first-letter:uppercase", i === 0 && g.n >= 3 && "font-semibold")}>{g.nombre}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {g.promedio} · {g.n}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", i === 0 && g.n >= 3 ? "bg-primary" : "bg-muted-foreground/40")} style={{ width: `${(g.promedio / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
