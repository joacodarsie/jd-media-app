import Link from "next/link";
import { Megaphone, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireUser } from "@/lib/auth";
import { getChangelogEntries } from "@/lib/help/changelog";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function NovedadesPage() {
  await requireUser();
  const entries = getChangelogEntries();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Novedades
            </div>
            <h1 className="text-2xl font-bold">¿Qué cambió en la app?</h1>
            <p className="text-sm text-muted-foreground">
              Mejoras y nuevas features, ordenadas por fecha.
            </p>
          </div>
        </div>
        <Link
          href="/ayuda"
          className="hidden items-center gap-1 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground sm:inline-flex"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Centro de ayuda
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Sin novedades por ahora.
        </div>
      ) : (
        <ol className="relative space-y-8 border-l-2 border-border/60 pl-6">
          {entries.map((e, i) => (
            <li key={`${e.date}-${i}`} className="relative">
              <span className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {formatDate(e.date)}
                </span>
                {i === 0 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                    Último
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-lg font-bold tracking-tight">
                {e.title}
              </h2>
              <article className="mt-2 space-y-2 text-[14.5px] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {e.bodyMarkdown}
                </ReactMarkdown>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
