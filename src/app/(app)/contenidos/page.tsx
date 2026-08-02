import { hoyYmd } from "@/lib/dates";

import Link from "next/link";
import { requireUser, getAccessibleClientIds, userInRoles } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import type { PublicationWithRels } from "@/lib/types";
import { PublicationsMonth } from "@/components/publications-month";
import { HelpTrigger } from "@/components/help-trigger";
import { DismissibleHint } from "@/components/dismissible-hint";
import { computePuntualidadCuenta, clasificarPieza } from "@/lib/contenidos/puntualidad";

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
      "*, cliente:clients(id,nombre,ig_user_id), creador:users!publications_creado_por_id_fkey(id,nombre,avatar_url), audiovisual:users!publications_audiovisual_id_fkey(id,nombre,avatar_url)"
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

  // Piezas cuya fecha ya pasó y no salieron. Se separan porque se resuelven
  // distinto: la que quedó en "idea" hay que producirla; la que está en revisión
  // solo hay que destrabarla (y es la más barata de recuperar).
  //
  // ⚠️ SOLO CUENTAS ACTIVAS (lo pidió Luz): las piezas de una cuenta que se dio
  // de baja no son trabajo pendiente, nadie las va a publicar. Antes el aviso
  // decía 94 y 25 eran de Alonso (perdido) — un número que no se podía bajar y
  // que además no aparecía en el calendario, porque la grilla ya muestra solo
  // cuentas activas. `clients` viene de getActiveClients() (estado = activo) y
  // ya está recortado a las cuentas que la persona puede ver y al equipo filtrado.
  const hoyISO = hoyYmd();
  const activeClientIds = new Set(clients.map((c) => c.id));
  const atrasadas = computePuntualidadCuenta(
    "todas",
    (
      visiblePubs as {
        cliente_id: string;
        estado: string;
        fecha_publicacion: string | null;
        frenado_cliente?: boolean | null;
      }[]
    )
      .filter((p) => activeClientIds.has(p.cliente_id))
      .map((p) => ({
        cliente_id: p.cliente_id,
        estado: p.estado,
        fecha_publicacion: p.fecha_publicacion,
        frenado_cliente: p.frenado_cliente ?? false,
      })),
    hoyISO
  );

  // Detalle de CUÁLES son: el aviso decía "10 trabadas" y no había forma de
  // saber de qué cuentas. Se agrupa por cliente para poder ir a destrabarlas.
  const nombreCliente = new Map(clients.map((c) => [c.id, c.nombre]));
  const detalleAtrasadas = { trabada: [], nunca_arranco: [], esperando_cliente: [] } as Record<
    "trabada" | "nunca_arranco" | "esperando_cliente",
    { id: string; titulo: string; cliente: string; clienteId: string; fecha: string }[]
  >;
  for (const p of visiblePubs as PublicationWithRels[]) {
    if (!activeClientIds.has(p.cliente_id)) continue;
    const clase = clasificarPieza(
      {
        cliente_id: p.cliente_id,
        estado: p.estado,
        fecha_publicacion: p.fecha_publicacion,
        frenado_cliente: (p as { frenado_cliente?: boolean | null }).frenado_cliente ?? false,
      },
      hoyISO
    );
    if (clase === "trabada" || clase === "nunca_arranco" || clase === "esperando_cliente") {
      detalleAtrasadas[clase].push({
        id: p.id,
        titulo: p.titulo,
        cliente: nombreCliente.get(p.cliente_id) ?? "Sin cuenta",
        clienteId: p.cliente_id,
        fecha: p.fecha_publicacion?.slice(0, 10) ?? "",
      });
    }
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
          <div className="flex flex-wrap items-center gap-2">
            {clienteFiltro && (
              <Link
                href={`/clientes/${clienteFiltro}/plan-mensual`}
                className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
              >
                🎯 Ver plan de contenidos
              </Link>
            )}
            <Link
              href="/contenidos/guiones"
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              📄 Guiones del mes
            </Link>
          </div>
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
      {atrasadas.nuncaArrancaron + atrasadas.trabadas + atrasadas.esperandoCliente > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            {atrasadas.nuncaArrancaron + atrasadas.trabadas + atrasadas.esperandoCliente}{" "}
            publicaciones con la fecha pasada que no salieron
            <span className="font-normal text-amber-900/70 dark:text-amber-100/70">
              {" "}
              — solo cuentas activas
            </span>
          </p>
          <div className="mt-1 space-y-1 text-xs text-amber-900/80 dark:text-amber-100/80">
            {atrasadas.trabadas > 0 && (
              <DetalleAtrasadas
                cantidad={atrasadas.trabadas}
                texto="trabadas de nuestro lado (hechas, esperando revisión interna) — se destraban rápido"
                items={detalleAtrasadas.trabada}
              />
            )}
            {atrasadas.nuncaArrancaron > 0 && (
              <DetalleAtrasadas
                cantidad={atrasadas.nuncaArrancaron}
                texto="quedaron en idea: hay que producirlas"
                items={detalleAtrasadas.nunca_arranco}
              />
            )}
            {atrasadas.esperandoCliente > 0 && (
              <DetalleAtrasadas
                cantidad={atrasadas.esperandoCliente}
                texto="esperando al cliente (frenadas o sin aprobar) — no cuentan como atraso nuestro, pero hay que reclamarlas"
                items={detalleAtrasadas.esperando_cliente}
              />
            )}
          </div>
          <p className="mt-1.5 text-xs text-amber-900/70 dark:text-amber-100/70">
            {atrasadas.ejecucionPct != null && (
              <>Salió el <b>{atrasadas.ejecucionPct}%</b> de lo que ya vencía. </>
            )}
            Si el atraso es del cliente, abrí la pieza y marcá{" "}
            <b>&quot;Lo frenó el cliente&quot;</b>: así el número no le pega al equipo.
          </p>
        </div>
      )}
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

/**
 * Una línea del aviso ámbar que se despliega y muestra CUÁLES son las piezas,
 * agrupadas por cuenta. Antes decía "10 trabadas" y no había forma de saber de
 * qué clientes: el número no se podía accionar.
 */
function DetalleAtrasadas({
  cantidad,
  texto,
  items,
}: {
  cantidad: number;
  texto: string;
  items: { id: string; titulo: string; cliente: string; clienteId: string; fecha: string }[];
}) {
  const porCliente = new Map<string, { clienteId: string; piezas: typeof items }>();
  for (const it of items) {
    if (!porCliente.has(it.cliente))
      porCliente.set(it.cliente, { clienteId: it.clienteId, piezas: [] });
    porCliente.get(it.cliente)!.piezas.push(it);
  }
  const grupos = [...porCliente.entries()].sort((a, b) => b[1].piezas.length - a[1].piezas.length);

  return (
    <details className="group">
      <summary className="cursor-pointer list-none hover:underline">
        <b>{cantidad}</b> {texto}{" "}
        <span className="text-amber-900/60 dark:text-amber-100/60">
          (ver cuáles ▾)
        </span>
      </summary>
      <div className="ml-3 mt-1.5 space-y-2 border-l border-amber-300/60 pl-3 dark:border-amber-500/30">
        {grupos.map(([cliente, { clienteId, piezas }]) => (
          <div key={cliente}>
            <Link
              href={`/contenidos?cliente=${clienteId}`}
              className="font-semibold hover:underline"
            >
              {cliente}
            </Link>{" "}
            <span className="text-amber-900/60 dark:text-amber-100/60">
              · {piezas.length}
            </span>
            <ul className="mt-0.5 space-y-0.5">
              {piezas.slice(0, 8).map((p) => (
                <li key={p.id} className="text-amber-900/70 dark:text-amber-100/70">
                  · {p.titulo}
                  {p.fecha && <span className="opacity-60"> — {p.fecha}</span>}
                </li>
              ))}
              {piezas.length > 8 && (
                <li className="opacity-60">· y {piezas.length - 8} más…</li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
