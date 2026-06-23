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
  FACTURACION_LABEL,
  PACK_DEFAULTS,
  SERVICE_BILLING_DEFAULT,
  SERVICE_TYPE_LABEL,
  type Facturacion,
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

type UserLite = { id: string; nombre: string };

export function ClientServicesEditor({
  clienteId,
  services,
  users = [],
  canEdit = false,
}: {
  clienteId: string;
  services: ClientService[];
  users?: UserLite[];
  canEdit?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Servicios contratados</h4>
        {canEdit && (
          <ServiceDialog
            clienteId={clienteId}
            mode="create"
            users={users}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-3 w-3" /> Agregar servicio
              </Button>
            }
          />
        )}
      </div>

      {services.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          Aún no hay servicios cargados.
        </p>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} clienteId={clienteId} users={users} canEdit={canEdit} />
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
  users,
  canEdit,
}: {
  service: ClientService;
  clienteId: string;
  users: UserLite[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const detalle = service.pack_detalle ?? {};
  const responsables = (service as { responsables?: string[] }).responsables ?? [];
  const responsablesNombres = responsables
    .map((id) => users.find((u) => u.id === id)?.nombre)
    .filter(Boolean) as string[];

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
                {Number(service.monto_mensual).toLocaleString("es-AR")}{" "}
                {service.facturacion === "unico" ? "(único)" : "/ mes"}
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
          {responsablesNombres.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-muted-foreground">Lo lleva:</span>
              {responsablesNombres.map((n) => (
                <span key={n} className="rounded-full bg-primary/10 px-2 py-0.5 font-medium">
                  {n}
                </span>
              ))}
            </div>
          )}
          {service.notas && (
            <div className="mt-1 text-xs text-muted-foreground">{service.notas}</div>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <ServiceDialog
              clienteId={clienteId}
              service={service}
              mode="edit"
              users={users}
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
        )}
      </div>
    </div>
  );
}

function ServiceDialog({
  clienteId,
  service,
  mode,
  trigger,
  users,
}: {
  clienteId: string;
  service?: ClientService;
  mode: "create" | "edit";
  trigger: React.ReactNode;
  users: UserLite[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [tipo, setTipo] = useState<string>(service?.tipo ?? "gestion_redes");
  const [responsables, setResponsables] = useState<string[]>(
    (service as { responsables?: string[] } | undefined)?.responsables ?? []
  );

  function toggleResponsable(id: string) {
    setResponsables((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  const [pack, setPack] = useState<string>(service?.pack ?? "Presencia");
  const [fechaInicio, setFechaInicio] = useState(service?.fecha_inicio ?? "");
  const [fechaFin, setFechaFin] = useState(service?.fecha_fin ?? "");
  const [monto, setMonto] = useState<string>(
    service?.monto_mensual != null ? String(service.monto_mensual) : ""
  );
  const [facturacion, setFacturacion] = useState<Facturacion>(
    (service?.facturacion as Facturacion | undefined) ??
      SERVICE_BILLING_DEFAULT[service?.tipo ?? "gestion_redes"] ??
      "mensual"
  );
  function changeTipo(v: string) {
    setTipo(v);
    // Al cambiar de servicio en un alta, ajustamos la facturación por defecto.
    if (mode === "create") setFacturacion(SERVICE_BILLING_DEFAULT[v] ?? "mensual");
  }
  const [moneda, setMoneda] = useState(service?.moneda ?? "ARS");
  const [notas, setNotas] = useState(service?.notas ?? "");
  const [activo, setActivo] = useState(service?.activo ?? true);
  // ¿La gestión de redes incluye Paid Media? Si no, no se paga media buyer y
  // ese monto queda como ganancia de la agencia.
  const [mediaBuyerAplica, setMediaBuyerAplica] = useState<boolean>(
    (service as { media_buyer_aplica?: boolean | null } | undefined)?.media_buyer_aplica ?? true
  );

  // Costo de entrega (servicios que no son gestión de redes): % del monto o fijo.
  const svcCost = service as
    | { costo_pct?: number | null; costo_override?: number | null; costo_override_user?: string | null }
    | undefined;
  const [costoModo, setCostoModo] = useState<"pct" | "fijo">(
    svcCost?.costo_override != null ? "fijo" : "pct"
  );
  const [costoPct, setCostoPct] = useState<string>(
    svcCost?.costo_pct != null ? String(Math.round(Number(svcCost.costo_pct) * 100)) : ""
  );
  const [costoFijo, setCostoFijo] = useState<string>(
    svcCost?.costo_override != null ? String(svcCost.costo_override) : ""
  );
  const [costoUser, setCostoUser] = useState<string>(svcCost?.costo_override_user ?? "");

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
      facturacion,
      notas,
      activo,
      responsables,
      media_buyer_aplica: isRedes ? mediaBuyerAplica : true,
      // Costo de entrega: solo para servicios que no son gestión de redes.
      costo_override:
        !isRedes && costoModo === "fijo" && costoFijo !== "" ? Number(costoFijo) : null,
      costo_pct:
        !isRedes && costoModo === "pct" && costoPct !== "" ? Number(costoPct) / 100 : null,
      costo_override_user: !isRedes ? costoUser || null : null,
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
            <Select value={tipo} onValueChange={changeTipo}>
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
                    {Object.entries(CLIENT_PACK_LABEL).map(([v, l]) => (
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
              <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
                <input
                  type="checkbox"
                  checked={mediaBuyerAplica}
                  onChange={(e) => setMediaBuyerAplica(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  <span className="font-medium">Incluye Paid Media</span> (gestión de
                  campañas de Meta)
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Si lo destildás, no se paga el media buyer de esta cuenta y ese
                    monto queda como ganancia de la agencia.
                  </span>
                </span>
              </label>
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Facturación</Label>
              <Select
                value={facturacion}
                onValueChange={(v) => setFacturacion(v as Facturacion)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FACTURACION_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {facturacion === "unico" ? "Monto del cobro único" : "Monto mensual"}
              </Label>
              <Input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
          </div>

          {tipo !== "gestion_redes" && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <Label>Costo de entrega</Label>
              <p className="text-xs text-muted-foreground">
                Cuánto te cuesta este servicio y a quién se lo pagás. Para
                revenue-share usá un % del monto (ej: branding 50% para quien lo
                hace); o un monto fijo.
              </p>
              <div className="flex gap-2">
                {(["pct", "fijo"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCostoModo(m)}
                    className={
                      costoModo === m
                        ? "flex-1 rounded-md border border-primary bg-primary/10 px-3 py-1.5 text-sm"
                        : "flex-1 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                    }
                  >
                    {m === "pct" ? "% del monto" : "Monto fijo"}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {costoModo === "pct" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">% para quien entrega</Label>
                    <Input
                      type="number"
                      value={costoPct}
                      onChange={(e) => setCostoPct(e.target.value)}
                      placeholder="ej: 50"
                    />
                    {costoPct !== "" && monto !== "" && (
                      <p className="text-[11px] text-muted-foreground">
                        = {moneda}{" "}
                        {Math.round((Number(monto) * Number(costoPct)) / 100).toLocaleString("es-AR")}{" "}
                        de costo
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">Monto fijo de costo</Label>
                    <Input
                      type="number"
                      value={costoFijo}
                      onChange={(e) => setCostoFijo(e.target.value)}
                      placeholder="$"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Se le paga a</Label>
                  <Select value={costoUser || "none"} onValueChange={(v) => setCostoUser(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin asignar —</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
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
            <Label>Quién lleva este servicio</Label>
            <p className="text-xs text-muted-foreground">
              Marcá las personas asignadas. Al guardar, a los que sumes les llega
              una notificación.
            </p>
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay usuarios disponibles.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {users.map((u) => {
                  const active = responsables.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleResponsable(u.id)}
                      className={
                        active
                          ? "rounded-full border border-primary bg-primary/15 px-3 py-1 text-xs font-medium"
                          : "rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                      }
                    >
                      {u.nombre}
                    </button>
                  );
                })}
              </div>
            )}
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
