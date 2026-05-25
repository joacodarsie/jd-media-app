import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireUser } from "@/lib/auth";
import { getHelpPage, getAllHelpPages, filterByRole } from "@/lib/help/load";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HelpDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const me = await requireUser();
  const page = getHelpPage(params.slug);
  if (!page) notFound();

  // Permiso por rol (igual logica que listing)
  const roles = page.roles ?? ["all"];
  if (!roles.includes("all") && !roles.includes(me.rol)) notFound();

  // Navegacion prev/next dentro de la misma categoria
  const all = filterByRole(getAllHelpPages(), me.rol);
  const sameCat = all.filter((p) => p.category === page.category);
  const idx = sameCat.findIndex((p) => p.slug === page.slug);
  const prev = idx > 0 ? sameCat[idx - 1] : null;
  const next = idx >= 0 && idx < sameCat.length - 1 ? sameCat[idx + 1] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/ayuda">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver a Ayuda
          </Link>
        </Button>
        {page.updated && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Actualizado {page.updated}
          </span>
        )}
      </div>

      <header className="space-y-1.5">
        {page.category && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {page.category}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
        {page.description && (
          <p className="text-base text-muted-foreground">{page.description}</p>
        )}
      </header>

      <article className="space-y-3 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-foreground/90 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul_li]:my-1 [&_ol_li]:my-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:font-normal [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:bg-muted/30 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_blockquote]:text-foreground/80 [&_hr]:my-6 [&_hr]:border-border [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_td]:border [&_td]:p-2 [&_td]:text-sm [&_img]:rounded-lg [&_img]:border">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.content}</ReactMarkdown>
      </article>

      <nav className="grid gap-2 border-t pt-4 sm:grid-cols-2">
        {prev ? (
          <Link
            href={`/ayuda/${prev.slug}`}
            className="rounded-lg border bg-card p-3 transition hover:border-primary/40"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              ← Anterior
            </div>
            <div className="mt-0.5 truncate text-sm font-medium">{prev.title}</div>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/ayuda/${next.slug}`}
            className="rounded-lg border bg-card p-3 text-right transition hover:border-primary/40"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Siguiente →
            </div>
            <div className="mt-0.5 truncate text-sm font-medium">{next.title}</div>
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </div>
  );
}
