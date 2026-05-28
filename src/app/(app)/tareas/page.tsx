import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import type { TaskWithRels } from "@/lib/types";
import { TaskViews } from "@/components/task-views";

export const dynamic = "force-dynamic";

export default async function TareasPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [{ data: tasks }, users, clients] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id,titulo,estado,prioridad,area,fecha_limite,asignado_a_id,cliente_id,created_at,descripcion,creado_por_id,fecha_completada,links,updated_at,cliente:clients(id,nombre),asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
      )
      .order("created_at", { ascending: false }),
    getActiveUsers(),
    getActiveClients(),
  ]);

  return (
    <TaskViews
      tasks={(tasks ?? []) as unknown as TaskWithRels[]}
      users={users ?? []}
      clients={clients ?? []}
      currentUserId={me.id}
    />
  );
}
