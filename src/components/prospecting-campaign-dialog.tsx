"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROSPECTING_CHANNELS, PROSPECTING_LANGS } from "@/lib/prospecting/shared";
import {
  createCampaign,
  updateCampaign,
  type CampaignInput,
} from "@/app/(app)/prospeccion/actions";

const NONE = "__none__";

export interface CampaignFormValue {
  id?: string;
  nombre: string;
  rubro: string;
  ubicacion: string | null;
  servicio: string | null;
  angulo: string | null;
  canal: string;
  idioma: string;
}

export function ProspectingCampaignDialog({
  mode,
  campaign,
  services,
  trigger,
}: {
  mode: "create" | "edit";
  campaign?: CampaignFormValue;
  services: { slug: string; name: string }[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState(campaign?.nombre ?? "");
  const [rubro, setRubro] = useState(campaign?.rubro ?? "");
  const [ubicacion, setUbicacion] = useState(campaign?.ubicacion ?? "");
  const [servicio, setServicio] = useState(campaign?.servicio ?? NONE);
  const [angulo, setAngulo] = useState(campaign?.angulo ?? "");
  const [canal, setCanal] = useState(campaign?.canal ?? "whatsapp");
  const [idioma, setIdioma] = useState(campaign?.idioma ?? "es_ar");

  function submit() {
    if (!nombre.trim()) return void toast.error("Poné un nombre a la campaña.");
    if (!rubro.trim()) return void toast.error("Poné el rubro objetivo.");
    const payload: CampaignInput = {
      nombre,
      rubro,
      ubicacion: ubicacion || null,
      servicio: servicio === NONE ? null : servicio,
      angulo: angulo || null,
      canal,
      idioma,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createCampaign(payload)
          : await updateCampaign(campaign!.id!, payload);
      if ("error" in res) return void toast.error(res.error);
      toast.success(mode === "create" ? "Campaña creada" : "Campaña actualizada");
      setOpen(false);
      if (mode === "create" && "id" in res) router.push(`/prospeccion/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (mode === "create" ? (
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nueva campaña
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva campaña de prospección" : "Editar campaña"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Una campaña es un <b>cluster</b>: un rubro homogéneo en una zona. Cuanto
          más afilado, mejores leads y mensajes. Ej: <i>gimnasios premium de Córdoba</i>.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Nombre de la campaña *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Gimnasios premium Córdoba"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Rubro / nicho *</Label>
              <Input
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                placeholder="Ej: gimnasios y boxes de crossfit"
              />
            </div>
            <div>
              <Label>Zona objetivo</Label>
              <Input
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Córdoba, Argentina"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Servicio a ofrecer</Label>
              <Select value={servicio} onValueChange={setServicio}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin definir</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Canal de contacto</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECTING_CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Ángulo / qué resolvemos</Label>
            <Textarea
              rows={2}
              value={angulo}
              onChange={(e) => setAngulo(e.target.value)}
              placeholder="Ej: tienen buena marca pero el Instagram está abandonado y no hacen pauta; les traemos socios nuevos con contenido + ads."
            />
          </div>
          <div>
            <Label>Idioma del mensaje</Label>
            <Select value={idioma} onValueChange={setIdioma}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROSPECTING_LANGS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Crear campaña" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
