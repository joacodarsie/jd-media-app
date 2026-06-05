import { requireUser, getAccessibleClientIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import type { TaskWithRels } from "@/lib/types";
import { TaskViews } from "@/components/task-views";

export const dynamic = "force-dynamic";

const TASK_SELECT =
  "id,titulo,estado,prioridad,area,fecha_limite,asignado_a_id,cliente_id,created_at,descripcion,creado_por_id,fecha_completada,links,updated_at,cliente:clients(id,nombre),asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)";

// Cuántas tareas archivadas (completadas hace +30 días) traer. Crecen sin
// techo con el tiempo y están ocultas por defecto, así que sólo cargamos las
// más recientes para que el filtro "Archivada" siga funcionando sin arrastrar
// años de historia en cada carga.
const ARCHIVED_LIMIT = 100;

export default async function TareasPage() {
  const me = await requireUser();
  const supabase = createClient();

  // Visibilidad: staff (admin/coordinador) ve TODAS las tareas. El resto solo
  // ve las suyas (asignadas o creadas por él) + las de las cuentas que lleva.
  const myClientIds = await getAccessibleClientIds(me);
  const visibilityOr =
    myClientIds === null
      ? null
      : [
          `asignado_a_id.eq.${me.id}`,
          `creado_por_id.eq.${me.id}`,
          ...(myClientIds.length
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

  return (
    <TaskViews
      tasks={tasks}
      users={users ?? []}
      clients={clients ?? []}
      currentUserId={me.id}
    />
  );
}
