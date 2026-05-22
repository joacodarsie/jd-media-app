"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertQuickLink } from "@/app/(app)/agencia/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QUICK_LINK_ICONS } from "@/lib/quick-link-icons";

interface QuickLinkInit {
  id?: string;
  label: string;
  url: string;
  icon: string | null;
  orden: number;
}

export function QuickLinkDialog({
  mode,
  link,
  defaultOrden,
  trigger,
}: {
  mode: "create" | "edit";
  link?: QuickLinkInit;
  defaultOrden?: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [label, setLabel] = useState(link?.label ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [icon, setIcon] = useState<string>(link?.icon ?? "Link");
  const [orden, setOrden] = useState<number>(link?.orden ?? defaultOrden ?? 100);

  function submit() {
    if (!label.trim() || !url.trim()) {
      toast.error("Falta nombre o URL.");
      return;
    }
    start(async () => {
      const res = await upsertQuickLink({
        id: link?.id,
        label,
        url,
        icon,
        orden,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo acceso rápido" : "Editar acceso rápido"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Drive JD Media"
            />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Ícono</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUICK_LINK_ICONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={orden}
                onChange={(e) => setOrden(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Los accesos se muestran ordenados de menor a mayor. Tip: usá 10, 20,
            30… para poder intercalar después.
          </p>
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
