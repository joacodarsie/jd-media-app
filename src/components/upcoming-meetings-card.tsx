"use client";

import { useEffect, useState } from "react";
import { Calendar, Video, MapPin, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  hangoutLink?: string;
  htmlLink?: string;
  location?: string;
  source_label: string;
  source_email: string;
}

function formatWhen(start: string) {
  const d = new Date(start);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoy ${time}`;
  if (isTomorrow) return `Mañana ${time}`;
  return d.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UpcomingMeetingsCard() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/google/events")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setEvents(j.events ?? []);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error)
    return null; // silencioso si falla; el card no aporta si no hay calendar conectado

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" /> Próximas reuniones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {events === null ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground">
            No hay reuniones próximas. Conectá tu Calendar desde{" "}
            <a href="/mi-perfil" className="underline">
              Mi perfil
            </a>
            .
          </p>
        ) : (
          events.slice(0, 6).map((e) => (
            <div key={`${e.source_email}-${e.id}`} className="rounded-md border p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium leading-tight">{e.summary}</div>
                {e.htmlLink && (
                  <a
                    href={e.htmlLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatWhen(e.start)} · {e.source_label}
              </div>
              {(e.hangoutLink || e.location) && (
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {e.hangoutLink && (
                    <a
                      href={e.hangoutLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-primary hover:bg-primary/20"
                    >
                      <Video className="h-3 w-3" /> Meet
                    </a>
                  )}
                  {e.location && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {e.location}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
