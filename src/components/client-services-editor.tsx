"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createService,
  updateService,
  deleteService,
  type ServiceInput,
} from "@/app/(app)/clientes/services-actions";
import {
  CLIENT_PACK_LABEL,
  PACK_DEFAULTS,
  SERVICE_TYPE_LABEL,
} from "@/lib/constants";
import type { ClientService } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ServiceHistory } from "@/components/service-history";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClientServicesEditor({
  clienteId,
  services,
}: {
  clienteId: string;
  services: ClientService[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Servicios contratados</h4>
        <ServiceDialog
          clienteId={clienteId}
          mode="create"
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="mr-1 h-3 w-3" /> Agregar servicio
            </Button>
          }
        />
      </div>

      {services.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          Aún no hay servicios cargados.
        </p>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} clienteId={clienteId} />
          ))}
        </div>
      )}

      <div className="pt-1">
        <ServiceHistory clienteId={clienteId} />
      </div>
    </div>
  );
}

function ServiceRow({
  service,
  clienteId,
}: {
  service: ClientService;
  clienteId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const detalle = service.pack_detalle ?? {};

  function onDelete() {
    if (!confirm("¿Eliminar este servicio?")) return;
    start(async () => {
      const res = await deleteService(service.id, clienteId);
      if (res?.error) {
        toast.error("No se pudo eliminar: " + res.error);
        return;
      }
      toast.success("Servicio eliminado");
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{SERVICE_TYPE_LABEL[service.tipo]}</span>
            {service.pack && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium">
                {service.pack}
              </span>
            )}
            {!service.activo && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Pausado
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {service.monto_mensual != null && (
              <span>
                {service.moneda}{" "}
                {Number(service.monto_mensual).toLocaleString("es-AR")} / mes
              </span>
            )}
            {service.fecha_inicio && (
              <span> · desde {service.fecha_inicio}</span>
            )}
            {service.fecha_fin && (
              <span> · hasta {service.fecha_fin}</span>
            )}
          </div>
          {service.tipo === "gestion_redes" && Object.keys(detalle).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {detalle.posts !== undefined && (
                <span className="rounded bg-muted px-2 py-0.5">
                  {detalle.posts} posteos/mes
                </span>
              )}
              {detalle.historias_dias !== undefined && (
                <span className="rounded bg-muted px-2 py-0.5">
                  {detalle.historias_dias} días de historias
                </span>
              )}
              {detalle.reels !== undefined && (
                <span className="rounded bg-muted px-2 py-0.5">
                  {detalle.reels} reels/mes
                </span>
              )}
            </div>
          )}
          {service.notas && (
            <div className="mt-1 text-xs text-muted-foreground">{service.notas}</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ServiceDialog
            clienteId={clienteId}
            service={service}
            mode="edit"
            trigger={
              <Button variant="ghost" size="icon">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={pending}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServiceDialog({
  clienteId,
  service,
  mode,
  trigger,
}: {
  clienteId: string;
  service?: ClientService;
  mode: "create" | "edit";
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [tipo, setTipo] = useState<string>(service?.tipo ?? "gestion_redes");
  const [pack, setPack] = useState<string>(service?.pack ?? "Presencia");
  const [fechaInicio, setFechaInicio] = useState(service?.fecha_inicio ?? "");
  const [fechaFin, setFechaFin] = useState(service?.fecha_fin ?? "");
  const [monto, setMonto] = useState<string>(
    service?.monto_mensual != null ? String(service.monto_mensual) : ""
  );
  const [moneda, setMoneda] = useState(service?.moneda ?? "ARS");
  const [notas, setNotas] = useState(service?.notas ?? "");
  const [activo, setActivo] = useState(service?.activo ?? true);

  const initialDet = service?.pack_detalle as
    | { posts?: number; historias_dias?: number; reels?: number }
    | undefined;
  const [posts, setPosts] = useState<string>(
    initialDet?.posts !== undefined ? String(initialDet.posts) : ""
  );
  const [historias, setHistorias] = useState<string>(
    initialDet?.historias_dias !== undefined
      ? String(initialDet.historias_dias)
      : ""
  );
  const [reels, setReels] = useState<string>(
    initialDet?.reels !== undefined ? String(initialDet.reels) : ""
  );

  function applyPackDefault(p: string) {
    const def = PACK_DEFAULTS[p];
    if (def) {
      setPosts(String(def.posts));
      setHistorias(String(def.historias_dias));
      setReels(String(def.reels));
    }
  }

  function submit() {
    const isRedes = tipo === "gestion_redes";
    const detalle: Record<string, number> = {};
    if (isRedes) {
      if (posts !== "") detalle.posts = Number(posts);
      if (historias !== "") detalle.historias_dias = Number(historias);
      if (reels !== "") detalle.reels = Number(reels);
    }

    const payload: ServiceInput = {
      cliente_id: clienteId,
      tipo,
      pack: isRedes ? pack : null,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      monto_mensual: monto ? Number(monto) : null,
      moneda,
      pack_detalle: detalle,
      notas,
      activo,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createService(payload)
          : await updateService(service!.id, payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Servicio guardado");
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
          <div className="space-y-2">
            <Label>Tipo de servicio</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SERVICE_TYPE_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === "gestion_redes" && (
            <>
              <div className="space-y-2">
                <Label>Pack contratado</Label>
                <Select
                  value={pack}
                  onValueChange={(v) => {
                    setPack(v);
                    applyPackDefault(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_PACK_LABEL)
                      .filter(([v]) => v !== "Escala")
                      .map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <h4 className="mb-2 text-sm font-semibold">
                  Cantidad mensual del pack
                </h4>
                <p className="mb-2 text-xs text-muted-foreground">
                  Lo que efectivamente se programa por mes (editable según acuerdo
                  real con el cliente).
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Posteos</Label>
                    <Input
                      type="number"
                      min={0}
                      value={posts}
                      onChange={(e) => setPosts(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Días de historias</Label>
                    <Input
                      type="number"
                      min={0}
                      value={historias}
                      onChange={(e) => setHistorias(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Reels</Label>
                    <Input
                      type="number"
                      min={0}
                      value={reels}
                      onChange={(e) => setReels(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Monto mensual</Label>
              <Input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={activo ? "activo" : "pausado"}
                onValueChange={(v) => setActivo(v === "activo")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="pausado">Pausado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={fechaInicio ? fechaInicio.slice(0, 10) : ""}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de finalización (opcional)</Label>
              <Input
                type="date"
                value={fechaFin ? fechaFin.slice(0, 10) : ""}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Aclaraciones, descuentos, condiciones particulares."
            />
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
