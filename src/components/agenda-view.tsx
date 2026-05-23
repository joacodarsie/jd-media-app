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

type RangeOption = "next7" | "next30" | "last7Andnext14";

const RANGE_LABELS: Record<RangeOption, string> = {
  next7: "Próximos 7 días",
  next30: "Próximos 30 días",
  last7Andnext14: "Últimos 7 + próximos 14",
};

function rangeBounds(range: RangeOption): { from: Date; to: Date } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "next7") {
    return { from: now, to: new Date(start.getTime() + 7 * 86400000) };
  }
  if (range === "next30") {
    return { from: now, to: new Date(start.getTime() + 30 * 86400000) };
  }
  return {
    from: new Date(start.getTime() - 7 * 86400000),
    to: new Date(start.getTime() + 14 * 86400000),
  };
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayHeading(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - now.getTime()) / 86400000);
  const long = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (diff === 0) return `Hoy · ${long}`;
  if (diff === 1) return `Mañana · ${long}`;
  if (diff === -1) return `Ayer · ${long}`;
  return long.charAt(0).toUpperCase() + long.slice(1);
}

function formatTimeRange(start: string, end: string, isAllDay: boolean) {
  if (isAllDay) return "Todo el día";
  const s = new Date(start);
  const e = new Date(end);
  const sStr = s.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const eStr = e.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${sStr} – ${eStr}`;
}

export function AgendaView({ connections }: { connections: Connection[] }) {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeOption>("last7Andnext14");
  const [search, setSearch] = useState("");
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(connections.map((c) => c.id))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    if (connections.length === 0) {
      setEvents([]);
      return;
    }
    setEvents(null);
    setError(null);
    const { from, to } = rangeBounds(range);
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
  }, [range]);

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

  const grouped = useMemo(() => {
    if (!filtered) return null;
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const k = dayKey(new Date(e.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

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
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar reunión…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(RANGE_LABELS) as RangeOption[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === range ? "default" : "outline"}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
      </div>

      {/* Source filters */}
      {connections.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {connections.map((c) => {
            const active = activeSources.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleSource(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.visibility === "shared" ? (
                  <Globe className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                {c.label}
                <span className="text-muted-foreground">· {c.google_email}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Error: {error}
        </div>
      )}

      {grouped === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando reuniones…
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay reuniones en este rango.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, evs]) => (
            <section key={day} className="space-y-2">
              <h2 className="sticky top-0 z-10 bg-background/80 py-1 text-sm font-semibold backdrop-blur">
                {formatDayHeading(day)}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({evs.length} reunión{evs.length !== 1 ? "es" : ""})
                </span>
              </h2>
              <div className="space-y-2">
                {evs.map((e) => {
                  const key = `${e.source_id}-${e.id}`;
                  const isExpanded = expanded.has(key);
                  const attendeesCount = e.attendees?.length ?? 0;
                  return (
                    <article
                      key={key}
                      className="rounded-lg border bg-card p-3 transition hover:border-primary/30"
                    >
                      <div className="flex items-start justify-between gap-3">
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
                                <Video className="h-3 w-3" /> Unirme a Meet
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
                                <ExternalLink className="h-3 w-3" /> Abrir en Google
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
                                      <li className="italic">
                                        +{attendeesCount - 20} más
                                      </li>
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
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
