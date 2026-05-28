import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TaskWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ClientsDashboard } from "@/components/clients-dashboard";
import { ClientFormDialog } from "@/components/client-form-dialog";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const me = await requireUser();
  const isAdmin = me.rol === "admin" || me.rol === "coordinador";
  const supabase = createClient();

  const todayISO = new Date().toISOString();

  const [{ data: clients }, { data: tasks }, { data: users }, { data: pubs }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(
          "*, creativa:users!clients_creativa_asignada_id_fkey(id,nombre), cm:users!clients_cm_id_fkey(id,nombre), disenador:users!clients_disenador_id_fkey(id,nombre), audiovisual:users!clients_audiovisual_id_fkey(id,nombre)"
        )
        .order("nombre"),
      supabase
        .from("tasks")
        .select(
          "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
        )
        .order("fecha_limite", { ascending: true, nullsFirst: false }),
      supabase
        .from("users")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("publications")
        .select("id, cliente_id, titulo, fecha_publicacion, red, estado")
        .gte("fecha_publicacion", todayISO)
        .neq("estado", "publicado")
        .order("fecha_publicacion", { ascending: true })
        .limit(200),
    ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Qué se está haciendo en cada cuenta.
          </p>
        </div>
        {isAdmin && (
          <ClientFormDialog
            mode="create"
            users={users ?? []}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
              </Button>
            }
          />
        )}
      </div>
      <ClientsDashboard
        clients={(clients ?? []) as never}
        tasks={(tasks ?? []) as TaskWithRels[]}
        upcomingPubs={(pubs ?? []) as never}
        canSeeFinancials={isAdmin}
      />
    </div>
  );
}
