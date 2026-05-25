import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PublicationWithRels } from "@/lib/types";
import { PublicationsMonth } from "@/components/publications-month";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

export default async function ContenidosPage() {
  await requireUser();
  const supabase = createClient();

  const [
    { data: pubs },
    { data: users },
    { data: clients },
    { data: unseenComments },
  ] = await Promise.all([
    supabase
      .from("publications")
      .select(
        "*, cliente:clients(id,nombre), creador:users!publications_creado_por_id_fkey(id,nombre,avatar_url), audiovisual:users!publications_audiovisual_id_fkey(id,nombre,avatar_url)"
      )
      .order("fecha_publicacion", { ascending: true, nullsFirst: false }),
    supabase.from("users").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("clients")
      .select("id, nombre, estado, cm_id, disenador_id, audiovisual_id")
      .order("nombre"),
    supabase
      .from("client_pub_comments")
      .select("publication_id")
      .is("visto_at", null),
  ]);

  // Map: publication_id → cantidad de comentarios sin ver del cliente
  const unseenByPub: Record<string, number> = {};
  for (const c of (unseenComments ?? []) as { publication_id: string }[]) {
    unseenByPub[c.publication_id] = (unseenByPub[c.publication_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          Calendario de contenidos
          <HelpTrigger
            slug="contenidos-calendario"
            label="Cómo usar el calendario"
            size="md"
          />
        </h1>
        <p className="text-muted-foreground">
          Todo el contenido planificado de la agencia, en un mes. Arrastrá una
          publicación a otro día para reprogramarla.
        </p>
        <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
          <span className="font-semibold">Cómo funciona:</span> al crear una
          publicación se genera <b>automáticamente</b> una tarea de diseño
          (post/carrusel/historia) o de edición (reel/video) asignada al
          miembro del cliente. Aparece en <b>Tareas</b> y en el dashboard de
          esa persona.
        </div>
      </div>
      <PublicationsMonth
        publications={(pubs ?? []) as PublicationWithRels[]}
        clients={clients ?? []}
        users={users ?? []}
        unseenByPub={unseenByPub}
      />
    </div>
  );
}
