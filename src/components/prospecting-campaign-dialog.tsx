"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Sparkles } from "lucide-react";
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

interface SectorSuggestion {
  rubro: string;
  ubicacion: string | null;
  angulo: string | null;
  por_que: string | null;
}

export function ProspectingCampaignDialog({
  mode,
  campaign,
  services,
  trigger,
  canSuggest = false,
}: {
  mode: "create" | "edit";
  campaign?: CampaignFormValue;
  services: { slug: string; name: string }[];
  trigger?: React.ReactNode;
  /**
   * Muestra "Sugerir con IA". Abierto a todo el equipo de prospección desde
   * agosto 2026: es la llamada más barata (Haiku, sin búsqueda web) y es la que
   * necesita quien está armando la campaña. Las caras siguen con permiso.
   */
  canSuggest?: boolean;
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
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SectorSuggestion[]>([]);

  async function pedirSugerencias() {
    setSuggesting(true);
    try {
      const res = await fetch("/api/prospeccion/suggest-sectors", { method: "POST" });
      const data = (await res.json()) as { sugerencias?: SectorSuggestion[]; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo sugerir.");
        return;
      }
      setSuggestions(data.sugerencias ?? []);
      if ((data.sugerencias ?? []).length === 0) toast.info("No hubo sugerencias.");
    } catch {
      toast.error("Error de red al sugerir.");
    } finally {
      setSuggesting(false);
    }
  }

  function aplicarSugerencia(s: SectorSuggestion) {
    setRubro(s.rubro);
    if (s.ubicacion) setUbicacion(s.ubicacion);
    if (s.angulo) setAngulo(s.angulo);
    if (!nombre.trim()) {
      const zona = s.ubicacion ? ` ${s.ubicacion.split(",")[0]}` : "";
      setNombre(`${s.rubro}${zona}`.slice(0, 80));
    }
    setSuggestions([]);
  }

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
      if (mode === "create" && "id" in res) router.push(`/prospeccion/${res.id}?nuevo=1`);
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

        {mode === "create" && canSuggest && (
          <div className="rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                ¿No sabés qué sector atacar? La IA mira tus clientes actuales y te
                sugiere nichos.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={pedirSugerencias}
                disabled={suggesting}
              >
                {suggesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Sugerir con IA
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-3 grid gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => aplicarSugerencia(s)}
                    className="rounded-md border bg-card px-3 py-2 text-left text-sm hover:border-primary hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.rubro}</span>
                      {s.ubicacion && (
                        <span className="text-xs text-muted-foreground">{s.ubicacion}</span>
                      )}
                    </div>
                    {s.por_que && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.por_que}</p>
                    )}
                  </button>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Tocá una para cargarla en el formulario. Podés editarla antes de crear.
                </p>
              </div>
            )}
          </div>
        )}

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
