"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Calendar,
  Video,
  MapPin,
  ExternalLink,
  Search,
  Users,
  Lock,
  Globe,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  LayoutGrid,
  AlertTriangle,
  Keyboard,
  Briefcase,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Connection {
  id: string;
  label: string;
  google_email: string;
  visibility: "private" | "shared";
  mine: boolean;
}

interface ClientLite {
  id: string;
  nombre: string;
  contacto_email: string | null;
}

function matchClient(
  event: CalendarEvent,
  clients: ClientLite[]
): ClientLite | null {
  const title = (event.summary ?? "").toLowerCase();
  const attendeeEmails = (event.attendees ?? []).map((a) => a.email?.toLowerCase()).filter(Boolean);
  for (const c of clients) {
    const name = c.nombre.toLowerCase();
    if (name.length >= 3 && title.includes(name)) return c;
    if (c.contacto_email) {
      const e = c.contacto_email.toLowerCase();
      if (attendeeEmails.includes(e)) return c;
    }
  }
  return null;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
  hangoutLink?: string;
  htmlLink?: string;
  location?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  status?: string;
  source_id: string;
  source_label: string;
  source_email: string;
  source_visibility: "private" | "shared";
}

type ViewMode = "list" | "week" | "month";

const SOURCE_PALETTE = [
  { soft: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { soft: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { soft: "bg-amber-500/15 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  { soft: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-500" },
  { soft: "bg-rose-500/15 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  { soft: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
];

function colorFor(connections: Connection[], sourceId: string) {
  const idx = connections.findIndex((c) => c.id === sourceId);
  return SOURCE_PALETTE[(idx >= 0 ? idx : 0) % SOURCE_PALETTE.length];
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimeRange(start: string, end: string, isAllDay: boolean) {
  if (isAllDay) return "Todo el día";
  const s = new Date(start);
  const e = new Date(end);
  const sStr = s.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const eStr = e.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${sStr} – ${eStr}`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeading(date: Date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((startOfDay(date).getTime() - now.getTime()) / 86400000);
  const long = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const cap = long.charAt(0).toUpperCase() + long.slice(1);
  if (diff === 0) return `Hoy · ${cap}`;
  if (diff === 1) return `Mañana · ${cap}`;
  if (diff === -1) return `Ayer · ${cap}`;
  return cap;
}

function rangeFor(view: ViewMode, cursor: Date): { from: Date; to: Date } {
  if (view === "month") {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = addDays(gridStart, 41);
    gridEnd.setHours(23, 59, 59, 999);
    return { from: gridStart, to: gridEnd > monthEnd ? gridEnd : monthEnd };
  }
  if (view === "week") {
    const ws = startOfWeek(cursor);
    return { from: ws, to: addDays(ws, 7) };
  }
  const base = startOfDay(cursor);
  return { from: addDays(base, -7), to: addDays(base, 22) };
}

function rangeKey(from: Date, to: Date) {
  return `${dayKey(from)}__${dayKey(to)}`;
}

function titleFor(view: ViewMode, cursor: Date): string {
  if (view === "month") {
    const s = cursor.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (view === "week") {
    const ws = startOfWeek(cursor);
    const we = addDays(ws, 6);
    const sameMonth = ws.getMonth() === we.getMonth();
    if (sameMonth) {
      return `${ws.getDate()} – ${we.getDate()} ${we.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}`;
    }
    return `${ws.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${we.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return "Próximas reuniones";
}

const LS_VIEW_KEY = "agenda:view";

export function AgendaView({
  connections,
  clients = [],
  initialEvents,
  initialFrom,
  initialTo,
}: {
  connections: Connection[];
  clients?: ClientLite[];
  initialEvents: CalendarEvent[];
  initialFrom: string;
  initialTo: string;
}) {
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  // Cache de fetches: rangeKey -> events
  const cacheRef = useRef<Map<string, CalendarEvent[]>>(new Map());
  // Seed con el initial
  if (cacheRef.current.size === 0 && initialFrom && initialTo) {
    cacheRef.current.set(
      rangeKey(new Date(initialFrom), new Date(initialTo)),
      initialEvents
    );
  }

  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(connections.map((c) => c.id))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore view preference
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_VIEW_KEY);
      if (v === "list" || v === "week" || v === "month") setView(v);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist view
  useEffect(() => {
    try {
      localStorage.setItem(LS_VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const fetchRange = useCallback(
    async (from: Date, to: Date) => {
      if (connections.length === 0) {
        setEvents([]);
        return;
      }
      const k = rangeKey(from, to);
      const cached = cacheRef.current.get(k);
      if (cached) {
        setEvents(cached);
        return;
      }
      setIsFetching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/google/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
        );
        const json = await res.json();
        if (json.error) {
          setError(json.error);
        } else {
          const evs = (json.events ?? []) as CalendarEvent[];
          cacheRef.current.set(k, evs);
          setEvents(evs);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setIsFetching(false);
      }
    },
    [connections.length]
  );

  // Refetch al cambiar view o cursor (excepto en mount con initial)
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const { from, to } = rangeFor(view, cursor);
    fetchRange(from, to);
  }, [view, cursor, fetchRange]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return events.filter((e) => {
      if (!activeSources.has(e.source_id)) return false;
      if (e.status === "cancelled") return false;
      if (q && !e.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, activeSources, deferredSearch]);

  // Detecto solapes por día (entre eventos no all-day)
  const conflictDays = useMemo(() => {
    const byDay = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      if (e.isAllDay) continue;
      const k = dayKey(new Date(e.start));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    }
    const conflicts = new Set<string>();
    for (const [k, evs] of byDay) {
      const sorted = [...evs].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) {
        if (new Date(sorted[i].start) < new Date(sorted[i - 1].end)) {
          conflicts.add(k);
          break;
        }
      }
    }
    return conflicts;
  }, [filtered]);

  const toggleSource = useCallback((id: string) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((eventKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(eventKey)) next.delete(eventKey);
      else next.add(eventKey);
      return next;
    });
  }, []);

  const goPrev = useCallback(() => {
    setCursor((c) => (view === "month" ? addMonths(c, -1) : addDays(c, -7)));
  }, [view]);

  const goNext = useCallback(() => {
    setCursor((c) => (view === "month" ? addMonths(c, 1) : addDays(c, 7)));
  }, [view]);

  const goToday = useCallback(() => {
    setCursor(new Date());
    setSelectedDay(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const target = ev.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (ev.key === "/" && !isTyping) {
        ev.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (isTyping) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        goPrev();
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        goNext();
      } else if (ev.key === "t" || ev.key === "T") {
        ev.preventDefault();
        goToday();
      } else if (ev.key === "l" || ev.key === "L") {
        setView("list");
      } else if (ev.key === "w" || ev.key === "W") {
        setView("week");
      } else if (ev.key === "m" || ev.key === "M") {
        setView("month");
      } else if (ev.key === "?") {
        setShowShortcuts((s) => !s);
      } else if (ev.key === "Escape") {
        setSelectedDay(null);
        setShowShortcuts(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, goToday]);

  if (connections.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-3 font-semibold">Sin Calendars conectados</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Conectá tu Google Calendar para ver tus reuniones acá.
        </p>
        <Link
          href="/mi-perfil"
          className="mt-4 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Conectar Google Calendar →
        </Link>
      </div>
    );
  }

  const hasConflicts = conflictDays.size > 0;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} aria-label="Anterior (←)">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} aria-label="Hoy (T)">
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={goNext} aria-label="Siguiente (→)">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1 text-sm font-semibold" aria-live="polite">
            {titleFor(view, cursor)}
          </span>
          {isFetching && (
            <span
              className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
              aria-label="Actualizando"
              title="Actualizando…"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Buscar… ( / )"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              aria-label="Buscar reuniones por título"
            />
          </div>
          <div
            className="inline-flex rounded-md border bg-card p-0.5"
            role="tablist"
            aria-label="Vista de agenda"
          >
            <ViewTab current={view} value="list" onClick={() => setView("list")} icon={<List className="h-3.5 w-3.5" />} label="Lista" hint="L" />
            <ViewTab current={view} value="week" onClick={() => setView("week")} icon={<CalendarDays className="h-3.5 w-3.5" />} label="Semana" hint="W" />
            <ViewTab current={view} value="month" onClick={() => setView("month")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Mes" hint="M" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShortcuts((s) => !s)}
            aria-label="Mostrar atajos de teclado"
            title="Atajos (?)"
            className="hidden md:inline-flex"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtros + contador */}
      <div className="flex flex-wrap items-center gap-2">
        {connections.map((c) => {
          const active = activeSources.has(c.id);
          const color = colorFor(connections, c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleSource(c.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                active
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${color.dot}`} />
              {c.visibility === "shared" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {c.label}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} reunión{filtered.length !== 1 ? "es" : ""}
          {hasConflicts && (
            <span
              className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"
              title="Hay días con reuniones superpuestas"
            >
              <AlertTriangle className="h-3 w-3" />
              {conflictDays.size} conflicto{conflictDays.size !== 1 ? "s" : ""}
            </span>
          )}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Error: {error}
        </div>
      )}

      {events.length === 0 && isFetching ? (
        <ViewSkeleton view={view} />
      ) : view === "list" ? (
        <ListView
          events={filtered}
          connections={connections}
          clients={clients}
          conflictDays={conflictDays}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
        />
      ) : view === "week" ? (
        <WeekView
          cursor={cursor}
          events={filtered}
          connections={connections}
          conflictDays={conflictDays}
          onSelectDay={(d) => {
            setCursor(d);
            setSelectedDay(d);
            setView("list");
          }}
        />
      ) : (
        <MonthView
          cursor={cursor}
          events={filtered}
          connections={connections}
          conflictDays={conflictDays}
          selectedDay={selectedDay}
          onSelectDay={(d) => setSelectedDay(d)}
        />
      )}

      {view === "month" && selectedDay && (
        <DayDetail
          day={selectedDay}
          events={filtered}
          connections={connections}
          clients={clients}
          onClose={() => setSelectedDay(null)}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
        />
      )}

      {showShortcuts && (
        <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}

/* ---------- ViewTab ---------- */

function ViewTab({
  current,
  value,
  onClick,
  icon,
  label,
  hint,
}: {
  current: ViewMode;
  value: ViewMode;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  const active = current === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={`${label} (${hint})`}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ---------- ListView ---------- */

function ListView({
  events,
  connections,
  clients,
  conflictDays,
  expanded,
  toggleExpanded,
}: {
  events: CalendarEvent[];
  connections: Connection[];
  clients: ClientLite[];
  conflictDays: Set<string>;
  expanded: Set<string>;
  toggleExpanded: (k: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        No hay reuniones en este rango.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(([day, evs]) => {
        const [y, m, d] = day.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        const hasConflict = conflictDays.has(day);
        return (
          <section key={day} className="space-y-2">
            <h2 className="sticky top-0 z-10 flex items-center gap-2 bg-background/80 py-1 text-sm font-semibold backdrop-blur">
              {formatDayHeading(date)}
              <span className="text-xs font-normal text-muted-foreground">
                ({evs.length})
              </span>
              {hasConflict && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-normal text-amber-700 dark:text-amber-400"
                  title="Reuniones superpuestas"
                >
                  <AlertTriangle className="h-3 w-3" /> conflicto
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {evs.map((e) => (
                <EventCard
                  key={`${e.source_id}-${e.id}`}
                  event={e}
                  connections={connections}
                  client={matchClient(e, clients)}
                  expanded={expanded}
                  toggleExpanded={toggleExpanded}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------- WeekView ---------- */

function WeekView({
  cursor,
  events,
  connections,
  conflictDays,
  onSelectDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  connections: Connection[];
  conflictDays: Set<string>;
  onSelectDay: (d: Date) => void;
}) {
  const ws = startOfWeek(cursor);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(ws, i)), [ws]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [events]);

  const today = startOfDay(new Date());

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7" role="grid" aria-label="Semana">
      {days.map((day) => {
        const k = dayKey(day);
        const evs = byDay.get(k) ?? [];
        const isToday = isSameDay(day, today);
        const hasConflict = conflictDays.has(k);
        return (
          <div
            key={k}
            role="gridcell"
            aria-current={isToday ? "date" : undefined}
            className={`rounded-lg border bg-card p-2 ${isToday ? "border-primary" : ""}`}
          >
            <button
              onClick={() => onSelectDay(day)}
              className="mb-2 flex w-full items-center justify-between text-left"
              aria-label={`Abrir lista de ${day.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}`}
            >
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  {day.toLocaleDateString("es-AR", { weekday: "short" })}
                </div>
                <div className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}>
                  {day.getDate()}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {hasConflict && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                <span className="text-xs text-muted-foreground">{evs.length}</span>
              </div>
            </button>
            <div className="space-y-1">
              {evs.length === 0 ? (
                <div className="py-1 text-xs text-muted-foreground/60">—</div>
              ) : (
                evs
                  .slice()
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .slice(0, 6)
                  .map((e) => {
                    const color = colorFor(connections, e.source_id);
                    return (
                      <div
                        key={`${e.source_id}-${e.id}`}
                        className={`truncate rounded px-1.5 py-0.5 text-[11px] ${color.soft}`}
                        title={`${e.summary} · ${formatTimeRange(e.start, e.end, e.isAllDay)}`}
                      >
                        {!e.isAllDay && (
                          <span className="opacity-70">{formatTime(new Date(e.start))} </span>
                        )}
                        {e.summary}
                      </div>
                    );
                  })
              )}
              {evs.length > 6 && (
                <div className="text-[11px] text-muted-foreground">+{evs.length - 6} más</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- MonthView ---------- */

function MonthView({
  cursor,
  events,
  connections,
  conflictDays,
  selectedDay,
  onSelectDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  connections: Connection[];
  conflictDays: Set<string>;
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const days = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [events]);

  const today = startOfDay(new Date());
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="rounded-lg border bg-card" role="grid" aria-label="Vista mensual">
      <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
        {weekdays.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const k = dayKey(day);
          const evs = (byDay.get(k) ?? []).slice().sort((a, b) => a.start.localeCompare(b.start));
          const isCurMonth = day.getMonth() === cursor.getMonth();
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const hasConflict = conflictDays.has(k);
          return (
            <button
              key={i}
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              onClick={() => onSelectDay(day)}
              className={`group min-h-[88px] border-b border-r p-1.5 text-left transition hover:bg-muted/30 sm:min-h-[100px] ${
                i % 7 === 6 ? "border-r-0" : ""
              } ${i >= 35 ? "border-b-0" : ""} ${
                !isCurMonth ? "bg-muted/20 text-muted-foreground/60" : ""
              } ${isSelected ? "bg-primary/10" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-primary font-semibold text-primary-foreground" : ""
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="flex items-center gap-0.5">
                  {hasConflict && (
                    <AlertTriangle
                      className="h-3 w-3 text-amber-500"
                      aria-label="Conflicto"
                    />
                  )}
                  {evs.length > 0 && !isToday && (
                    <span className="text-[10px] text-muted-foreground">{evs.length}</span>
                  )}
                </div>
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e) => {
                  const color = colorFor(connections, e.source_id);
                  return (
                    <div
                      key={`${e.source_id}-${e.id}`}
                      className={`flex items-center gap-1 truncate rounded px-1 text-[10px] leading-tight ${color.soft}`}
                      title={`${e.summary} · ${formatTimeRange(e.start, e.end, e.isAllDay)}`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color.dot}`} />
                      <span className="truncate">
                        {!e.isAllDay && (
                          <span className="opacity-70">{formatTime(new Date(e.start))} </span>
                        )}
                        {e.summary}
                      </span>
                    </div>
                  );
                })}
                {evs.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">+{evs.length - 3} más</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- DayDetail ---------- */

function DayDetail({
  day,
  events,
  connections,
  clients,
  onClose,
  expanded,
  toggleExpanded,
}: {
  day: Date;
  events: CalendarEvent[];
  connections: Connection[];
  clients: ClientLite[];
  onClose: () => void;
  expanded: Set<string>;
  toggleExpanded: (k: string) => void;
}) {
  const k = dayKey(day);
  const evs = events
    .filter((e) => dayKey(new Date(e.start)) === k)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div
      role="dialog"
      aria-label={`Reuniones de ${day.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`}
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl rounded-t-xl border bg-card p-4 shadow-2xl md:bottom-4 md:right-4 md:left-auto md:max-w-md md:rounded-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{formatDayHeading(day)}</h3>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label="Cerrar (Esc)"
        >
          Cerrar
        </button>
      </div>
      {evs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin reuniones este día.</p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {evs.map((e) => (
            <EventCard
              key={`${e.source_id}-${e.id}`}
              event={e}
              connections={connections}
              client={matchClient(e, clients)}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- EventCard ---------- */

function EventCard({
  event: e,
  connections,
  client,
  expanded,
  toggleExpanded,
  compact = false,
}: {
  event: CalendarEvent;
  connections: Connection[];
  client?: ClientLite | null;
  expanded: Set<string>;
  toggleExpanded: (k: string) => void;
  compact?: boolean;
}) {
  const key = `${e.source_id}-${e.id}`;
  const isExpanded = expanded.has(key);
  const attendeesCount = e.attendees?.length ?? 0;
  const color = colorFor(connections, e.source_id);

  return (
    <article
      className={`rounded-lg border bg-card transition hover:border-primary/30 ${compact ? "p-2" : "p-3"}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium leading-tight">{e.summary}</h3>
            {e.status === "tentative" && (
              <Badge variant="outline" className="text-xs">
                Tentativo
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatTimeRange(e.start, e.end, e.isAllDay)}</span>
            <span className="inline-flex items-center gap-1">
              {e.source_visibility === "shared" ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {e.source_label}
            </span>
            {attendeesCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {attendeesCount}
              </span>
            )}
            {client && (
              <a
                href={`/clientes/${client.id}`}
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/20"
                title={`Cliente: ${client.nombre}`}
              >
                <Briefcase className="h-3 w-3" />
                {client.nombre}
              </a>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {e.hangoutLink && (
              <a
                href={e.hangoutLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary hover:bg-primary/20"
              >
                <Video className="h-3 w-3" /> Meet
              </a>
            )}
            {e.location && !e.hangoutLink && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" /> {e.location}
              </span>
            )}
            {e.htmlLink && (
              <a
                href={e.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" /> Google
              </a>
            )}
            {(e.description || attendeesCount > 0 || e.location) && (
              <button
                onClick={() => toggleExpanded(key)}
                aria-expanded={isExpanded}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> Detalles
                  </>
                )}
              </button>
            )}
          </div>
          {isExpanded && (
            <div className="mt-3 space-y-2 border-t pt-3 text-xs">
              {e.description && (
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {e.description.slice(0, 600)}
                  {e.description.length > 600 && "…"}
                </div>
              )}
              {e.location && e.hangoutLink && (
                <div className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {e.location}
                </div>
              )}
              {attendeesCount > 0 && (
                <div>
                  <div className="mb-1 font-medium">Asistentes</div>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {e.attendees!.slice(0, 20).map((a) => (
                      <li key={a.email}>
                        {a.displayName ?? a.email}
                        {a.responseStatus === "accepted" && " ✓"}
                        {a.responseStatus === "declined" && " ✗"}
                        {a.responseStatus === "tentative" && " ?"}
                      </li>
                    ))}
                    {attendeesCount > 20 && (
                      <li className="italic">+{attendeesCount - 20} más</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* ---------- ViewSkeleton ---------- */

function ViewSkeleton({ view }: { view: ViewMode }) {
  if (view === "month") {
    return (
      <div className="grid grid-cols-7 gap-px rounded-lg border bg-border">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="min-h-[88px] animate-pulse bg-card p-1.5">
            <div className="h-3 w-5 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (view === "week") {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border bg-card" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded-lg border bg-card" />
          <div className="h-16 animate-pulse rounded-lg border bg-card" />
        </div>
      ))}
    </div>
  );
}

/* ---------- ShortcutsHelp ---------- */

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const items: [string, string][] = [
    ["←", "Anterior"],
    ["→", "Siguiente"],
    ["T", "Hoy"],
    ["L", "Vista Lista"],
    ["W", "Vista Semana"],
    ["M", "Vista Mes"],
    ["/", "Enfocar buscador"],
    ["Esc", "Cerrar popup"],
    ["?", "Mostrar/ocultar atajos"],
  ];
  return (
    <div
      role="dialog"
      aria-label="Atajos de teclado"
      className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border bg-card p-4 shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Atajos</h3>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cerrar
        </button>
      </div>
      <ul className="space-y-1 text-sm">
        {items.map(([k, label]) => (
          <li key={k} className="flex items-center justify-between">
            <span className="text-muted-foreground">{label}</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">{k}</kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
