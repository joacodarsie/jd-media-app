import { Suspense } from "react";
import { todasLasFilas } from "@/lib/supabase/todas-las-filas";
import { cargarOpcionesEquipo } from "@/lib/equipos/opciones-run";
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
import { createAdmin } from "@/lib/supabase/admin";
import { lineaDeServicio, type LineaServicio } from "@/lib/clientes/linea-de-servicio";
import { computeAccountHealth } from "@/lib/director/health";
import { SemaforoCartera } from "@/components/semaforo-cartera";

export const dynamic = "force-dynamic";

/**
 * El semáforo de salud de la cartera, a la vista (19/10/2026): antes vivía solo
 * en /director y nadie lo miraba. Se carga aparte para no frenar la lista (24/10/2026).
 */
async function SaludCartera() {
  const salud = await computeAccountHealth(createAdmin()).catch(() => null);
  if (!salud || !salud.cuentas.length) return null;
  return (
    <SemaforoCartera
      resumen={salud.resumen}
      peores={salud.cuentas.slice(0, 3).map((c) => ({ id: c.id, nombre: c.nombre, motivo: c.alertas[0] ?? "", semaforo: c.semaforo }))}
    />
  );
}

export default async function ClientesPage() {
  const me = await requireUser();
  const isAdmin = isStaffUser(me);
  const supabase = createClient();

  const todayISO = new Date().toISOString();

  // Todo en una sola tanda (24/10/2026): antes eran cuatro esperas en fila.
  const [{ data: clients }, { data: tasks }, users, { data: pubs }, { data: myServices }, { data: allServices }, { data: svcRaw }, { data: teamsRaw }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(
          // Solo lo que usa la lista (24/10/2026): con «*» viajaban al navegador las
          // credenciales (cifradas) y datos de contrato que esta pantalla no muestra.
          "id, nombre, pack, estado, es_interno, para_recuperar, calendario_url, drive_url, team_id, ig_user_id, created_at, fecha_inicio, fecha_activado, fecha_inactivado, cm_id, disenador_id, audiovisual_id, media_buyer_id, cm:users!clients_cm_id_fkey(id,nombre), disenador:users!clients_disenador_id_fkey(id,nombre), audiovisual:users!clients_audiovisual_id_fkey(id,nombre)"
        )
        .order("nombre"),
      // De a 1.000: la base corta en 1.000 filas sin avisar.
      todasLasFilas((desde, hasta) =>
        supabase
          .from("tasks")
          // Solo lo que muestra la lista (24/10/2026): con «*» y el asignado, la
          // página pesaba 193 KB y es la más visitada de la plataforma.
          .select("id, numero, titulo, estado, prioridad, fecha_limite, bloqueo, bloqueo_quien, area, cliente_id, cliente:clients(id,nombre)")
          // Excluimos las archivadas (completadas hace +30 días): no son trabajo
          // activo y, si entraban, inflaban el contador de "vencidas" por cuenta.
          .neq("estado", "archivada")
          .order("fecha_limite", { ascending: true, nullsFirst: false })
          .order("id")
          .range(desde, hasta)
      ),
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
      // Línea de negocio de cada cuenta (redes, publicidad, branding…), para
      // separar la lista. El tipo de servicio no es sensible: se lee con el admin
      // para todos; los montos, solo los ve dirección (admin).
      createAdmin().from("client_services").select("cliente_id, tipo, monto_mensual, facturacion").eq("activo", true),
      // Equipos de trabajo (si la migración 0126 no está, queda vacío).
      supabase.from("teams").select("id, nombre").order("orden"),
    ]);
  const tiposPorCliente = new Map<string, string[]>();
  const montoPorCliente: Record<string, { mensual: number; unico: number }> = {};
  for (const sv of (svcRaw ?? []) as {
    cliente_id: string;
    tipo: string;
    monto_mensual: number | null;
    facturacion: string | null;
  }[]) {
    tiposPorCliente.set(sv.cliente_id, [...(tiposPorCliente.get(sv.cliente_id) ?? []), sv.tipo]);
    const m = (montoPorCliente[sv.cliente_id] ??= { mensual: 0, unico: 0 });
    if (sv.facturacion === "unico") m.unico += Number(sv.monto_mensual) || 0;
    else m.mensual += Number(sv.monto_mensual) || 0;
  }
  const lineas: Record<string, LineaServicio> = {};
  for (const c of (clients ?? []) as { id: string }[]) {
    lineas[c.id] = lineaDeServicio(tiposPorCliente.get(c.id) ?? []);
  }

  const teams = (teamsRaw ?? []) as { id: string; nombre: string }[];
  const opcionesEquipo = isAdmin ? await cargarOpcionesEquipo(createAdmin()).catch(() => []) : [];

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

  // Cuentas activas sin Instagram conectado: sin esto el portal y el reporte
  // les muestran los resultados vacíos, que es el argumento que retiene.
  const sinInstagram = isAdmin
    ? ((clients ?? []) as { estado: string; es_interno: boolean; ig_user_id: string | null }[]).filter(
        (c) => c.estado === "activo" && !c.es_interno && !c.ig_user_id
      ).length
    : 0;

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
              href="/clientes/calidad"
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
              title="Encuesta y reunión del mes de cada cuenta"
            >
              💛 Calidad del mes
            </Link>
            <Link
              href="/mi-equipo"
              className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              👥 Equipos
            </Link>
            <ClientFormDialog
              mode="create"
              users={users}
              equipos={opcionesEquipo}
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
                </Button>
              }
            />
          </div>
        )}
      </div>
      {isAdmin && sinInstagram > 0 && (
        <Link
          href="/clientes/conectar-instagram"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
        >
          <span className="text-amber-900 dark:text-amber-100">
            <b>{sinInstagram}</b> cuenta{sinInstagram === 1 ? "" : "s"} activa
            {sinInstagram === 1 ? "" : "s"} sin Instagram conectado: el portal y el
            reporte les muestran los resultados vacíos.
          </span>
          <span className="shrink-0 font-medium text-amber-900 underline dark:text-amber-100">
            Conectar
          </span>
        </Link>
      )}
      {/* Le guarda el lugar (192 px) a la salud de la cartera para que la lista no salte. */}
      {isAdmin && (
        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl border bg-muted/30" />}>
          <SaludCartera />
        </Suspense>
      )}
      <ClientsDashboard
        clients={visibleClients as never}
        tasks={visibleTasks as unknown as TaskWithRels[]}
        upcomingPubs={visiblePubs as never}
        canSeeFinancials={isAdmin}
        teams={teams}
        lineas={lineas}
        // Lo que factura cada línea es número de dirección: coordinación no lo ve.
        montos={me.rol === "admin" ? montoPorCliente : undefined}
      />
    </div>
  );
}
