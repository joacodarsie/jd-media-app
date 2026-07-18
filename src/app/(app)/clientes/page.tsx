import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser, isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers } from "@/lib/cache";
import type { TaskWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ClientsDashboard } from "@/components/clients-dashboard";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { missingTeam } from "@/lib/team-coverage";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const me = await requireUser();
  const isAdmin = isStaffUser(me);
  const supabase = createClient();

  const todayISO = new Date().toISOString();

  const [{ data: clients }, { data: tasks }, users, { data: pubs }, { data: myServices }, { data: allServices }] =
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
        // Excluimos las archivadas (completadas hace +30 días): no son trabajo
        // activo y, si entraban, inflaban el contador de "vencidas" por cuenta.
        .neq("estado", "archivada")
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
      // Servicios activos de todas las cuentas → para marcar equipo incompleto
      // (solo staff, que es quien asigna). Los no-staff no lo necesitan.
      isAdmin
        ? supabase
            .from("client_services")
            .select("cliente_id, tipo, activo, facturacion, costo_override")
            .eq("activo", true)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  // Equipos de trabajo (si la migración 0126 no está, queda vacío).
  const { data: teamsRaw } = await supabase
    .from("teams")
    .select("id, nombre")
    .order("orden");
  const teams = (teamsRaw ?? []) as { id: string; nombre: string }[];

  // Equipo faltante por cuenta (según servicios contratados): CM/diseño/edición
  // sin asignar inflan el margen. Solo se calcula para staff.
  const faltaEquipoByClient = new Map<string, string[]>();
  if (isAdmin) {
    const svcByClient = new Map<string, { tipo: string; activo: boolean; facturacion: string | null; costo_override: number | null }[]>();
    for (const s of (allServices ?? []) as { cliente_id: string; tipo: string; activo: boolean; facturacion: string | null; costo_override: number | null }[]) {
      if (!svcByClient.has(s.cliente_id)) svcByClient.set(s.cliente_id, []);
      svcByClient.get(s.cliente_id)!.push(s);
    }
    for (const c of (clients ?? []) as { id: string; cm_id: string | null; disenador_id: string | null; audiovisual_id: string | null; estado: string }[]) {
      if (c.estado !== "activo") continue;
      const falta = missingTeam(c, svcByClient.get(c.id) ?? []);
      if (falta.length) faltaEquipoByClient.set(c.id, falta);
    }
  }

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

  // Adjuntar el equipo faltante a cada cliente visible (para el borde de aviso).
  visibleClients = visibleClients.map((c) => {
    const id = (c as { id: string }).id;
    const falta = faltaEquipoByClient.get(id);
    return falta ? { ...(c as object), faltaEquipo: falta } : c;
  }) as typeof visibleClients;

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
          <div className="flex items-center gap-2">
            <Link
              href="/coordinacion/equipos"
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              👥 Equipos
            </Link>
            <ClientFormDialog
              mode="create"
              users={users}
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
                </Button>
              }
            />
          </div>
        )}
      </div>
      <ClientsDashboard
        clients={visibleClients as never}
        tasks={visibleTasks as TaskWithRels[]}
        upcomingPubs={visiblePubs as never}
        canSeeFinancials={isAdmin}
        teams={teams}
      />
    </div>
  );
}
