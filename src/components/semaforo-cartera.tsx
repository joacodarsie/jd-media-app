/**
 * El semáforo de la cartera arriba de Clientes (19/10/2026): cuántas cuentas
 * están bien, regular y en rojo, y las 3 más en riesgo con su motivo principal.
 * El detalle completo vive en /director.
 */
import Link from "next/link";

type Semaforo = "bien" | "regular" | "mal";

const COLOR: Record<Semaforo, string> = {
  mal: "bg-red-500",
  regular: "bg-amber-400",
  bien: "bg-emerald-500",
};

export function SemaforoCartera({
  resumen,
  peores,
}: {
  resumen: { bien: number; regular: number; mal: number; total: number };
  peores: { id: string; nombre: string; motivo: string; semaforo: Semaforo }[];
}) {
  const tramos: { k: Semaforo; n: number; label: string }[] = [
    { k: "mal", n: resumen.mal, label: "en rojo" },
    { k: "regular", n: resumen.regular, label: "regular" },
    { k: "bien", n: resumen.bien, label: "bien" },
  ];
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">🚦 Salud de la cartera</h2>
        <Link href="/director" className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
          Ver el detalle de cada cuenta →
        </Link>
      </div>
      <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
        {tramos
          .filter((t) => t.n > 0)
          .map((t, i) => (
            <div
              key={t.k}
              className={`h-full ${COLOR[t.k]} jd-semaforo-tramo`}
              style={{ flexGrow: t.n, animationDelay: `${i * 120}ms` }}
              title={`${t.n} ${t.label}`}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {tramos.map((t) => (
          <span key={t.k} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${COLOR[t.k]}`} />
            <b className="text-foreground">{t.n}</b> {t.label}
          </span>
        ))}
      </div>
      {peores.some((p) => p.semaforo === "mal") && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Las más en riesgo (tienen tarea)</p>
          <div className="jd-cascada grid gap-2 sm:grid-cols-3">
            {peores
              .filter((p) => p.semaforo === "mal")
              .map((p) => (
                <Link
                  key={p.id}
                  href={`/clientes/${p.id}`}
                  className="group rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-red-500/30 dark:bg-red-500/10"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60 motion-reduce:hidden" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <span className="truncate">{p.nombre}</span>
                  </div>
                  {p.motivo && <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.motivo}</p>}
                </Link>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
