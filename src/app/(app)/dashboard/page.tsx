import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { listEventsForUser } from "@/lib/google-calendar";
import { PRIORITY_ORDER } from "@/lib/constants";
import type { PublicationWithRels, TaskWithRels } from "@/lib/types";
import { dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TaskList } from "@/components/task-list";
import { UpcomingMeetingsCard } from "@/components/upcoming-meetings-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createClient();

  const today = new Date();
  const inAWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  // Paralelizo: myClients, tasks, pubs y calendar (estos no dependen entre sí).
  const admin = createAdmin();
  const inTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const [
    { data: myClients },
    { data: taskData },
    { data: pubData },
    { data: calConns },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id")
      .or(`cm_id.eq.${user.id},disenador_id.eq.${user.id},audiovisual_id.eq.${user.id}`),
    supabase
      .from("tasks")
      .select(
        "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
      )
      .eq("asignado_a_id", user.id)
      .order("fecha_limite", { ascending: true, nullsFirst: false }),
    supabase
      .from("publications")
      .select(
        "id, titulo, fecha_publicacion, estado, red, tipo, cliente:clients(id,nombre)"
      )
      .or(`creado_por_id.eq.${user.id},audiovisual_id.eq.${user.id}`)
      .gte("fecha_publicacion", today.toISOString())
      .lte("fecha_publicacion", inAWeek.toISOString())
      .order("fecha_publicacion", { ascending: true })
      .limit(5),
    admin
      .from("google_calendar_connections")
      .select("id")
      .or(`owner_user_id.eq.${user.id},visibility.eq.shared`)
      .limit(1),
  ]);
  const hasCalendarConnections = (calConns ?? []).length > 0;
  const calendarEvents = hasCalendarConnections
    ? await listEventsForUser(user.id, today.toISOString(), inTwoWeeks.toISOString()).catch(() => [])
    : [];
  const myClientIds = (myClients ?? []).map((c) => c.id);

  const { data: clientPubsToday } = myClientIds.length > 0
    ? await supabase
        .from("publications")
        .select(
          "id, titulo, fecha_publicacion, estado, red, tipo, cliente:clients(id,nombre)"
        )
        .in("cliente_id", myClientIds)
        .gte("fecha_publicacion", startOfDay.toISOString())
        .lte("fecha_publicacion", endOfDay.toISOString())
        .order("fecha_publicacion", { ascending: true })
        .limit(10)
    : { data: [] };

  const tasks = (taskData ?? []) as TaskWithRels[];
  tasks.sort((a, b) => PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad]);
  const pubs = (pubData ?? []) as unknown as PublicationWithRels[];
  const pubsHoy = (clientPubsToday ?? []) as unknown as PublicationWithRels[];

  const activas = tasks.filter((t) => t.estado !== "completada");
  const pendientes = activas.filter((t) => t.estado === "pendiente").length;
  const enProgreso = activas.filter((t) => t.estado === "en_progreso").length;
  const vencidas = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "vencida"
  ).length;
  const completadas = tasks.filter((t) => t.estado === "completada").length;
  const proximas = activas.filter((t) => {
    if (!t.fecha_limite) return false;
    const s = dueState(t.fecha_limite, t.estado);
    return s === "hoy" || s === "pronto";
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Hola, {user.nombre.split(" ")[0]} <span className="ml-1">👋</span>
          </h1>
          <p className="text-muted-foreground">
            {activas.length === 0
              ? "Tu día está limpio."
              : `Tenés ${activas.length} tarea${activas.length === 1 ? "" : "s"} activa${activas.length === 1 ? "" : "s"}.`}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Pendientes"
          value={pendientes}
          icon={ListChecks}
          accent="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <Stat
          label="En progreso"
          value={enProgreso}
          icon={PlayCircle}
          accent="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        />
        <Stat
          label="Vencidas"
          value={vencidas}
          icon={AlertCircle}
          accent={
            vencidas > 0
              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          }
        />
        <Stat
          label="Completadas"
          value={completadas}
          icon={CheckCircle2}
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        />
      </div>

      {proximas.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <Clock className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
            <div className="flex-1">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                {proximas.length} próxima{proximas.length === 1 ? "" : "s"} a vencer
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/70">
                Revisalas antes de que se acumulen.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mis tareas</h2>
            <Link
              href="/tareas"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ver todas →
            </Link>
          </div>
          {activas.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Todo al día"
              text="No tenés tareas activas. Buen momento para revisar el calendario."
            />
          ) : (
            <TaskList tasks={activas} currentUserId={user.id} />
          )}
        </div>

        <div className="space-y-3">
          <UpcomingMeetingsCard
            events={calendarEvents}
            hasConnections={hasCalendarConnections}
          />

          {/* Pubs de hoy de los clientes que coordinás */}
          {pubsHoy.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Se publica hoy en tus cuentas ({pubsHoy.length})
                </h2>
              </div>
              <div className="space-y-1.5">
                {pubsHoy.map((p) => (
                  <PubItem key={p.id} pub={p} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Próximas publicaciones</h2>
            <Link
              href="/contenidos"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Calendario →
            </Link>
          </div>
          {pubs.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Sin publicaciones cercanas"
              text="No hay contenido tuyo agendado en los próximos 7 días."
            />
          ) : (
            <div className="space-y-2">
              {pubs.map((p) => (
                <PubItem key={p.id} pub={p} />
              ))}
            </div>
          )}

          <QuickActions />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof ListChecks;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            accent
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PubItem({ pub }: { pub: PublicationWithRels }) {
  const date = pub.fecha_publicacion
    ? new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "Sin fecha";
  return (
    <Link
      href={pub.cliente?.id ? `/clientes/${pub.cliente.id}/calendario` : "/contenidos"}
      className="block rounded-lg border bg-card p-3 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{pub.titulo}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {pub.cliente?.nombre} · {pub.red}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {date}
        </div>
      </div>
    </Link>
  );
}

function QuickActions() {
  const items = [
    { href: "/tareas", label: "Tareas", icon: ListChecks },
    { href: "/contenidos", label: "Contenidos", icon: CalendarDays },
    { href: "/clientes", label: "Clientes", icon: Sparkles },
    { href: "/equipo", label: "Equipo", icon: Sparkles },
  ];
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-2 p-3">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted"
          >
            <it.icon className="h-3.5 w-3.5 text-primary" />
            {it.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Sparkles;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
      <Icon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
