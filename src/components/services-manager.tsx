"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { deleteService } from "@/app/(app)/agencia/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceDialog, type ServiceInit } from "@/components/service-dialog";
import { cn } from "@/lib/utils";

/** "hace 2 horas", "hace 3 días" — para el estado de la sincronización. */
function fmtHace(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 2) return "recién";
  if (min < 60) return `hace ${min} minutos`;
  const hs = Math.round(min / 60);
  if (hs < 24) return `hace ${hs} ${hs === 1 ? "hora" : "horas"}`;
  const d = Math.round(hs / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

export function ServicesManager({
  services,
  canEdit,
  syncAt,
  sinEnWeb,
}: {
  services: ServiceInit[];
  canEdit: boolean;
  /** Última vez que se comparó el catálogo con jdmedia.com.ar. */
  syncAt?: string | null;
  /** Servicios que están en la app pero ya no en la web (se marcan, no se borran). */
  sinEnWeb?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  async function sincronizar() {
    setSincronizando(true);
    try {
      const res = await fetch("/api/cron/sync-servicios-web");
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        detectados?: number;
        creados?: number;
        actualizados?: number;
        cambios?: string[];
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo sincronizar.");
      const cambios = json.cambios ?? [];
      if (cambios.length === 0) {
        toast.success(`Ya estaba al día (${json.detectados} servicios en la web).`);
      } else {
        toast.success(cambios.slice(0, 3).join(" · "), {
          description:
            cambios.length > 3 ? `y ${cambios.length - 3} cambios más` : undefined,
        });
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo sincronizar.");
    } finally {
      setSincronizando(false);
    }
  }

  function handleDelete(slug: string, name: string) {
    if (
      !confirm(
        `¿Borrar "${name}"?\n\nOJO: si este servicio ya está vinculado a algún cliente en /clientes/[id], no se va a poder borrar. En ese caso, lo mejor es marcarlo como inactivo.`
      )
    ) {
      return;
    }
    setDeletingSlug(slug);
    start(async () => {
      const res = await deleteService(slug);
      setDeletingSlug(null);
      if (res?.error) {
        toast.error("No se pudo borrar: " + res.error);
        return;
      }
      toast.success("Borrado");
      router.refresh();
    });
  }

  const nextOrden = (services[services.length - 1]?.orden ?? 0) + 10;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Servicios de la agencia</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Lo que JD Media le ofrece a sus clientes. Se sincroniza solo con{" "}
            <a
              href="https://jdmedia.com.ar"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              jdmedia.com.ar
            </a>{" "}
            todos los días: lo que cambie en la web aparece acá. También define
            qué tiene contratado cada cliente y qué le ofrece la IA a un prospecto.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {syncAt
              ? `Sincronizado con la web ${fmtHace(syncAt)}.`
              : "Todavía no se sincronizó con la web."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={sincronizar}
              disabled={sincronizando || pending}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", sincronizando && "animate-spin")}
              />
              Sincronizar ahora
            </Button>
          )}
          {canEdit && (
            <ServiceDialog
              mode="create"
              defaultOrden={nextOrden}
              trigger={
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo
                </Button>
              }
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* La sincronización NUNCA borra: si un servicio dejó de estar en la
            web lo avisa acá, porque borrarlo dejaría clientes con un servicio
            contratado que no existe. La decisión es del dueño. */}
        {sinEnWeb && sinEnWeb.length > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-medium">
                {sinEnWeb.length === 1
                  ? "Un servicio ya no aparece en la web"
                  : `${sinEnWeb.length} servicios ya no aparecen en la web`}
              </span>{" "}
              ({sinEnWeb.join(", ")}). No los tocamos por las dudas: si alguno lo
              tiene contratado un cliente, borrarlo rompería su ficha. Si ya no lo
              vendés, borralo vos con la papelera.
            </div>
          </div>
        )}
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay servicios cargados.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <li
                key={s.slug}
                className="rounded-lg border bg-card p-3"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: s.color || undefined,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      {!s.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
                        {s.description}
                      </p>
                    )}
                    {s.areas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.areas.map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px]"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <ServiceDialog
                        mode="edit"
                        service={s}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={pending && deletingSlug === s.slug}
                        onClick={() => handleDelete(s.slug, s.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
