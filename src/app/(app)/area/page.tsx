import { requireUser, isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AREAS } from "@/lib/constants";
import type { TaskWithRels } from "@/lib/types";
import { AreaDashboard } from "@/components/area-dashboard";

export const dynamic = "force-dynamic";

export default async function AreaPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [{ data: tasks }, { data: users }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
      )
      // Sin archivadas (completadas hace +30 días): no son trabajo activo.
      .neq("estado", "archivada")
      .order("fecha_limite", { ascending: true, nullsFirst: false }),
    supabase
      .from("users")
      .select("id,nombre")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const staff = isStaffUser(me);
  // Quien no es staff ve su área (y la secundaria si cumple 2 funciones).
  const areas = staff
    ? [...AREAS]
    : [me.area, ...(me.area_secundaria ? [me.area_secundaria] : [])];

  return (
    <AreaDashboard
      tasks={(tasks ?? []) as TaskWithRels[]}
      users={users ?? []}
      areas={areas}
      defaultArea={me.area}
    />
  );
}
