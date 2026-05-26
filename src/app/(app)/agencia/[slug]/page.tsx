import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { AgencyPageDialog } from "@/components/agency-page-dialog";

// Contenido estable. Revalida cada 60s.
export const revalidate = 60;

export default async function AgencyPageDetail({
  params,
}: {
  params: { slug: string };
}) {
  const me = await requireUser();
  const supabase = createClient();
  const { data: page } = await supabase
    .from("agency_pages")
    .select("slug, title, kind, orden, content, notion_url, updated_at")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!page) notFound();
  const canEdit = isStaff(me.rol);
  const isProcess = page.kind === "proceso" || page.kind === "plantilla";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={isProcess ? "/procesos" : "/agencia"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> {isProcess ? "Procesos" : "Agencia"}
        </Link>
        <div className="flex items-center gap-2">
          {page.notion_url && (
            <a
              href={page.notion_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-muted"
            >
              Notion <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          )}
          {canEdit && (
            <AgencyPageDialog
              mode="edit"
              page={page}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
              }
            />
          )}
        </div>
      </div>

      <h1 className="text-2xl font-bold">{page.title}</h1>
      <article className="prose prose-sm dark:prose-invert max-w-none">
        <Markdown>{page.content}</Markdown>
      </article>
    </div>
  );
}
