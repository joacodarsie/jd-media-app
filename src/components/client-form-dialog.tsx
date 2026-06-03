"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  createClientRow,
  updateClientRow,
  type ClientInput,
  type NewClientServiceInput,
} from "@/app/(app)/clientes/actions";
import {
  CLIENT_PACK_LABEL,
  CLIENT_STATUS_LABEL,
  FACTURACION_LABEL,
  PACK_DEFAULTS,
  SERVICE_BILLING_DEFAULT,
  SERVICE_TYPE_LABEL,
  type Facturacion,
} from "@/lib/constants";
import type { AppUser, Client } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

export function ClientFormDialog({
  mode,
  client,
  users,
  trigger,
}: {
  mode: "create" | "edit";
  client?: Client;
  users: Pick<AppUser, "id" | "nombre">[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [nombre, setNombre] = useState(client?.nombre ?? "");
  const [rubro, setRubro] = useState(client?.rubro ?? "");
  const [pack, setPack] = useState<string>(client?.pack ?? "Presencia");
  const [estado, setEstado] = useState<string>(client?.estado ?? "activo");
  const [creativa, setCreativa] = useState(client?.creativa_asignada_id ?? NONE);
  const [fechaInicio, setFechaInicio] = useState(client?.fecha_inicio ?? "");
  const [monto, setMonto] = useState<string>(
    client?.monto_mensual != null ? String(client.monto_mensual) : ""
  );
  const [driveUrl, setDriveUrl] = useState(client?.drive_url ?? "");
  const [igUrl, setIgUrl] = useState(client?.instagram_url ?? "");
  const [fbUrl, setFbUrl] = useState(client?.facebook_url ?? "");
  const [webUrl, setWebUrl] = useState(client?.web_url ?? "");
  const [cmId, setCmId] = useState<string>(client?.cm_id ?? NONE);
  const [disenadorId, setDisenadorId] = useState<string>(client?.disenador_id ?? NONE);
  const [audiovisualId, setAudiovisualId] = useState<string>(
    client?.audiovisual_id ?? NONE
  );
  const [contactoNombre, setContactoNombre] = useState(
    client?.contacto_nombre ?? ""
  );
  const [contactoDni, setContactoDni] = useState(client?.contacto_dni_cuit ?? "");
  const [contactoDomicilio, setContactoDomicilio] = useState(
    client?.contacto_domicilio ?? ""
  );
  const [contactoEmail, setContactoEmail] = useState(client?.contacto_email ?? "");
  const [contactoTel, setContactoTel] = useState(client?.contacto_telefono ?? "");
  const [notas, setNotas] = useState(client?.notas ?? "");

  // Servicios cargados desde el alta (solo modo create).
  type DraftService = {
    tipo: string;
    pack: string;
    monto: string;
    facturacion: Facturacion;
    responsables: string[];
  };
  const [draftServices, setDraftServices] = useState<DraftService[]>([]);

  function addService() {
    setDraftServices((prev) => [
      ...prev,
      {
        tipo: "gestion_redes",
        pack: "Presencia",
        monto: "",
        facturacion: SERVICE_BILLING_DEFAULT["gestion_redes"],
        responsables: [],
      },
    ]);
  }
  function updateService(i: number, patch: Partial<DraftService>) {
    setDraftServices((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const next = { ...s, ...patch };
        // Al cambiar de servicio, ajustamos la facturación por defecto del nuevo
        // tipo (salvo que el patch ya traiga una facturación explícita).
        if (patch.tipo && patch.facturacion === undefined) {
          next.facturacion = SERVICE_BILLING_DEFAULT[patch.tipo] ?? "mensual";
        }
        return next;
      })
    );
  }
  function removeService(i: number) {
    setDraftServices((prev) => prev.filter((_, idx) => idx !== i));
  }
  function toggleServiceResp(i: number, userId: string) {
    setDraftServices((prev) =>
      prev.map((s, idx) =>
        idx === i
          ? {
              ...s,
              responsables: s.responsables.includes(userId)
                ? s.responsables.filter((x) => x !== userId)
                : [...s.responsables, userId],
            }
          : s
      )
    );
  }

  function submit() {
    if (!nombre.trim()) {
      toast.error("Falta el nombre.");
      return;
    }
    // En alta, el pack y el monto del cliente se DERIVAN de los servicios
    // (única carga). En edición se conservan los del header (legacy).
    let derivedPack = pack;
    let derivedMonto: number | null = monto ? Number(monto) : null;
    if (mode === "create") {
      const redes = draftServices.find((s) => s.tipo === "gestion_redes");
      derivedPack = redes?.pack ?? "Personalizado";
      // El monto mensual del cliente = suma SOLO de los servicios recurrentes.
      // Los de cobro único no inflan el ingreso mensual.
      const total = draftServices
        .filter((s) => s.facturacion === "mensual")
        .reduce((acc, s) => acc + (s.monto ? Number(s.monto) || 0 : 0), 0);
      derivedMonto = total > 0 ? total : null;
    }
    const payload: ClientInput = {
      nombre,
      rubro,
      pack: derivedPack,
      estado,
      creativa_asignada_id: creativa === NONE ? null : creativa,
      fecha_inicio: fechaInicio || null,
      monto_mensual: derivedMonto,
      calendario_url: client?.calendario_url ?? null,
      drive_url: driveUrl,
      instagram_url: igUrl,
      facebook_url: fbUrl,
      web_url: webUrl,
      datos_facturacion: client?.datos_facturacion ?? null,
      notion_url: client?.notion_url ?? null,
      contacto_nombre: contactoNombre,
      contacto_dni_cuit: contactoDni,
      contacto_domicilio: contactoDomicilio,
      contacto_email: contactoEmail,
      contacto_telefono: contactoTel,
      notas,
      cm_id: cmId === NONE ? null : cmId,
      disenador_id: disenadorId === NONE ? null : disenadorId,
      audiovisual_id: audiovisualId === NONE ? null : audiovisualId,
    };
    const servicesPayload: NewClientServiceInput[] = draftServices
      .filter((s) => s.tipo)
      .map((s) => {
        const isRedes = s.tipo === "gestion_redes";
        const def = isRedes ? PACK_DEFAULTS[s.pack] : undefined;
        const pack_detalle: Record<string, number> = def
          ? {
              posts: def.posts,
              historias_dias: def.historias_dias,
              reels: def.reels,
            }
          : {};
        return {
          tipo: s.tipo,
          pack: isRedes ? s.pack : null,
          monto_mensual: s.monto ? Number(s.monto) : null,
          moneda: "ARS",
          pack_detalle,
          responsables: s.responsables,
          facturacion: s.facturacion,
        };
      });

    start(async () => {
      const res =
        mode === "create"
          ? await createClientRow(payload, servicesPayload)
          : await updateClientRow(client!.id, payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      const serviceWarning = (res as { serviceWarning?: string }).serviceWarning;
      if (mode === "create" && serviceWarning) {
        toast.warning(serviceWarning);
      } else {
        toast.success(mode === "create" ? "Cliente creado" : "Cliente actualizado");
      }
      setOpen(false);
      router.refresh();
      if (mode === "create" && res.ok && "id" in res) {
        router.push(`/clientes/${res.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo cliente" : "Editar cliente"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rubro</Label>
              <Input value={rubro} onChange={(e) => setRubro(e.target.value)} />
            </div>
            {mode === "edit" && (
              <div className="space-y-2">
                <Label>Pack</Label>
                <Select value={pack} onValueChange={setPack}>
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
            )}
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLIENT_STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={creativa} onValueChange={setCreativa}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input
                type="date"
                value={fechaInicio ? fechaInicio.slice(0, 10) : ""}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            {mode === "edit" && (
              <div className="space-y-2">
                <Label>Monto mensual (ARS)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Equipo asignado: solo aplica a Gestión de redes. En alta aparece
              recién cuando se carga ese servicio; en edición se mantiene. */}
          {(mode === "edit" ||
            draftServices.some((s) => s.tipo === "gestion_redes")) && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <h4 className="mb-2 text-sm font-semibold">Equipo asignado a esta cuenta</h4>
            <p className="mb-3 text-xs text-muted-foreground">
              Estas personas se sugieren automáticamente al crear publicaciones según el tipo de contenido.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Community Manager</Label>
                <Select value={cmId} onValueChange={setCmId}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin asignar</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Diseñador/a gráfico</Label>
                <Select value={disenadorId} onValueChange={setDisenadorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin asignar</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Editor/a audiovisual</Label>
                <Select value={audiovisualId} onValueChange={setAudiovisualId}>
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin asignar</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          )}

          <div className="rounded-lg border bg-muted/30 p-3">
            <h4 className="mb-1 text-sm font-semibold">Datos del contacto / facturación</h4>
            <p className="mb-3 text-xs text-muted-foreground">
              Se usan para generar la carta acuerdo. Lo que cargues acá se
              autocompleta en el onboarding.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre completo del contacto</Label>
                <Input
                  value={contactoNombre}
                  onChange={(e) => setContactoNombre(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>DNI o CUIT</Label>
                <Input
                  value={contactoDni}
                  onChange={(e) => setContactoDni(e.target.value)}
                  placeholder="Ej: 20-12345678-9"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Domicilio legal</Label>
                <Input
                  value={contactoDomicilio}
                  onChange={(e) => setContactoDomicilio(e.target.value)}
                  placeholder="Calle, número, ciudad, provincia"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={contactoEmail}
                  onChange={(e) => setContactoEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={contactoTel}
                  onChange={(e) => setContactoTel(e.target.value)}
                />
              </div>
            </div>
          </div>

          {mode === "create" && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Servicios contratados</h4>
                <Button type="button" size="sm" variant="outline" onClick={addService}>
                  <Plus className="mr-1 h-3 w-3" /> Agregar servicio
                </Button>
              </div>
              <p className="mb-3 mt-1 text-xs text-muted-foreground">
                Elegí el servicio y, según cuál sea, se abre el desglose (el pack
                solo aparece en Gestión de redes). El <b>pack y el monto del
                cliente salen de acá</b> — no hace falta cargarlos dos veces. A los
                responsables que marques les llega una notificación.
              </p>
              {draftServices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin servicios todavía. Podés agregarlos ahora o después desde la ficha.
                </p>
              ) : (
                <div className="space-y-3">
                  {draftServices.map((s, i) => {
                    const isRedes = s.tipo === "gestion_redes";
                    return (
                      <div key={i} className="rounded-md border bg-card p-3">
                        <div className="flex items-start gap-2">
                          <div className="grid flex-1 gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Servicio</Label>
                              <Select
                                value={s.tipo}
                                onValueChange={(v) => updateService(i, { tipo: v })}
                              >
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
                            {isRedes && (
                              <div className="space-y-1">
                                <Label className="text-xs">Pack</Label>
                                <Select
                                  value={s.pack}
                                  onValueChange={(v) => updateService(i, { pack: v })}
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
                            )}
                            <div className="space-y-1">
                              <Label className="text-xs">Facturación</Label>
                              <Select
                                value={s.facturacion}
                                onValueChange={(v) =>
                                  updateService(i, { facturacion: v as Facturacion })
                                }
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
                            <div className="space-y-1">
                              <Label className="text-xs">
                                {s.facturacion === "unico"
                                  ? "Monto del cobro único (ARS)"
                                  : "Monto mensual (ARS)"}
                              </Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={s.monto}
                                onChange={(e) => updateService(i, { monto: e.target.value })}
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                        <div className="mt-2 space-y-1">
                          <Label className="text-xs">Quién lo lleva</Label>
                          {users.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No hay usuarios disponibles.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {users.map((u) => {
                                const active = s.responsables.includes(u.id);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => toggleServiceResp(i, u.id)}
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Links del cliente (al fondo, son secundarios) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Drive / carpeta del cliente</Label>
              <Input
                placeholder="https://drive.google.com/…"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                placeholder="https://www.instagram.com/usuario/"
                value={igUrl}
                onChange={(e) => setIgUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Facebook</Label>
              <Input
                placeholder="https://www.facebook.com/pagina"
                value={fbUrl}
                onChange={(e) => setFbUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Web</Label>
              <Input
                placeholder="https://…"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (Markdown)</Label>
            <Textarea
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Tono de marca, preferencias, contraseñas que viven en 1password, etc."
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
