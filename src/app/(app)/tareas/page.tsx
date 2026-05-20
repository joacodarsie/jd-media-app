import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithRels } from "@/lib/types";
import { TaskViews } from "@/components/task-views";

export const dynamic = "force-dynamic";

export default async function TareasPage() {
  await requireUser();
  const supabase = createClient();

  const [{ data: tasks }, { data: users }, { data: clients }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id,nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase.from("clients").select("id,nombre").order("nombre"),
    ]);

  return (
    <TaskViews
      tasks={(tasks ?? []) as TaskWithRels[]}
      users={users ?? []}
      clients={clients ?? []}
    />
  );
}
