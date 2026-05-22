"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteQuickLink } from "@/app/(app)/agencia/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickLinkDialog } from "@/components/quick-link-dialog";
import { iconFor } from "@/lib/quick-link-icons";

export interface QuickLinkRow {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  orden: number;
}

export function QuickLinksManager({
  links,
  canEdit,
}: {
  links: QuickLinkRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string, label: string) {
    if (!confirm(`¿Borrar el acceso "${label}"?`)) return;
    setDeletingId(id);
    start(async () => {
      const res = await deleteQuickLink(id);
      setDeletingId(null);
      if (res?.error) {
        toast.error("No se pudo borrar: " + res.error);
        return;
      }
      toast.success("Borrado");
      router.refresh();
    });
  }

  const nextOrden = (links[links.length - 1]?.orden ?? 0) + 10;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Accesos rápidos</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Links que el equipo usa día a día. Aparecen en el menú del header.
          </p>
        </div>
        {canEdit && (
          <QuickLinkDialog
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
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay accesos cargados.
          </p>
        ) : (
          <ul className="divide-y">
            {links.map((l) => {
              const Icon = iconFor(l.icon);
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3 hover:text-foreground"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {l.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {l.url}
                      </span>
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1">
                      <QuickLinkDialog
                        mode="edit"
                        link={l}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={pending && deletingId === l.id}
                        onClick={() => handleDelete(l.id, l.label)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
