import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers } from "@/lib/cache";
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

  const [{ data: clients }, { data: tasks }, users, { data: pubs }, { data: myServices }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(
          "*, cm:users!clients_cm_id_fkey(id,nombre), disenador:users!clients_disenador_id_fkey(id,nombre), audiovisual:users!clients_audiovisual_id_fkey(id,nombre)"
        )
        .order("nombre"),
      supabase
        .from("tasks")
        .select(
          "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
        )
        .order("fecha_limite", { ascending: true, nullsFirst: false }),
      getActiveUsers(),
      supabase
        .from("publications")
        .select("id, cliente_id, titulo, fecha_publicacion, red, estado")
        .gte("fecha_publicacion", todayISO)
        .neq("estado", "publicado")
        .order("fecha_publicacion", { ascending: true })
        .limit(200),
      // Cuentas donde la persona figura como responsable de un servicio activo.
      isAdmin
        ? Promise.resolve({ data: [] as { cliente_id: string }[] })
        : supabase
            .from("client_services")
            .select("cliente_id")
            .eq("activo", true)
            .contains("responsables", [me.id]),
    ]);

  // Los no-staff solo ven sus cuentas ACTIVAS: asignadas por rol (cm / diseño /
  // audiovisual) o por ser responsables de un servicio activo.
  let visibleClients = clients ?? [];
  let visibleTasks = tasks ?? [];
  let visiblePubs = pubs ?? [];
  if (!isAdmin) {
    const fromServices = new Set((myServices ?? []).map((s) => s.cliente_id));
    visibleClients = visibleClients.filter((c) => {
      const row = c as Record<string, unknown>;
      if (row.estado !== "activo") return false;
      const mine =
        row.cm_id === me.id ||
        row.disenador_id === me.id ||
        row.audiovisual_id === me.id ||
        row.media_buyer_id === me.id ||
        fromServices.has(row.id as string);
      return mine;
    });
    const allowed = new Set(visibleClients.map((c) => (c as { id: string }).id));
    visibleTasks = visibleTasks.filter((t) => {
      const cid = (t as { cliente_id?: string }).cliente_id;
      return cid ? allowed.has(cid) : false;
    });
    visiblePubs = visiblePubs.filter((p) =>
      allowed.has((p as { cliente_id: string }).cliente_id)
    );
  }

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
            users={users}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
              </Button>
            }
          />
        )}
      </div>
      <ClientsDashboard
        clients={visibleClients as never}
        tasks={visibleTasks as TaskWithRels[]}
        upcomingPubs={visiblePubs as never}
        canSeeFinancials={isAdmin}
      />
    </div>
  );
}
