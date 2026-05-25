import Link from "next/link";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  getAllHelpPages,
  groupByCategory,
  filterByRole,
} from "@/lib/help/load";
import { HelpSearch } from "@/components/help-search";

// Revalida cada 5 min. El contenido es markdown estatico del repo, no hay
// razon para re-renderizar en cada nav.
export const revalidate = 300;

export default async function AyudaPage() {
  const me = await requireUser();
  const all = getAllHelpPages();
  const visible = filterByRole(all, me.rol);
  const groups = groupByCategory(visible);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Centro de ayuda
            </div>
            <h1 className="text-2xl font-bold">¿Cómo usar la app?</h1>
            <p className="text-sm text-muted-foreground">
              Guías cortas de cada parte de JD Media. Buscá por nombre o
              navegá por categoría.
            </p>
          </div>
        </div>
        <Link
          href="/novedades"
          className="hidden items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:inline-flex"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Novedades
        </Link>
      </div>

      <HelpSearch pages={visible} />

      <div className="grid gap-5">
        {groups.map((g) => (
          <section key={g.category} className="space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {g.category}
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.pages.map((p) => (
                <Link
                  key={p.slug}
                  href={`/ayuda/${p.slug}`}
                  className="group flex items-start justify-between gap-3 rounded-lg border bg-card p-3.5 transition hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{p.title}</div>
                    {p.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No hay páginas de ayuda disponibles todavía.
        </div>
      )}
    </div>
  );
}
