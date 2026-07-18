import Link from "next/link";
import { requireUser, getAccessibleClientIds, userInRoles } from "@/lib/auth";
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
  searchParams?: { cliente?: string; equipo?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();
  const clienteFiltro = searchParams?.cliente ?? undefined;
  const equipoFiltro = searchParams?.equipo ?? undefined;

  // CM / diseño / audiovisual: solo ven las cuentas que llevan.
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
  let clients = myClientIds
    ? allClients.filter((c) => myClientIds.includes(c.id))
    : allClients;

  // Equipos de trabajo: pills para filtrar el calendario por equipo.
  // (Si la migración 0126 no está aplicada, queda vacío y no se muestra.)
  const [{ data: teamsRaw }, { data: teamClientsRaw }] = await Promise.all([
    supabase.from("teams").select("id, nombre").order("orden"),
    supabase.from("clients").select("id, team_id").not("team_id", "is", null),
  ]);
  const teams = (teamsRaw ?? []) as { id: string; nombre: string }[];
  const teamByClient = new Map(
    ((teamClientsRaw ?? []) as { id: string; team_id: string }[]).map((c) => [c.id, c.team_id])
  );
  let visiblePubs = pubs ?? [];
  if (equipoFiltro && teams.some((t) => t.id === equipoFiltro)) {
    clients = clients.filter((c) => teamByClient.get(c.id) === equipoFiltro);
    const ids = new Set(clients.map((c) => c.id));
    visiblePubs = visiblePubs.filter((p) =>
      ids.has((p as { cliente_id: string }).cliente_id)
    );
  }

  // Map: publication_id → cantidad de comentarios sin ver del cliente
  const unseenByPub: Record<string, number> = {};
  for (const c of (unseenComments ?? []) as { publication_id: string }[]) {
    unseenByPub[c.publication_id] = (unseenByPub[c.publication_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Calendario de contenidos
            <HelpTrigger
              slug="contenidos-calendario"
              label="Cómo usar el calendario"
              size="md"
            />
          </h1>
          <Link
            href="/contenidos/guiones"
            className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            📄 Guiones del mes
          </Link>
        </div>
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
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/contenidos"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${!equipoFiltro ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-accent"}`}
          >
            Todos los equipos
          </Link>
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/contenidos?equipo=${t.id}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${equipoFiltro === t.id ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-accent"}`}
            >
              {t.nombre}
            </Link>
          ))}
        </div>
      )}
      <PublicationsMonth
        publications={visiblePubs as PublicationWithRels[]}
        clients={clients}
        users={users}
        unseenByPub={unseenByPub}
        defaultClientId={clienteFiltro}
        canEdit={userInRoles(me, ["admin", "coordinador", "community_manager"])}
      />
    </div>
  );
}
