"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteService } from "@/app/(app)/agencia/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceDialog, type ServiceInit } from "@/components/service-dialog";

export function ServicesManager({
  services,
  canEdit,
}: {
  services: ServiceInit[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

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
            Lo que JD Media le ofrece a sus clientes. Estos servicios se usan
            en el form de cada cliente para definir qué tiene contratado.
          </p>
        </div>
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
      </CardHeader>
      <CardContent>
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
