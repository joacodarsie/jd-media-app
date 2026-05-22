"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ExternalLink, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  deletePublication,
} from "@/app/(app)/contenidos/actions";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_STATUS_BADGE,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_TYPE_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AppUser, PublicationWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown";
import { PublicationStatusSelect } from "@/components/publication-status-select";
import {
  PublicationFormDialog,
  type ClientForPub,
} from "@/components/publication-form-dialog";

export function PublicationDetailDialog({
  publication,
  clients,
  users,
  trigger,
}: {
  publication: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const p = publication;

  function onDelete() {
    if (!confirm("¿Eliminar esta publicación?")) return;
    start(async () => {
      const res = await deletePublication(p.id);
      if (res?.error) {
        toast.error("No se pudo eliminar: " + res.error);
        return;
      }
      toast.success("Publicación eliminada");
      setOpen(false);
      router.refresh();
    });
  }

  const fecha = p.fecha_publicacion
    ? new Date(p.fecha_publicacion).toLocaleString("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sin fecha";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span>{p.titulo}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                PUBLICATION_STATUS_BADGE[p.estado]
              )}
            >
              {PUBLICATION_STATUS_LABEL[p.estado]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {fecha}
            </span>
            <span>{PUBLICATION_NETWORK_LABEL[p.red]}</span>
            <span>{PUBLICATION_TYPE_LABEL[p.tipo]}</span>
            {p.cliente && <span>· {p.cliente.nombre}</span>}
            {p.creador && <span>· creó {p.creador.nombre}</span>}
            {p.audiovisual && <span>· asignado {p.audiovisual.nombre}</span>}
          </div>

          {p.guion && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
              <h4 className="mb-1 font-semibold text-indigo-900 dark:text-indigo-200">Guion</h4>
              <Markdown>{p.guion}</Markdown>
            </div>
          )}

          {p.descripcion && (
            <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
              <h4 className="mb-1 font-semibold text-blue-900 dark:text-blue-200">Descripción de la idea</h4>
              <Markdown>{p.descripcion}</Markdown>
            </div>
          )}

          {p.copy && (
            <div>
              <h4 className="mb-1 font-semibold">Copy del post</h4>
              <Markdown>{p.copy}</Markdown>
            </div>
          )}

          {p.hashtags && (
            <div className="text-xs text-muted-foreground">{p.hashtags}</div>
          )}

          <div className="flex flex-wrap gap-2">
            {p.asset_url && (
              <a
                href={p.asset_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded border bg-muted/30 px-2 py-1 text-xs hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> Asset
              </a>
            )}
            {p.referencia_url && (
              <a
                href={p.referencia_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded border bg-muted/30 px-2 py-1 text-xs hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> Referencia
              </a>
            )}
            {(p as unknown as { publicacion_url?: string | null }).publicacion_url && (
              <a
                href={(p as unknown as { publicacion_url: string }).publicacion_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                <ExternalLink className="h-3 w-3" /> Publicación final
              </a>
            )}
            {(p as unknown as { resubido_tiktok?: boolean }).resubido_tiktok && (
              <span className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                ✓ Resubido a TikTok
              </span>
            )}
          </div>

          {p.notas_revision && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
              <h4 className="mb-1 font-semibold text-amber-900 dark:text-amber-200">
                Notas de revisión
              </h4>
              <p className="whitespace-pre-line text-amber-900 dark:text-amber-200">
                {p.notas_revision}
              </p>
            </div>
          )}

          <div className="border-t pt-3">
            <h4 className="mb-2 text-sm font-semibold">Estado</h4>
            <PublicationStatusSelect publication={p} size="md" />
          </div>

          <div className="flex items-center gap-2 border-t pt-3">
            <PublicationFormDialog
              mode="edit"
              publication={p}
              clients={clients}
              users={users}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={pending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
