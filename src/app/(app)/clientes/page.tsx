import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithRels } from "@/lib/types";
import { ClientsDashboard } from "@/components/clients-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();

  const [{ data: clients }, { data: tasks }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "*, creativa:users!clients_creativa_asignada_id_fkey(nombre)"
      )
      .order("nombre"),
    supabase
      .from("tasks")
      .select(
        "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
      )
      .order("fecha_limite", { ascending: true, nullsFirst: false }),
  ]);

  return (
    <ClientsDashboard
      clients={(clients ?? []) as never}
      tasks={(tasks ?? []) as TaskWithRels[]}
    />
  );
}
