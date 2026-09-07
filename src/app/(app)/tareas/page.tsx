import Link from "next/link";
import { requireUser, getAccessibleClientIds, isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import type { TaskWithRels } from "@/lib/types";
import { TaskViews } from "@/components/task-views";
import { TaskRequestsPanel } from "@/components/task-requests-panel";
import { pedidosPendientes } from "./pedidos-actions";

export const dynamic = "force-dynamic";

const TASK_SELECT =
  "id,titulo,estado,prioridad,area,fecha_limite,asignado_a_id,cliente_id,created_at,descripcion,creado_por_id,fecha_completada,links,updated_at,cliente:clients(id,nombre),asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)";

// Cuántas tareas archivadas (completadas hace +30 días) traer. Crecen sin
// techo con el tiempo y están ocultas por defecto, así que sólo cargamos las
// más recientes para que el filtro "Archivada" siga funcionando sin arrastrar
// años de historia en cada carga.
const ARCHIVED_LIMIT = 100;

export default async function TareasPage({
  searchParams,
}: {
  searchParams?: { ver?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  /**
   * Visibilidad. Staff (admin/coordinador) ve TODAS las tareas.
   *
   * El resto ve SOLO LO SUYO por defecto. Antes veía además todo lo de las
   * cuentas que lleva, y eso rompía la lista de quien está en muchas cuentas:
   * Carlos es el editor de casi todas, así que le caían también las tareas de
   * diseño y de community de cada una. Con 260 tareas abiertas, una lista que
   * no es tuya se deja de mirar.
   *
   * El que igual quiera ver cómo viene su cuenta lo tiene a un clic, pero es
   * una decisión suya y no el estado por defecto.
   */
  const verCuentas = searchParams?.ver === "cuentas";
  const myClientIds = await getAccessibleClientIds(me);
  const esStaff = myClientIds === null;
  const visibilityOr = esStaff
    ? null
    : [
        `asignado_a_id.eq.${me.id}`,
        `creado_por_id.eq.${me.id}`,
        ...(verCuentas && myClientIds.length
          ? [`cliente_id.in.(${myClientIds.join(",")})`]
          : []),
      ].join(",");

  // Activas/recientes (todo lo no-archivado) en una query, y las archivadas
  // recientes acotadas en otra; se mergean. El working set no se recorta:
  // nada activo puede quedar afuera.
  let activeQuery = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .neq("estado", "archivada")
    .order("created_at", { ascending: false });
  let archivedQuery = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("estado", "archivada")
    .order("fecha_completada", { ascending: false, nullsFirst: false })
    .limit(ARCHIVED_LIMIT);
  if (visibilityOr) {
    activeQuery = activeQuery.or(visibilityOr);
    archivedQuery = archivedQuery.or(visibilityOr);
  }

  const [{ data: activeTasks }, { data: archivedTasks }, users, allClients] =
    await Promise.all([
      activeQuery,
      archivedQuery,
      getActiveUsers(),
      getActiveClients(),
    ]);

  const clients = myClientIds
    ? allClients.filter((c) => myClientIds.includes(c.id))
    : allClients;

  const tasks = [
    ...(activeTasks ?? []),
    ...(archivedTasks ?? []),
  ] as unknown as TaskWithRels[];

  // Los problemas que reportó el equipo. Van arriba de todo y solo los ve
  // quien puede resolverlos: la action devuelve vacío para el resto.
  const pedidos = await pedidosPendientes();

  return (
    <div className="space-y-4">
      <TaskRequestsPanel
        pedidos={pedidos}
        usuarios={(users ?? []).map((u) => ({ id: u.id, nombre: u.nombre }))}
      />

      {/* Solo para quien lleva cuentas: mirar el resto es opcional. */}
      {!esStaff && myClientIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/tareas"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !verCuentas
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-accent"
            }`}
          >
            Mis tareas
          </Link>
          <Link
            href="/tareas?ver=cuentas"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              verCuentas
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-accent"
            }`}
          >
            Todo lo de mis cuentas
          </Link>
        </div>
      )}
      <TaskViews
        tasks={tasks}
        users={users ?? []}
        clients={clients ?? []}
        currentUserId={me.id}
        esCoordinacion={isStaffUser(me)}
      />
    </div>
  );
}
