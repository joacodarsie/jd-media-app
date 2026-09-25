import Link from "next/link";
import { requireUser, getAccessibleClientIds, isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveUsers, getActiveClients } from "@/lib/cache";
import type { TaskWithRels } from "@/lib/types";
import { TaskViews } from "@/components/task-views";
import { TaskRequestsPanel } from "@/components/task-requests-panel";
import { BandejaCoordinacion } from "@/components/bandeja-coordinacion";
import { pedidosPendientes } from "./pedidos-actions";
import { madresQueFaltan, type RefMadre } from "@/lib/tareas/agrupar";
import { hoyYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

const TASK_SELECT =
  "id,titulo,numero,parent_id,estado,prioridad,area,fecha_limite,asignado_a_id,cliente_id,created_at,descripcion,creado_por_id,fecha_completada,links,updated_at,cliente:clients(id,nombre),asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)";

// Cuántas tareas archivadas (completadas hace +30 días) traer. Crecen sin
// techo con el tiempo y están ocultas por defecto, así que sólo cargamos las
// más recientes para que el filtro "Archivada" siga funcionando sin arrastrar
// años de historia en cada carga.
const ARCHIVED_LIMIT = 100;

export default async function TareasPage({
  searchParams,
}: {
  searchParams?: { ver?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  /**
   * Visibilidad. Staff (admin/coordinador) ve TODAS las tareas.
   *
   * El resto ve SOLO LO SUYO por defecto. Antes veía además todo lo de las
   * cuentas que lleva, y eso rompía la lista de quien está en muchas cuentas:
   * Carlos es el editor de casi todas, así que le caían también las tareas de
   * diseño y de community de cada una. Con 260 tareas abiertas, una lista que
   * no es tuya se deja de mirar.
   *
   * El que igual quiera ver cómo viene su cuenta lo tiene a un clic, pero es
   * una decisión suya y no el estado por defecto.
   */
  const verCuentas = searchParams?.ver === "cuentas";
  const myClientIds = await getAccessibleClientIds(me);
  const esStaff = myClientIds === null;
  const visibilityOr = esStaff
    ? null
    : verCuentas
      ? [
          `asignado_a_id.eq.${me.id}`,
          `creado_por_id.eq.${me.id}`,
          ...(myClientIds.length ? [`cliente_id.in.(${myClientIds.join(",")})`] : []),
        ].join(",")
      : // "Mis tareas" es LO ASIGNADO A MÍ y nada más.
        //
        // Antes también entraba lo creado por uno, y eso traía un problema no
        // obvio: cuando alguien carga una pieza en el calendario, el sistema
        // genera solo la tarea de diseño y la de historia, y queda esa persona
        // como creadora. Carlos cargaba las piezas y le volvían encima las
        // tareas de Milena y de Darío de cada una.
        `asignado_a_id.eq.${me.id}`;

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

  // Las subtareas cuya madre NO entró en la lista (pasa siempre en "Mis
  // tareas": te tocan tres piezas de un ticket que lleva otro). Se traen solo
  // para poder nombrar el ticket al lado de la fila, así la subtarea no queda
  // huérfana en el medio de la lista sin decir de dónde sale.
  const faltan = madresQueFaltan(tasks);
  let madres: Record<string, RefMadre> = {};
  if (faltan.length > 0) {
    const { data: madresRaw } = await supabase
      .from("tasks")
      .select("id, numero, titulo")
      .in("id", faltan);
    madres = Object.fromEntries(
      ((madresRaw ?? []) as RefMadre[]).map((m) => [m.id, m])
    );
  }

  // Los problemas que reportó el equipo. Van arriba de todo y solo los ve
  // quien puede resolverlos: la action devuelve vacío para el resto.
  const pedidos = await pedidosPendientes();

  // Coordinación: el atajo a "Ponerse al día" con las vencidas de todo el equipo.
  const hoy = hoyYmd();
  const vencidasEquipo = isStaffUser(me)
    ? tasks.filter(
        (t) =>
          ["pendiente", "en_progreso", "en_revision", "bloqueada"].includes(t.estado) &&
          !!t.fecha_limite &&
          t.fecha_limite < hoy
      ).length
    : 0;

  return (
    <div className="space-y-4">
      <TaskRequestsPanel
        pedidos={pedidos}
        usuarios={(users ?? []).map((u) => ({ id: u.id, nombre: u.nombre }))}
      />

      <BandejaCoordinacion me={{ id: me.id, rol: me.rol }} />

      {vencidasEquipo > 0 && (
        <Link
          href="/tareas/vencidas"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm hover:bg-red-100 dark:border-red-500/30 dark:bg-red-950/40 dark:hover:bg-red-950"
        >
          <span className="text-red-900 dark:text-red-200">
            <b>{vencidasEquipo} tareas vencidas en el equipo.</b> Despejalas por persona: hecha, fecha
            nueva o a otra persona.
          </span>
          <span className="shrink-0 font-medium text-red-700 dark:text-red-300">Ponerse al día →</span>
        </Link>
      )}

      {/* Solo para quien lleva cuentas: mirar el resto es opcional. */}
      {!esStaff && myClientIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/tareas"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !verCuentas
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-accent"
            }`}
          >
            Mis tareas
          </Link>
          <Link
            href="/tareas?ver=cuentas"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              verCuentas
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-accent"
            }`}
          >
            Todo lo de mis cuentas
          </Link>
        </div>
      )}
      <TaskViews
        tasks={tasks}
        users={users ?? []}
        clients={clients ?? []}
        currentUserId={me.id}
        esCoordinacion={isStaffUser(me)}
        madres={madres}
      />
    </div>
  );
}
