import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HelpTrigger } from "@/components/help-trigger";
import { SectionTabs } from "@/components/section-tabs";
import { conocimientoTabs } from "@/lib/section-tabs";
import {
  TemplatesManager,
  type TemplateRow,
} from "@/components/templates-manager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const me = await requireUser();
  const supabase = createClient();

  // RLS filtra: ve los propios y los globales.
  const { data: rawData, error: rawError } = await supabase
    .from("message_templates")
    .select(
      "id, titulo, contenido, categoria, tags, scope, creado_por_id, use_count, last_used_at, created_at, updated_at"
    )
    .order("use_count", { ascending: false })
    .order("updated_at", { ascending: false });

  // Defensiva: si Supabase devuelve algo raro (objeto en lugar de array,
  // error silencioso), forzamos array vacio. Asi no se rompe el render.
  if (rawError) {
    console.error("[/templates] error fetching templates:", rawError);
  }
  const data = Array.isArray(rawData) ? rawData : [];

  // Resolvemos el nombre del creador en una query aparte.
  const creadorIds = Array.from(
    new Set(
      data
        .map((d) => (d as { creado_por_id: string | null }).creado_por_id)
        .filter((id): id is string => !!id)
    )
  );
  let creadores: { id: string; nombre: string }[] = [];
  if (creadorIds.length) {
    const { data: c } = await supabase
      .from("users")
      .select("id, nombre")
      .in("id", creadorIds);
    creadores = Array.isArray(c)
      ? (c as { id: string; nombre: string }[])
      : [];
  }
  const nombreById = new Map<string, string>(
    creadores.map((u) => [u.id, u.nombre])
  );

  const templates: TemplateRow[] = data.map((row) => {
    const t = row as TemplateRow & { tags?: unknown };
    return {
      ...t,
      // PostgreSQL devuelve text[] como array, pero defensiva por si algun
      // driver lo trae como null o string.
      tags: Array.isArray(t.tags) ? (t.tags as string[]) : [],
      creador_nombre: t.creado_por_id
        ? nombreById.get(t.creado_por_id) ?? null
        : null,
    } as TemplateRow;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <SectionTabs tabs={conocimientoTabs} />
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
