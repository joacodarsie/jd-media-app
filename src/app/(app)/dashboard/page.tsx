import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
  Sun,
  Video,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { listEventsForUser } from "@/lib/google-calendar";
import { PRIORITY_ORDER } from "@/lib/constants";
import type { PublicationWithRels, TaskWithRels } from "@/lib/types";
import { dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TaskList } from "@/components/task-list";

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
  const [
    { data: myClients },
    { data: taskData },
    { data: pubData },
    { data: calConns },
    { data: delegatedRaw },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id, nombre")
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
      .gte("fecha_publicacion", startOfDay.toISOString())
      .lte("fecha_publicacion", inAWeek.toISOString())
      .order("fecha_publicacion", { ascending: true })
      .limit(8),
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
  ]);

  const hasCalendarConnections = (calConns ?? []).length > 0;
  const calendarEvents: CalEvent[] = hasCalendarConnections
    ? await listEventsForUser(user.id, startOfDay.toISOString(), inAWeek.toISOString()).catch(() => [])
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
  const allPubs = (pubData ?? []) as unknown as PublicationWithRels[];
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

  // Pubs semana = todas las del pubData que no son de hoy
  const pubsHoyIds = new Set(pubsHoy.map((p) => p.id));
  const pubsSemana = allPubs.filter((p) => !pubsHoyIds.has(p.id));

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
            <h1 className="mt-1 text-2xl font-bold">
              Hola, {user.nombre.split(" ")[0]}{" "}
              <span className="ml-1">👋</span>
            </h1>
            <p className="text-muted-foreground">
              {todayCount === 0
                ? "Tu día está limpio. Aprovechá para revisar la agenda o leer documentación."
                : `Tenés ${todayCount} cosa${todayCount === 1 ? "" : "s"} para hoy.`}
            </p>
          </div>

          {/* Stat compactas en la esquina */}
          <div className="flex gap-3 text-sm">
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
              {!hasCalendarConnections ? (
                <EmptyMini
                  icon={CalendarClock}
                  text="Conectá tu Calendar desde Mi perfil."
                />
              ) : eventsHoy.length === 0 ? (
                <EmptyMini icon={CalendarClock} text="Sin reuniones hoy." />
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
              {!hasCalendarConnections ? null : eventsSemana.length === 0 ? (
                <EmptyMini icon={CalendarClock} text="Sin más reuniones esta semana." />
              ) : (
                <div className="space-y-2">
                  {eventsSemana.slice(0, 5).map((e) => (
                    <EventItem key={`${e.source_id}-${e.id}`} event={e} compact />
                  ))}
                </div>
              )}
            </SubBlock>

            <SubBlock
              title="Próximas publicaciones"
              right={
                <Link href="/contenidos" className="text-xs text-muted-foreground hover:text-foreground">
                  Calendario →
                </Link>
              }
            >
              {pubsSemana.length === 0 ? (
                <EmptyMini icon={CalendarDays} text="Nada agendado." />
              ) : (
                <div className="space-y-1.5">
                  {pubsSemana.slice(0, 5).map((p) => (
                    <PubItem key={p.id} pub={p} />
                  ))}
                </div>
              )}
            </SubBlock>

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
    <div className="flex flex-col items-end">
      <div className={cn("text-xl font-bold leading-none tabular-nums", toneCls[tone])}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
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
