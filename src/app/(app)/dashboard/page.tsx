import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  AtSign,
  Bell,
  CalendarClock,
  Clock,
  MapPin,
  MessageCircle,
  Sparkles,
  Sun,
  UserPlus,
  Video,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { ensureDueNotifications } from "@/lib/notifications";
import { listEventsForUser } from "@/lib/google-calendar";
import { PRIORITY_ORDER } from "@/lib/constants";
import type { PublicationWithRels, TaskWithRels } from "@/lib/types";
import { dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TaskList } from "@/components/task-list";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  isAllDay: boolean;
  hangoutLink?: string;
  htmlLink?: string;
  location?: string;
  source_label: string;
  source_email: string;
  source_id: string;
}

function isToday(d: Date) {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function minutesUntil(start: string): number {
  return Math.round((new Date(start).getTime() - Date.now()) / 60000);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function relativeWhen(start: string): string {
  const m = minutesUntil(start);
  if (m < 0) return "en curso";
  if (m < 60) return `en ${m} min`;
  if (m < 60 * 24) return `en ${Math.round(m / 60)} h`;
  return `${formatTime(new Date(start))}`;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createClient();

  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );
  const inAWeek = new Date(startOfDay.getTime() + 7 * 86400000);

  const admin = createAdmin();

  // --- Batch 1: todo lo que NO depende de otros resultados, en paralelo. ---
  // Reuniones internas se incluye acá (sólo depende de la ventana de fechas,
  // no de myClientIds) para no encadenar un round-trip extra.
  const [
    ,
    { data: myClients },
    { data: taskData },
    { data: calConns },
    { data: delegatedRaw },
    { data: recentNotifsRaw },
    { data: myMeetingsRaw },
  ] = await Promise.all([
    // Genera notifs "vencida"/"proxima a vencer" en paralelo. Antes corria en
    // el layout en CADA nav (~10ms x nav). Ahora solo al entrar al dashboard.
    ensureDueNotifications(supabase, user.id).catch(() => undefined),
    supabase
      .from("clients")
      .select("id, nombre, pack, estado")
      .or(`cm_id.eq.${user.id},disenador_id.eq.${user.id},audiovisual_id.eq.${user.id}`),
    supabase
      .from("tasks")
      .select(
        "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)"
      )
      .eq("asignado_a_id", user.id)
      .order("fecha_limite", { ascending: true, nullsFirst: false }),
    admin
      .from("google_calendar_connections")
      .select("id")
      .or(`owner_user_id.eq.${user.id},visibility.eq.shared`)
      .limit(1),
    // Tareas que YO delegué (creé y asigné a otro) y siguen pendientes/en progreso
    supabase
      .from("tasks")
      .select("id, titulo, estado, fecha_limite, asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)")
      .eq("creado_por_id", user.id)
      .neq("asignado_a_id", user.id)
      .neq("estado", "completada")
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .limit(5),
    // Notificaciones recientes sin leer
    supabase
      .from("notifications")
      .select("id, tipo, mensaje, task_id, created_at")
      .eq("user_id", user.id)
      .eq("leida", false)
      .order("created_at", { ascending: false })
      .limit(5),
    // Reuniones internas (donde el user es asistente o creador) en la ventana
    // semanal. Como creator se agrega automaticamente como asistente, el inner
    // join cubre ambos casos.
    supabase
      .from("internal_meetings")
      .select(
        "id, titulo, starts_at, ends_at, ubicacion, meet_link, attendee:internal_meeting_attendees!inner(user_id)"
      )
      .eq("attendee.user_id", user.id)
      .gte("starts_at", startOfDay.toISOString())
      .lte("starts_at", inAWeek.toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const hasCalendarConnections = (calConns ?? []).length > 0;
  const myClientIds = (myClients ?? []).map((c) => c.id);
  const hasClients = myClientIds.length > 0;

  // --- Batch 2: lo que depende del Batch 1 (eventos según conexiones, pubs y
  // tareas según mis clientes), todo en paralelo en vez de encadenado. ---
  const emptyRows = Promise.resolve({ data: [] as never[] });
  const [
    googleCalendarEvents,
    { data: clientPubsToday },
    { data: clientTasksRaw },
    { data: clientPubsWeekRaw },
  ] = await Promise.all([
    hasCalendarConnections
      ? listEventsForUser(
          user.id,
          startOfDay.toISOString(),
          inAWeek.toISOString()
        ).catch(() => [] as CalEvent[])
      : Promise.resolve([] as CalEvent[]),
    hasClients
      ? supabase
          .from("publications")
          .select(
            "id, titulo, fecha_publicacion, estado, red, tipo, cliente:clients(id,nombre)"
          )
          .in("cliente_id", myClientIds)
          .gte("fecha_publicacion", startOfDay.toISOString())
          .lte("fecha_publicacion", endOfDay.toISOString())
          .order("fecha_publicacion", { ascending: true })
          .limit(10)
      : emptyRows,
    hasClients
      ? supabase
          .from("tasks")
          .select(
            "id, titulo, estado, prioridad, fecha_limite, cliente_id, asignado:users!tasks_asignado_a_id_fkey(id,nombre)"
          )
          .in("cliente_id", myClientIds)
          .neq("estado", "completada")
      : emptyRows,
    hasClients
      ? supabase
          .from("publications")
          .select("id, titulo, fecha_publicacion, estado, red, tipo, cliente_id")
          .in("cliente_id", myClientIds)
          .gte("fecha_publicacion", startOfDay.toISOString())
          .lte("fecha_publicacion", inAWeek.toISOString())
          .order("fecha_publicacion", { ascending: true })
      : emptyRows,
  ]);

  type InternalMeetingLite = {
    id: string;
    titulo: string;
    starts_at: string;
    ends_at: string;
    ubicacion: string | null;
    meet_link: string | null;
  };
  const internalAsCal: CalEvent[] = (
    (myMeetingsRaw ?? []) as unknown as InternalMeetingLite[]
  ).map((m) => ({
    id: `internal-${m.id}`,
    summary: m.titulo,
    start: m.starts_at,
    end: m.ends_at,
    isAllDay: false,
    hangoutLink: m.meet_link ?? undefined,
    location: m.ubicacion ?? undefined,
    source_label: "Equipo JD Media",
    source_email: "",
    source_id: "__internal_jd__",
  }));

  const calendarEvents: CalEvent[] = [
    ...googleCalendarEvents,
    ...internalAsCal,
  ].sort((a, b) => a.start.localeCompare(b.start));
  const hasAnyMeetings = calendarEvents.length > 0 || hasCalendarConnections;

  const tasks = (taskData ?? []) as TaskWithRels[];
  tasks.sort((a, b) => PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad]);
  const pubsHoy = (clientPubsToday ?? []) as unknown as PublicationWithRels[];

  const activas = tasks.filter((t) => t.estado !== "completada");
  const vencidas = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "vencida"
  );
  const venceHoy = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "hoy"
  );
  const venceEstaSemana = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "pronto"
  );
  const restoActivas = activas.filter((t) => {
    const s = dueState(t.fecha_limite, t.estado);
    return s !== "vencida" && s !== "hoy" && s !== "pronto";
  });
  const completadas = tasks.filter((t) => t.estado === "completada").length;

  // Eventos hoy y resto de la semana
  const eventsHoy = calendarEvents.filter((e) => isToday(new Date(e.start)));
  const eventsSemana = calendarEvents.filter((e) => !isToday(new Date(e.start)));

  // Próximo evento: el primero que aún no terminó
  const nextEvent =
    [...eventsHoy, ...eventsSemana]
      .filter((e) => new Date(e.end).getTime() > Date.now())
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;

  // Total "para hoy" — cosas reales que pedir atención
  const todayCount =
    eventsHoy.length + venceHoy.length + vencidas.length + pubsHoy.length;

  // Tareas delegadas que están vencidas
  type Delegated = {
    id: string;
    titulo: string;
    estado: string;
    fecha_limite: string | null;
    asignado: { id: string; nombre: string; avatar_url: string | null } | null;
  };
  const delegated = (delegatedRaw ?? []) as unknown as Delegated[];
  const delegatedVencidas = delegated.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "vencida"
  );

  type NotifLite = {
    id: string;
    tipo: string;
    mensaje: string;
    task_id: string | null;
    created_at: string;
  };
  const recentNotifs = (recentNotifsRaw ?? []) as unknown as NotifLite[];

  // Agrupar por cliente: 1 fila por cliente con la proxima accion mas urgente
  type ClientLite = { id: string; nombre: string; pack: string | null; estado: string };
  type ClientTaskLite = {
    id: string;
    titulo: string;
    estado: string;
    prioridad: string;
    fecha_limite: string | null;
    cliente_id: string;
    asignado: { id: string; nombre: string } | null;
  };
  type ClientPubLite = {
    id: string;
    titulo: string;
    fecha_publicacion: string | null;
    estado: string;
    red: string;
    tipo: string;
    cliente_id: string;
  };
  const todayYmd = now.toISOString().slice(0, 10);
  const myClientsList = (myClients ?? []) as ClientLite[];
  const allClientTasks = (clientTasksRaw ?? []) as unknown as ClientTaskLite[];
  const allClientPubsWeek = (clientPubsWeekRaw ?? []) as unknown as ClientPubLite[];

  type PerClientRow = {
    client: ClientLite;
    nextAction: {
      kind: "tarea" | "publicacion";
      label: string;
      sublabel: string;
      urgency: "vencida" | "hoy" | "pronto" | "futuro";
      href: string;
    } | null;
    counts: { tareasActivas: number; tareasVencidas: number; pubsSemana: number };
  };
  const perClient: PerClientRow[] = myClientsList.map((c) => {
    const ts = allClientTasks.filter((t) => t.cliente_id === c.id);
    const ps = allClientPubsWeek.filter((p) => p.cliente_id === c.id);
    const tareasVencidas = ts.filter(
      (t) => t.fecha_limite && t.fecha_limite < todayYmd
    );
    // Candidatos para "proxima accion" ordenados por urgencia
    const tareaUrgente =
      tareasVencidas[0] ??
      ts.find((t) => t.fecha_limite === todayYmd) ??
      ts.find((t) => t.fecha_limite && t.fecha_limite > todayYmd) ??
      null;
    const pubHoy = ps.find(
      (p) =>
        p.fecha_publicacion &&
        p.fecha_publicacion >= startOfDay.toISOString() &&
        p.fecha_publicacion <= endOfDay.toISOString()
    );

    let nextAction: PerClientRow["nextAction"] = null;
    // Prioridad: pub que se publica hoy > tarea vencida > tarea hoy > pub semana > tarea futura
    if (pubHoy) {
      nextAction = {
        kind: "publicacion",
        label: pubHoy.titulo || "Publicación sin título",
        sublabel: "Se publica hoy",
        urgency: "hoy",
        href: `/contenidos`,
      };
    } else if (tareasVencidas.length > 0) {
      nextAction = {
        kind: "tarea",
        label: tareaUrgente!.titulo,
        sublabel: `Vencida · ${tareaUrgente!.asignado?.nombre ?? "sin asignar"}`,
        urgency: "vencida",
        href: `/tareas/${tareaUrgente!.id}`,
      };
    } else if (tareaUrgente?.fecha_limite === todayYmd) {
      nextAction = {
        kind: "tarea",
        label: tareaUrgente.titulo,
        sublabel: `Hoy · ${tareaUrgente.asignado?.nombre ?? "sin asignar"}`,
        urgency: "hoy",
        href: `/tareas/${tareaUrgente.id}`,
      };
    } else if (ps.length > 0) {
      const p = ps[0];
      const fp = p.fecha_publicacion ? new Date(p.fecha_publicacion) : null;
      nextAction = {
        kind: "publicacion",
        label: p.titulo || "Publicación sin título",
        sublabel: fp
          ? fp.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })
          : "Sin fecha",
        urgency: "pronto",
        href: `/contenidos`,
      };
    } else if (tareaUrgente) {
      nextAction = {
        kind: "tarea",
        label: tareaUrgente.titulo,
        sublabel: tareaUrgente.fecha_limite
          ? `Vence ${new Date(tareaUrgente.fecha_limite).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`
          : "Sin fecha",
        urgency: "futuro",
        href: `/tareas/${tareaUrgente.id}`,
      };
    }

    return {
      client: c,
      nextAction,
      counts: {
        tareasActivas: ts.length,
        tareasVencidas: tareasVencidas.length,
        pubsSemana: ps.length,
      },
    };
  });

  // Ordenar: primero los que tienen alerta vencida, despues hoy, despues pronto, futuro, sin nada
  const urgencyRank: Record<string, number> = {
    vencida: 0,
    hoy: 1,
    pronto: 2,
    futuro: 3,
  };
  perClient.sort((a, b) => {
    const ua = a.nextAction ? urgencyRank[a.nextAction.urgency] ?? 4 : 5;
    const ub = b.nextAction ? urgencyRank[b.nextAction.urgency] ?? 4 : 5;
    if (ua !== ub) return ua - ub;
    return a.client.nombre.localeCompare(b.client.nombre);
  });

  const fechaHoy = now.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fechaHoyCap = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Sun className="h-3.5 w-3.5" /> {fechaHoyCap}
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
              Hola, {user.nombre.split(" ")[0]}{" "}
              <span className="ml-1">👋</span>
              <HelpTrigger slug="mi-dia" label="¿Qué es Mi día?" size="md" />
            </h1>
            <p className="text-muted-foreground">
              {todayCount === 0
                ? "Tu día está limpio. Aprovechá para revisar la agenda o leer documentación."
                : `Tenés ${todayCount} cosa${todayCount === 1 ? "" : "s"} para hoy.`}
            </p>
          </div>

          {/* Stat compactas en la esquina (grid en mobile, fila en desktop) */}
          <div className="grid w-full grid-cols-4 gap-3 text-sm sm:flex sm:w-auto">
            <MiniStat label="Vencidas" value={vencidas.length} tone={vencidas.length > 0 ? "red" : "muted"} />
            <MiniStat label="Hoy" value={venceHoy.length + eventsHoy.length} tone="primary" />
            <MiniStat label="Esta semana" value={venceEstaSemana.length} tone="muted" />
            <MiniStat label="Hechas" value={completadas} tone="emerald" />
          </div>
        </div>
      </div>

      {/* Próxima reunión / evento destacado */}
      {nextEvent && (
        <NextEventCard event={nextEvent} />
      )}

      {/* Alertas críticas */}
      {(vencidas.length > 0 || delegatedVencidas.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {vencidas.length > 0 && (
            <AlertCard
              tone="red"
              icon={AlertCircle}
              title={`${vencidas.length} tarea${vencidas.length === 1 ? "" : "s"} vencida${vencidas.length === 1 ? "" : "s"}`}
              text="Recuperalas o reprogramá la fecha."
              href="/tareas"
              cta="Ver tareas"
            />
          )}
          {delegatedVencidas.length > 0 && (
            <AlertCard
              tone="amber"
              icon={Clock}
              title={`${delegatedVencidas.length} delegada${delegatedVencidas.length === 1 ? "" : "s"} vencida${delegatedVencidas.length === 1 ? "" : "s"}`}
              text={`Esperás respuesta de ${[
                ...new Set(delegatedVencidas.map((t) => t.asignado?.nombre).filter(Boolean)),
              ].slice(0, 3).join(", ")}.`}
              href="/tareas"
              cta="Hacer seguimiento"
            />
          )}
        </div>
      )}

      {/* HOY */}
      <Section title="Hoy" emoji="🌅">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <SubBlock title="Mis tareas de hoy">
              {venceHoy.length === 0 && vencidas.length === 0 ? (
                <EmptyMini
                  icon={Sparkles}
                  text="Sin tareas urgentes para hoy."
                />
              ) : (
                <TaskList tasks={[...vencidas, ...venceHoy]} currentUserId={user.id} />
              )}
            </SubBlock>
          </div>
          <div className="space-y-3">
            <SubBlock
              title="Reuniones"
              right={
                <Link href="/agenda" className="text-xs text-muted-foreground hover:text-foreground">
                  Agenda →
                </Link>
              }
            >
              {eventsHoy.length === 0 ? (
                !hasCalendarConnections ? (
                  <EmptyMini
                    icon={CalendarClock}
                    text="Conectá tu Calendar desde Mi perfil o agendá una reunión interna desde Agenda."
                  />
                ) : (
                  <EmptyMini icon={CalendarClock} text="Sin reuniones hoy." />
                )
              ) : (
                <div className="space-y-2">
                  {eventsHoy.map((e) => (
                    <EventItem key={`${e.source_id}-${e.id}`} event={e} />
                  ))}
                </div>
              )}
            </SubBlock>

            {pubsHoy.length > 0 && (
              <SubBlock
                title={`Se publica hoy (${pubsHoy.length})`}
                right={
                  <Link href="/contenidos" className="text-xs text-muted-foreground hover:text-foreground">
                    Calendario →
                  </Link>
                }
              >
                <div className="space-y-1.5">
                  {pubsHoy.map((p) => (
                    <PubItem key={p.id} pub={p} />
                  ))}
                </div>
              </SubBlock>
            )}
          </div>
        </div>
      </Section>

      {/* Por cliente — vista agrupada con próxima acción urgente */}
      {perClient.length > 0 && (
        <Section title="Por cliente" emoji="👥">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {perClient.slice(0, 9).map((row) => (
              <ClientRowCard key={row.client.id} row={row} />
            ))}
          </div>
          {perClient.length > 9 && (
            <Link
              href="/clientes"
              className="mt-2 inline-flex text-xs text-muted-foreground hover:text-foreground"
            >
              Ver los {perClient.length - 9} restantes →
            </Link>
          )}
        </Section>
      )}

      {/* Esta semana */}
      <Section title="Esta semana" emoji="📅">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <SubBlock
              title="Próximas tareas"
              right={
                <Link href="/tareas" className="text-xs text-muted-foreground hover:text-foreground">
                  Ver todas →
                </Link>
              }
            >
              {venceEstaSemana.length === 0 && restoActivas.length === 0 ? (
                <EmptyMini icon={Sparkles} text="No tenés tareas próximas." />
              ) : (
                <TaskList
                  tasks={[...venceEstaSemana, ...restoActivas].slice(0, 8)}
                  currentUserId={user.id}
                />
              )}
            </SubBlock>
          </div>
          <div className="space-y-3">
            <SubBlock
              title="Próximas reuniones"
              right={
                <Link href="/agenda" className="text-xs text-muted-foreground hover:text-foreground">
                  Agenda →
                </Link>
              }
            >
              {!hasAnyMeetings ? null : eventsSemana.length === 0 ? (
                <EmptyMini icon={CalendarClock} text="Sin más reuniones esta semana." />
              ) : (
                <div className="space-y-2">
                  {eventsSemana.slice(0, 5).map((e) => (
                    <EventItem key={`${e.source_id}-${e.id}`} event={e} compact />
                  ))}
                </div>
              )}
            </SubBlock>

            {recentNotifs.length > 0 && (
              <SubBlock
                title={`Novedades (${recentNotifs.length})`}
                right={
                  <Link href="/notificaciones" className="text-xs text-muted-foreground hover:text-foreground">
                    Ver todas →
                  </Link>
                }
              >
                <div className="space-y-1.5">
                  {recentNotifs.map((n) => (
                    <NotifItem key={n.id} notif={n} />
                  ))}
                </div>
              </SubBlock>
            )}

            {delegated.length > 0 && delegatedVencidas.length === 0 && (
              <SubBlock
                title={`Delegadas (${delegated.length})`}
                right={
                  <Link href="/tareas" className="text-xs text-muted-foreground hover:text-foreground">
                    Ver →
                  </Link>
                }
              >
                <div className="space-y-1.5">
                  {delegated.slice(0, 5).map((t) => (
                    <Link
                      key={t.id}
                      href={`/tareas/${t.id}`}
                      className="block rounded-md border bg-card p-2 text-xs transition hover:border-primary/30"
                    >
                      <div className="truncate font-medium">{t.titulo}</div>
                      <div className="mt-0.5 text-muted-foreground">
                        {t.asignado?.nombre ?? "Sin asignar"}
                      </div>
                    </Link>
                  ))}
                </div>
              </SubBlock>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ---------- subcomponentes ---------- */

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "primary" | "emerald" | "muted";
}) {
  const toneCls: Record<typeof tone, string> = {
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    primary: "text-primary",
    emerald: "text-emerald-600 dark:text-emerald-400",
    muted: "text-muted-foreground",
  };
  return (
    <div className="flex flex-col items-center rounded-md border bg-card p-2 sm:items-end sm:border-0 sm:bg-transparent sm:p-0">
      <div className={cn("text-xl font-bold leading-none tabular-nums", toneCls[tone])}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        <span className="mr-1.5">{emoji}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubBlock({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function EmptyMini({
  icon: Icon,
  text,
}: {
  icon: typeof Sparkles;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
      <Icon className="h-4 w-4" />
      {text}
    </div>
  );
}

function AlertCard({
  tone,
  icon: Icon,
  title,
  text,
  href,
  cta,
}: {
  tone: "red" | "amber";
  icon: typeof AlertCircle;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  const cls =
    tone === "red"
      ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30 [&_.title]:text-red-900 dark:[&_.title]:text-red-200 [&_.icon]:text-red-700 dark:[&_.icon]:text-red-300 [&_.txt]:text-red-800/80 dark:[&_.txt]:text-red-300/70"
      : "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30 [&_.title]:text-amber-900 dark:[&_.title]:text-amber-200 [&_.icon]:text-amber-700 dark:[&_.icon]:text-amber-300 [&_.txt]:text-amber-800/80 dark:[&_.txt]:text-amber-300/70";
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-3 transition hover:shadow-sm",
        cls
      )}
    >
      <Icon className="icon mt-0.5 h-5 w-5" />
      <div className="flex-1">
        <div className="title text-sm font-semibold">{title}</div>
        <p className="txt text-xs">{text}</p>
      </div>
      <div className="title flex items-center gap-1 text-xs">
        {cta} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function NextEventCard({ event: e }: { event: CalEvent }) {
  const min = minutesUntil(e.start);
  const inProgress = min < 0 && new Date(e.end).getTime() > Date.now();
  const tone = inProgress
    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
    : min < 30
    ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
    : "border-primary/30 bg-primary/5";
  const label = inProgress ? "En curso" : "Próxima reunión";
  return (
    <div className={cn("rounded-lg border p-4", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label} · {relativeWhen(e.start)}
          </div>
          <div className="mt-1 truncate text-lg font-semibold">{e.summary}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(new Date(e.start))} – {formatTime(new Date(e.end))}
            </span>
            <span>{e.source_label}</span>
            {e.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {e.location}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {e.hangoutLink && (
            <a
              href={e.hangoutLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Video className="h-3.5 w-3.5" /> Unirme
            </a>
          )}
          {e.htmlLink && (
            <a
              href={e.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Detalles
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EventItem({ event: e, compact = false }: { event: CalEvent; compact?: boolean }) {
  const start = new Date(e.start);
  const dayLabel = isToday(start)
    ? formatTime(start)
    : start.toLocaleDateString("es-AR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }) + " · " + formatTime(start);
  return (
    <div className="rounded-md border bg-card p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={cn("truncate font-medium", !compact && "text-sm")}>
            {e.summary}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {dayLabel} · {e.source_label}
          </div>
        </div>
        {e.hangoutLink && (
          <a
            href={e.hangoutLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/20"
          >
            <Video className="h-3 w-3" /> Meet
          </a>
        )}
      </div>
    </div>
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
      className="block rounded-md border bg-card p-2 text-xs transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{pub.titulo}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {pub.cliente?.nombre} · {pub.red}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {date}
        </div>
      </div>
    </Link>
  );
}

function NotifItem({
  notif,
}: {
  notif: { id: string; tipo: string; mensaje: string; task_id: string | null; created_at: string };
}) {
  const Icon =
    notif.tipo === "mencion"
      ? AtSign
      : notif.tipo === "asignacion"
      ? UserPlus
      : notif.tipo === "comentario"
      ? MessageCircle
      : notif.tipo === "vencida"
      ? AlertCircle
      : notif.tipo === "proxima_a_vencer"
      ? Clock
      : Bell;
  const color =
    notif.tipo === "vencida"
      ? "text-red-500"
      : notif.tipo === "proxima_a_vencer"
      ? "text-amber-500"
      : notif.tipo === "mencion"
      ? "text-primary"
      : "text-muted-foreground";
  const href = notif.task_id
    ? `/tareas/${notif.task_id}`
    : notif.tipo === "mencion"
    ? "/chat"
    : "/notificaciones";
  const time = new Date(notif.created_at).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Link
      href={href}
      className="flex items-start gap-2 rounded-md border bg-card p-2 text-xs transition hover:border-primary/30"
    >
      <Icon className={"mt-0.5 h-3.5 w-3.5 shrink-0 " + color} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2">{notif.mensaje}</div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">{time}</div>
      </div>
    </Link>
  );
}

function ClientRowCard({
  row,
}: {
  row: {
    client: { id: string; nombre: string; pack: string | null; estado: string };
    nextAction: {
      kind: "tarea" | "publicacion";
      label: string;
      sublabel: string;
      urgency: "vencida" | "hoy" | "pronto" | "futuro";
      href: string;
    } | null;
    counts: { tareasActivas: number; tareasVencidas: number; pubsSemana: number };
  };
}) {
  const { client, nextAction, counts } = row;
  const urgencyTone =
    nextAction?.urgency === "vencida"
      ? "border-l-rose-500"
      : nextAction?.urgency === "hoy"
      ? "border-l-primary"
      : nextAction?.urgency === "pronto"
      ? "border-l-amber-500"
      : "border-l-muted";
  const urgencyBadge =
    nextAction?.urgency === "vencida"
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
      : nextAction?.urgency === "hoy"
      ? "bg-primary/15 text-foreground"
      : nextAction?.urgency === "pronto"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : "bg-muted text-muted-foreground";

  return (
    <Link
      href={`/clientes/${client.id}`}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-l-4 bg-card p-3 transition hover:shadow-sm",
        urgencyTone
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{client.nombre}</div>
          {client.pack && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {client.pack}
            </div>
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      {nextAction ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                urgencyBadge
              )}
            >
              {nextAction.urgency === "vencida"
                ? "Vencida"
                : nextAction.urgency === "hoy"
                ? "Hoy"
                : nextAction.urgency === "pronto"
                ? "Esta semana"
                : "Próximo"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {nextAction.kind === "tarea" ? "tarea" : "publicación"}
            </span>
          </div>
          <div className="line-clamp-1 text-xs font-medium">{nextAction.label}</div>
          <div className="text-[10px] text-muted-foreground">{nextAction.sublabel}</div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Sin acciones pendientes esta semana.
        </p>
      )}
      <div className="flex items-center gap-3 border-t pt-2 text-[10px] text-muted-foreground">
        <span>
          <strong className="text-foreground">{counts.tareasActivas}</strong> tareas
          {counts.tareasVencidas > 0 && (
            <span className="ml-1 text-rose-600 dark:text-rose-400">
              · {counts.tareasVencidas} venc.
            </span>
          )}
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground">{counts.pubsSemana}</strong> pubs/sem
        </span>
      </div>
    </Link>
  );
}
