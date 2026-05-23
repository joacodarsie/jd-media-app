"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertService } from "@/app/(app)/agencia/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ServiceInit {
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  areas: string[];
  orden: number;
  active: boolean;
}

export function ServiceDialog({
  mode,
  service,
  defaultOrden,
  trigger,
}: {
  mode: "create" | "edit";
  service?: ServiceInit;
  defaultOrden?: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const original = service?.slug;

  const [slug, setSlug] = useState(service?.slug ?? "");
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [color, setColor] = useState(service?.color ?? "#FFD400");
  const [icon, setIcon] = useState(service?.icon ?? "Sparkles");
  const [areas, setAreas] = useState((service?.areas ?? []).join(", "));
  const [orden, setOrden] = useState<number>(
    service?.orden ?? defaultOrden ?? 100
  );
  const [active, setActive] = useState<boolean>(service?.active ?? true);

  function submit() {
    if (!name.trim()) {
      toast.error("Falta nombre.");
      return;
    }
    start(async () => {
      const res = await upsertService({
        slug: slug || name,
        originalSlug: original,
        name,
        description,
        color,
        icon,
        areas: areas
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        orden,
        active,
      });
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Guardado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo servicio" : "Editar servicio"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Gestión de redes"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Qué incluye este servicio…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Áreas / Puestos que participan</Label>
              <Input
                value={areas}
                onChange={(e) => setAreas(e.target.value)}
                placeholder="Community Manager, Diseño Gráfico, Edición Audiovisual"
              />
              <p className="text-xs text-muted-foreground">
                Separados por coma. Después en la Tanda C los vamos a vincular
                a los puestos reales del equipo.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#FFD400"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={orden}
                onChange={(e) => setOrden(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Slug (interno)</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Se autogenera del nombre"
              />
              <p className="text-xs text-muted-foreground">
                Identificador interno. Si ya está en uso por client_services,
                no lo cambies.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="svc-active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="svc-active" className="cursor-pointer">
                Activo (visible para contratar)
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
