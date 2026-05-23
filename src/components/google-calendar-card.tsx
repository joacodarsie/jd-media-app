"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Connection {
  id: string;
  owner_user_id: string;
  label: string;
  visibility: "private" | "shared";
  google_email: string;
}

export function GoogleCalendarCard({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/google/connections");
      const json = await res.json();
      setConnections(json.connections ?? []);
    } catch {
      toast.error("No se pudieron cargar las conexiones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const msg = searchParams.get("calendar");
    if (!msg) return;
    if (msg.startsWith("ok:")) toast.success(`Calendar conectado: ${msg.slice(3)}`);
    else if (msg.startsWith("error:")) toast.error(`Error: ${msg.slice(6)}`);
    router.replace("/mi-perfil");
  }, [searchParams, router]);

  function connect(visibility: "private" | "shared", label: string) {
    const url = `/api/google/auth?visibility=${visibility}&label=${encodeURIComponent(label)}`;
    window.location.href = url;
  }

  function disconnect(id: string) {
    if (!confirm("¿Desconectar este Calendar?")) return;
    start(async () => {
      const res = await fetch(`/api/google/connections?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("No se pudo desconectar");
        return;
      }
      toast.success("Desconectado");
      load();
    });
  }

  const mine = connections.filter((c) => c.owner_user_id === userId);
  const shared = connections.filter(
    (c) => c.visibility === "shared" && c.owner_user_id !== userId
  );

  const hasPersonal = mine.some((c) => c.visibility === "private");
  const hasShared = connections.some((c) => c.visibility === "shared");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" /> Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            {connections.length === 0 && (
              <p className="text-muted-foreground">
                No tenés Calendars conectados. Conectá uno para ver tus próximas reuniones en la app.
              </p>
            )}

            {mine.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div>
                  <div className="font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.google_email} · {c.visibility === "shared" ? "Compartido" : "Privado"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnect(c.id)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {shared.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div>
                  <div className="font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.google_email} · Compartido por el equipo
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-1">
              {!hasPersonal && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => connect("private", "Mi Calendar")}
                >
                  <Plus className="mr-1 h-4 w-4" /> Conectar mi Calendar personal
                </Button>
              )}
              {isAdmin && !hasShared && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => connect("shared", "JD Media")}
                >
                  <Plus className="mr-1 h-4 w-4" /> Conectar Calendar de JD Media
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
