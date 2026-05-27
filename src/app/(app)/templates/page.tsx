import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HelpTrigger } from "@/components/help-trigger";
import {
  TemplatesManager,
  type TemplateRow,
} from "@/components/templates-manager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const me = await requireUser();
  const supabase = createClient();

  // RLS filtra: ve los propios y los globales.
  const { data } = await supabase
    .from("message_templates")
    .select(
      "id, titulo, contenido, categoria, tags, scope, creado_por_id, use_count, last_used_at, created_at, updated_at, creador:users!message_templates_creado_por_id_fkey(id,nombre)"
    )
    .order("use_count", { ascending: false })
    .order("updated_at", { ascending: false });

  type Raw = TemplateRow & { creador?: { id: string; nombre: string } | null };
  const templates: TemplateRow[] = ((data ?? []) as unknown as Raw[]).map(
    (t) => ({
      ...t,
      creador_nombre: t.creador?.nombre ?? null,
    })
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 text-primary" />
            Templates
            <HelpTrigger
              slug="templates"
              label="Cómo usar los templates"
              size="md"
            />
          </h1>
          <p className="text-muted-foreground">
            Snippets de texto que se reutilizan. Inserlos desde el chat
            interno, comercial o copy de pubs. Los <b>globales</b> los ve toda
            la agencia, los <b>propios</b> solo vos.
          </p>
        </div>
      </div>

      <TemplatesManager initial={templates} currentUserId={me.id} isAdmin={me.rol === "admin"} />
    </div>
  );
}
