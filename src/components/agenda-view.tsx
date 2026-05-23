"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Video,
  MapPin,
  ExternalLink,
  Loader2,
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

// Paleta de colores fija para las primeras N conexiones
const SOURCE_PALETTE = [
  { bg: "bg-blue-500", text: "text-blue-50", soft: "bg-blue-500/15 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { bg: "bg-emerald-500", text: "text-emerald-50", soft: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { bg: "bg-amber-500", text: "text-amber-50", soft: "bg-amber-500/15 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  { bg: "bg-fuchsia-500", text: "text-fuchsia-50", soft: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-500" },
  { bg: "bg-rose-500", text: "text-rose-50", soft: "bg-rose-500/15 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  { bg: "bg-cyan-500", text: "text-cyan-50", soft: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
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
  // lunes
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
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

// Rango de fetch según view + cursor
function rangeFor(view: ViewMode, cursor: Date): { from: Date; to: Date } {
  if (view === "month") {
    // Incluye días del mes anterior/siguiente que aparecen en la grilla
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = addDays(gridStart, 41); // 6 semanas
    gridEnd.setHours(23, 59, 59, 999);
    return { from: gridStart, to: gridEnd > monthEnd ? gridEnd : monthEnd };
  }
  if (view === "week") {
    const ws = startOfWeek(cursor);
    return { from: ws, to: addDays(ws, 7) };
  }
  // list: últimos 7 + próximos 21 desde cursor
  const base = startOfDay(cursor);
  return { from: addDays(base, -7), to: addDays(base, 22) };
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

export function AgendaView({ connections }: { connections: Connection[] }) {
  const [view, setView] = useState<ViewMode>("list");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(connections.map((c) => c.id))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  async function load() {
    if (connections.length === 0) {
      setEvents([]);
      return;
    }
    setEvents(null);
    setError(null);
    const { from, to } = rangeFor(view, cursor);
    try {
      const res = await fetch(
        `/api/google/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
      );
      const json = await res.json();
      if (json.error) setError(json.error);
      else setEvents(json.events ?? []);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cursor]);

  const filtered = useMemo(() => {
    if (!events) return null;
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!activeSources.has(e.source_id)) return false;
      if (e.status === "cancelled") return false;
      if (q && !e.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, activeSources, search]);

  function toggleSource(id: string) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(eventKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(eventKey)) next.delete(eventKey);
      else next.add(eventKey);
      return next;
    });
  }

  function goPrev() {
    if (view === "month") setCursor(addMonths(cursor, -1));
    else if (view === "week") setCursor(addDays(cursor, -7));
    else setCursor(addDays(cursor, -7));
  }

  function goNext() {
    if (view === "month") setCursor(addMonths(cursor, 1));
    else if (view === "week") setCursor(addDays(cursor, 7));
    else setCursor(addDays(cursor, 7));
  }

  function goToday() {
    setCursor(new Date());
    setSelectedDay(null);
  }

  if (connections.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          No tenés Calendars conectados.
        </p>
        <Link
          href="/mi-perfil"
          className="mt-3 inline-block text-sm font-medium text-primary underline"
        >
          Conectar Google Calendar →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={goNext} aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1 text-sm font-semibold">{titleFor(view, cursor)}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="inline-flex rounded-md border bg-card p-0.5">
            <button
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Lista"
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setView("week")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Semana"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Semana
            </button>
            <button
              onClick={() => setView("month")}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Mes"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Mes
            </button>
          </div>
        </div>
      </div>

      {/* Source filters */}
      {connections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {connections.map((c) => {
            const active = activeSources.has(c.id);
            const color = colorFor(connections, c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleSource(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={`inline-block h-2 w-2 rounded-full ${color.dot}`} />
                {c.visibility === "shared" ? (
                  <Globe className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Error: {error}
        </div>
      )}

      {filtered === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando reuniones…
        </div>
      ) : view === "list" ? (
        <ListView
          events={filtered}
          connections={connections}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
        />
      ) : view === "week" ? (
        <WeekView
          cursor={cursor}
          events={filtered}
          connections={connections}
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
          selectedDay={selectedDay}
          onSelectDay={(d) => setSelectedDay(d)}
        />
      )}

      {/* Day detail popup en month view */}
      {view === "month" && selectedDay && (
        <DayDetail
          day={selectedDay}
          events={filtered ?? []}
          connections={connections}
          onClose={() => setSelectedDay(null)}
          expanded={expanded}
          toggleExpanded={toggleExpanded}
        />
      )}
    </div>
  );
}

/* ---------- ListView ---------- */

function ListView({
  events,
  connections,
  expanded,
  toggleExpanded,
}: {
  events: CalendarEvent[];
  connections: Connection[];
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
        return (
          <section key={day} className="space-y-2">
            <h2 className="sticky top-0 z-10 bg-background/80 py-1 text-sm font-semibold backdrop-blur">
              {formatDayHeading(date)}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({evs.length})
              </span>
            </h2>
            <div className="space-y-2">
              {evs.map((e) => (
                <EventCard
                  key={`${e.source_id}-${e.id}`}
                  event={e}
                  connections={connections}
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
  onSelectDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  connections: Connection[];
  onSelectDay: (d: Date) => void;
}) {
  const ws = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  // agrupo eventos por día
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) map.set(dayKey(new Date(e.start)), []);
    for (const e of events) {
      const k = dayKey(new Date(e.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [events]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((day) => {
        const k = dayKey(day);
        const evs = byDay.get(k) ?? [];
        const isToday = isSameDay(day, today);
        return (
          <div
            key={k}
            className={`rounded-lg border bg-card p-2 ${isToday ? "border-primary" : ""}`}
          >
            <button
              onClick={() => onSelectDay(day)}
              className="mb-2 flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  {day.toLocaleDateString("es-AR", { weekday: "short" })}
                </div>
                <div
                  className={`text-lg font-semibold ${isToday ? "text-primary" : ""}`}
                >
                  {day.getDate()}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{evs.length}</span>
            </button>
            <div className="space-y-1">
              {evs.length === 0 ? (
                <div className="py-1 text-xs text-muted-foreground/60">—</div>
              ) : (
                evs
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
                          <span className="opacity-70">
                            {formatTime(new Date(e.start))}{" "}
                          </span>
                        )}
                        {e.summary}
                      </div>
                    );
                  })
              )}
              {evs.length > 6 && (
                <div className="text-[11px] text-muted-foreground">
                  +{evs.length - 6} más
                </div>
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
  selectedDay,
  onSelectDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  connections: Connection[];
  selectedDay: Date | null;
  onSelectDay: (d: Date) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  // 6 semanas = 42 días para grid fijo
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return map;
  }, [events]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="rounded-lg border bg-card">
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
          const evs = (byDay.get(k) ?? []).sort((a, b) => a.start.localeCompare(b.start));
          const isCurMonth = day.getMonth() === cursor.getMonth();
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          return (
            <button
              key={i}
              onClick={() => onSelectDay(day)}
              className={`group min-h-[90px] border-b border-r p-1.5 text-left transition hover:bg-muted/30 ${
                i % 7 === 6 ? "border-r-0" : ""
              } ${i >= 35 ? "border-b-0" : ""} ${
                !isCurMonth ? "bg-muted/20 text-muted-foreground/60" : ""
              } ${isSelected ? "bg-primary/10" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : ""
                  }`}
                >
                  {day.getDate()}
                </span>
                {evs.length > 0 && !isToday && (
                  <span className="text-[10px] text-muted-foreground">
                    {evs.length}
                  </span>
                )}
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
                          <span className="opacity-70">
                            {formatTime(new Date(e.start))}{" "}
                          </span>
                        )}
                        {e.summary}
                      </span>
                    </div>
                  );
                })}
                {evs.length > 3 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{evs.length - 3} más
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- DayDetail (popup en MonthView) ---------- */

function DayDetail({
  day,
  events,
  connections,
  onClose,
  expanded,
  toggleExpanded,
}: {
  day: Date;
  events: CalendarEvent[];
  connections: Connection[];
  onClose: () => void;
  expanded: Set<string>;
  toggleExpanded: (k: string) => void;
}) {
  const k = dayKey(day);
  const evs = events
    .filter((e) => dayKey(new Date(e.start)) === k)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl rounded-t-xl border bg-card p-4 shadow-2xl md:bottom-4 md:right-4 md:left-auto md:max-w-md md:rounded-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{formatDayHeading(day)}</h3>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
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

/* ---------- EventCard reusable ---------- */

function EventCard({
  event: e,
  connections,
  expanded,
  toggleExpanded,
  compact = false,
}: {
  event: CalendarEvent;
  connections: Connection[];
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
