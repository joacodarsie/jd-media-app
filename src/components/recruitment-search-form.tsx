"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSearch, updateSearch } from "@/app/(app)/reclutamiento/actions";

export const AREA_OPTIONS = [
  { value: "cm", label: "Community Manager" },
  { value: "diseno", label: "Diseño" },
  { value: "edicion", label: "Edición audiovisual" },
  { value: "pauta", label: "Pauta / Paid Media" },
  { value: "desarrollo", label: "Desarrollo web" },
  { value: "comercial", label: "Comercial / Ventas" },
  { value: "otro", label: "Otro" },
];

export function RecruitmentSearchForm({
  mode = "create",
  search,
  areaProfiles = {},
  trigger,
}: {
  mode?: "create" | "edit";
  search?: {
    id: string;
    titulo: string;
    area: string | null;
    perfil: string | null;
    ubicacion_pref: string | null;
  };
  /** Perfil auto del área (de los puestos de la agencia), por valor de área. */
  areaProfiles?: Record<string, string>;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [titulo, setTitulo] = useState(search?.titulo ?? "");
  const [area, setArea] = useState(search?.area ?? "");
  const [perfil, setPerfil] = useState(search?.perfil ?? "");
  const [ubic, setUbic] = useState(search?.ubicacion_pref ?? "Córdoba Capital");
  // Qué área autocompletó el perfil actual (para poder reemplazarlo al cambiar
  // de área, pero sin pisar lo que el usuario escribió a mano).
  const [autoArea, setAutoArea] = useState<string | null>(null);

  function onAreaChange(v: string) {
    setArea(v);
    const prof = areaProfiles[v];
    const perfilEsAuto = perfil.trim() === "" || (autoArea && perfil === areaProfiles[autoArea]);
    if (prof && perfilEsAuto) {
      setPerfil(prof);
      setAutoArea(v);
    }
  }

  function submit() {
    if (!titulo.trim()) return void toast.error("Poné un título.");
    start(async () => {
      const input = {
        titulo,
        area: area || null,
        perfil: perfil || null,
        ubicacion_pref: ubic || null,
      };
      const res =
        mode === "edit" && search
          ? await updateSearch(search.id, input)
          : await createSearch(input);
      if ("error" in res) return void toast.error(res.error);
      toast.success(mode === "edit" ? "Búsqueda actualizada." : "Búsqueda creada.");
      setOpen(false);
      if ("id" in res) router.push(`/reclutamiento/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nueva búsqueda
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar búsqueda" : "Nueva búsqueda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título del puesto</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Editor/a audiovisual"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Área</Label>
              <Select value={area} onValueChange={onAreaChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí" />
                </SelectTrigger>
                <SelectContent>
                  {AREA_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ubicación preferida</Label>
              <Input value={ubic} onChange={(e) => setUbic(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Perfil buscado (opcional)</Label>
            <Textarea
              value={perfil}
              onChange={(e) => {
                setPerfil(e.target.value);
                setAutoArea(null);
              }}
              rows={5}
              placeholder="Elegí un área y se completa solo con el perfil del puesto (qué hace, qué incluye/excluye, KPIs). Editalo si querés sumar algo puntual (herramientas, disponibilidad, etc.)."
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {autoArea
                ? "✨ Completado con el perfil del área (de tus Procesos). Editalo o dejalo así — la IA lo usa para puntuar la aptitud."
                : "Si lo dejás vacío, la IA usa el perfil del área para puntuar."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Guardar" : "Crear y cargar CVs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
