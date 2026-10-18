import Link from "next/link";

/**
 * Una dirección que no existe (18/10/2026): antes salía la página negra de
 * Next en inglés. Ahora la marca, en castellano y con el camino de vuelta.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="jd-flota flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-lg">
        JD
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Error 404</p>
        <h1 className="text-3xl font-bold tracking-tight">Esta página no existe</h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          Puede que el link esté viejo o que la sección se haya movido. Volvé al inicio y seguí desde ahí.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:-translate-y-0.5 hover:shadow-md active:scale-95"
      >
        Volver a Mi día →
      </Link>
    </main>
  );
}
