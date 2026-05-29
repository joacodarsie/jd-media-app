import { requireUser } from "@/lib/auth";
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

  // Activas/recientes (todo lo no-archivado) en una query, y las archivadas
  // recientes acotadas en otra; se mergean. El working set no se recorta:
  // nada activo puede quedar afuera.
  const [{ data: activeTasks }, { data: archivedTasks }, users, clients] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(TASK_SELECT)
        .neq("estado", "archivada")
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("estado", "archivada")
        .order("fecha_completada", { ascending: false, nullsFirst: false })
        .limit(ARCHIVED_LIMIT),
      getActiveUsers(),
      getActiveClients(),
    ]);

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
