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
      "id, titulo, contenido, categoria, tags, scope, creado_por_id, use_count, last_used_at, created_at, updated_at"
    )
    .order("use_count", { ascending: false })
    .order("updated_at", { ascending: false });

  // Resolvemos el nombre del creador en una query aparte: el FK auto-named de
  // Postgres no siempre matchea la sintaxis ambient de Supabase, asi que mejor
  // hacemos un map manual.
  const creadorIds = Array.from(
    new Set(((data ?? []) as { creado_por_id: string | null }[])
      .map((d) => d.creado_por_id)
      .filter((id): id is string => !!id))
  );
  const { data: creadores } = creadorIds.length
    ? await supabase
        .from("users")
        .select("id, nombre")
        .in("id", creadorIds)
    : { data: [] as { id: string; nombre: string }[] };
  const nombreById = new Map<string, string>(
    ((creadores ?? []) as { id: string; nombre: string }[]).map((u) => [
      u.id,
      u.nombre,
    ])
  );

  const templates: TemplateRow[] = ((data ?? []) as TemplateRow[]).map(
    (t) => ({
      ...t,
      creador_nombre: t.creado_por_id
        ? nombreById.get(t.creado_por_id) ?? null
        : null,
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
