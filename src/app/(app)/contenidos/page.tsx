import { requireUser, getAccessibleClientIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import type { PublicationWithRels } from "@/lib/types";
import { PublicationsMonth } from "@/components/publications-month";
import { HelpTrigger } from "@/components/help-trigger";
import { DismissibleHint } from "@/components/dismissible-hint";

export const dynamic = "force-dynamic";

export default async function ContenidosPage({
  searchParams,
}: {
  searchParams?: { cliente?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();
  const clienteFiltro = searchParams?.cliente ?? undefined;

  // CM / diseño / audiovisual / creativa: solo ven las cuentas que llevan.
  // Staff (admin/coordinador) → null = ven todas.
  const myClientIds = await getAccessibleClientIds(me);

  // Traemos TODO el pipeline activo (no publicado, sin límite de fecha) + los
  // publicados de los últimos 180 días. Lo que crece sin techo es la historia
  // de publicados; recortarla mantiene el calendario y el Kanban livianos sin
  // perder el pipeline en curso ni los publicados recientes.
  const publishedSince = new Date(Date.now() - 180 * 86400_000)
    .toISOString()
    .slice(0, 10);

  let pubQuery = supabase
    .from("publications")
    .select(
      "*, cliente:clients(id,nombre), creador:users!publications_creado_por_id_fkey(id,nombre,avatar_url), audiovisual:users!publications_audiovisual_id_fkey(id,nombre,avatar_url)"
    )
    .or(`estado.neq.publicado,fecha_publicacion.gte.${publishedSince}`)
    .order("fecha_publicacion", { ascending: true, nullsFirst: false });
  if (myClientIds) pubQuery = pubQuery.in("cliente_id", myClientIds);

  const [
    { data: pubs },
    { data: unseenComments },
    users,
    allClients,
  ] = await Promise.all([
    pubQuery,
    supabase
      .from("client_pub_comments")
      .select("publication_id")
      .is("visto_at", null),
    getActiveUsers(),
    getActiveClients(),
  ]);

  // Restringir también la lista de clientes (filtros/combobox) a las cuentas
  // visibles para el usuario.
  const clients = myClientIds
    ? allClients.filter((c) => myClientIds.includes(c.id))
    : allClients;

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
        <DismissibleHint
          id="contenidos-como-funciona"
          className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground/80"
        >
          <span className="font-semibold">Cómo funciona:</span> al crear una
          publicación se genera <b>automáticamente</b> una tarea de diseño
          (post/carrusel/historia) o de edición (reel/video) asignada al
          miembro del cliente. Aparece en <b>Tareas</b> y en el dashboard de
          esa persona.
        </DismissibleHint>
      </div>
      <PublicationsMonth
        publications={(pubs ?? []) as PublicationWithRels[]}
        clients={clients}
        users={users}
        unseenByPub={unseenByPub}
        defaultClientId={clienteFiltro}
      />
    </div>
  );
}
