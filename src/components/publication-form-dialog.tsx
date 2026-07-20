"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPublication,
  updatePublication,
  type PublicationInput,
} from "@/app/(app)/contenidos/actions";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_TYPE_LABEL,
} from "@/lib/constants";
import type {
  AppUser,
  Client,
  PublicationType,
  PublicationWithRels,
} from "@/lib/types";
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
import { AIContentSuggester } from "@/components/ai-content-suggester";
import { PublicationAutoPublish } from "@/components/publication-auto-publish";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

// Subset de Client con la info necesaria para auto-asignar
export type ClientForPub = Pick<
  Client,
  "id" | "nombre" | "estado" | "cm_id" | "disenador_id" | "audiovisual_id" | "drive_url"
>;

/** Devuelve el user_id que debería producir el contenido según tipo + equipo del cliente. */
function autoResponsableId(
  tipo: PublicationType,
  cliente: ClientForPub | undefined
): string | null {
  if (!cliente) return null;
  if (tipo === "reel" || tipo === "video") return cliente.audiovisual_id ?? null;
  if (tipo === "post" || tipo === "carrusel") return cliente.disenador_id ?? null;
  if (tipo === "historia") return cliente.cm_id ?? null;
  return null;
}

export function PublicationFormDialog({
  mode,
  publication,
  clients,
  users,
  defaultClientId,
  defaultDate,
  trigger,
}: {
  mode: "create" | "edit";
  publication?: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  defaultClientId?: string;
  defaultDate?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  // Solo activos para crear; al editar permite mantener el actual aunque esté pausado
  const activeClients = useMemo(
    () => clients.filter((c) => c.estado === "activo"),
    [clients]
  );
  const selectableClients = useMemo(() => {
    if (mode === "edit" && publication?.cliente_id) {
      const has = activeClients.some((c) => c.id === publication.cliente_id);
      if (!has) {
        const current = clients.find((c) => c.id === publication.cliente_id);
        return current ? [...activeClients, current] : activeClients;
      }
    }
    return activeClients;
  }, [activeClients, clients, mode, publication]);

  const [cliente, setCliente] = useState<string>(
    publication?.cliente_id ?? defaultClientId ?? ""
  );
  const [titulo, setTitulo] = useState(publication?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(publication?.descripcion ?? "");
  const [copy, setCopy] = useState(publication?.copy ?? "");
  const [guion, setGuion] = useState(publication?.guion ?? "");
  const [red, setRed] = useState<string>(publication?.red ?? "instagram");
  const [tipo, setTipo] = useState<string>(publication?.tipo ?? "post");
  const [fecha, setFecha] = useState(
    publication?.fecha_publicacion?.slice(0, 16) ??
      (defaultDate ? `${defaultDate}T10:00` : "")
  );
  const [hashtags, setHashtags] = useState(publication?.hashtags ?? "");
  const [assetUrl, setAssetUrl] = useState(publication?.asset_url ?? "");
  const [refUrl, setRefUrl] = useState(publication?.referencia_url ?? "");
  const [audiovisual, setAudiovisual] = useState<string>(
    publication?.audiovisual_id ?? NONE
  );
  const [audiovisualTouched, setAudiovisualTouched] = useState(false);
  // Diseñador/a de la PORTADA (solo aplica a reel/video).
  const [portadaDisenador, setPortadaDisenador] = useState<string>(
    publication?.disenador_id ?? NONE
  );
  const [portadaTouched, setPortadaTouched] = useState(false);
  const [estado, setEstado] = useState<string>(publication?.estado ?? "idea");

  const selectedClient = useMemo(
    () => selectableClients.find((c) => c.id === cliente),
    [selectableClients, cliente]
  );

  // Auto-asignar responsable según tipo + cliente (sólo si el user no lo tocó)
  useEffect(() => {
    if (audiovisualTouched) return;
    if (mode === "edit" && publication) return; // no pisar en edición
    const auto = autoResponsableId(tipo as PublicationType, selectedClient);
    setAudiovisual(auto ?? NONE);
  }, [tipo, selectedClient, audiovisualTouched, mode, publication]);

  // Diseñador/a de la portada del reel: por defecto, el de la cuenta.
  useEffect(() => {
    if (portadaTouched) return;
    if (mode === "edit" && publication) return;
    setPortadaDisenador(selectedClient?.disenador_id ?? NONE);
  }, [selectedClient, portadaTouched, mode, publication]);

  // Al abrir el "+" de un día, la fecha debe ser SIEMPRE la del día clickeado.
  // Las celdas del calendario se reusan por índice, así que el estado inicial
  // puede quedar viejo: sincronizamos la fecha (y el cliente) al abrir en create.
  useEffect(() => {
    if (!open || mode !== "create") return;
    if (defaultDate) setFecha(`${defaultDate}T10:00`);
    if (defaultClientId) setCliente(defaultClientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit() {
    if (!cliente) {
      toast.error("Elegí cliente.");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Poné un título.");
      return;
    }
    const payload: PublicationInput = {
      cliente_id: cliente,
      titulo,
      descripcion,
      copy,
      guion,
      red,
      tipo,
      fecha_publicacion: fecha ? new Date(fecha).toISOString() : null,
      hashtags,
      asset_url: assetUrl,
      referencia_url: refUrl,
      audiovisual_id: audiovisual === NONE ? null : audiovisual,
      disenador_id:
        isReel && portadaDisenador !== NONE ? portadaDisenador : null,
      task_id: publication?.task_id ?? null,
      estado: mode === "edit" ? estado : undefined,
    };
    start(async () => {
      const res =
        mode === "create"
          ? await createPublication(payload)
          : await updatePublication(publication!.id, payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      if (mode === "create") {
        const r = res as {
          ok: boolean;
          assignedName?: string | null;
          taskArea?: string | null;
        };
        if (r.assignedName) {
          toast.success(
            `Publicación creada. Tarea de ${r.taskArea ?? "trabajo"} asignada a ${r.assignedName}.`,
            { duration: 5000 }
          );
        } else {
          toast.success("Publicación creada.");
        }
      } else {
        toast.success("Actualizada");
      }
      setOpen(false);
      router.refresh();
    });
  }

  const isReel = tipo === "reel" || tipo === "video";
  const needsDescription = tipo === "post" || tipo === "carrusel" || tipo === "historia" || tipo === "otro";
  const responsableLabel = (() => {
    if (isReel) return "Editor/a audiovisual";
    if (tipo === "post" || tipo === "carrusel") return "Diseñador/a";
    if (tipo === "historia") return "Community Manager";
    return "Responsable de producir";
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva publicación" : "Editar publicación"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={cliente} onValueChange={setCliente} disabled={!!defaultClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir cliente activo" />
                </SelectTrigger>
                <SelectContent>
                  {selectableClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                      {c.estado !== "activo" && " (pausado)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha y hora</Label>
              <Input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Título interno</Label>
              <AIContentSuggester
                clienteId={cliente || undefined}
                tipo={tipo}
                red={red}
                onApply={(s) => {
                  if (s.titulo) setTitulo((cur) => cur || s.titulo);
                  if (s.copy) setCopy(s.copy);
                  if (s.hashtags) setHashtags(s.hashtags);
                  if (s.descripcion) setDescripcion(s.descripcion);
                  if (s.guion) setGuion(s.guion);
                }}
              />
            </div>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Reel lanzamiento promo junio"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Red</Label>
              <Select value={red} onValueChange={setRed}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PUBLICATION_NETWORK_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PUBLICATION_TYPE_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{responsableLabel}</Label>
              <Select
                value={audiovisual}
                onValueChange={(v) => {
                  setAudiovisual(v);
                  setAudiovisualTouched(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!audiovisualTouched && audiovisual !== NONE && selectedClient && (
                <p className="text-[10px] text-muted-foreground">
                  Sugerido según equipo del cliente
                </p>
              )}
            </div>
          </div>

          {/* Reel/video: además del editor, quién hace la PORTADA (la cobra esa persona). */}
          {isReel && (
            <div className="space-y-2 sm:max-w-xs">
              <Label>Diseñador/a (portada del reel)</Label>
              <Select
                value={portadaDisenador}
                onValueChange={(v) => {
                  setPortadaDisenador(v);
                  setPortadaTouched(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!portadaTouched && portadaDisenador !== NONE && selectedClient && (
                <p className="text-[10px] text-muted-foreground">
                  Por defecto, el/la diseñador/a del cliente. Cambialo si la portada
                  la hace otra persona.
                </p>
              )}
            </div>
          )}

          {/* Bloque de creación: orden cronológico (qué se va a hacer ANTES del copy) */}
          {isReel && (
            <div className="space-y-2">
              <Label>Guion (para reel / video)</Label>
              <Textarea
                rows={4}
                value={guion}
                onChange={(e) => setGuion(e.target.value)}
                placeholder="Escena 1: …&#10;Escena 2: …"
              />
              <p className="text-[10px] text-muted-foreground">
                Lo escribe la CM (o en conjunto con audiovisual). El audiovisual edita en base a esto.
              </p>
            </div>
          )}

          {needsDescription && (
            <div className="space-y-2">
              <Label>Descripción de la idea</Label>
              <Textarea
                rows={4}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Qué tiene que mostrar la pieza, referencias visuales, ángulo, mensaje clave…"
              />
              <p className="text-[10px] text-muted-foreground">
                La CM describe la idea. {tipo === "post" || tipo === "carrusel" ? "El/la diseñador/a" : tipo === "historia" ? "La CM misma" : "Quien produzca"} usa esto para crear la pieza.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Copy del post</Label>
            <Textarea
              rows={4}
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              placeholder="Texto que va con la publicación al subirla."
            />
          </div>

          <div className="space-y-2">
            <Label>Hashtags</Label>
            <Input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#marca #campaña"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Link al asset (Drive)</Label>
              <Input
                value={assetUrl}
                onChange={(e) => setAssetUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
              />
            </div>
            <div className="space-y-2">
              <Label>Referencia / inspiración</Label>
              <Input
                value={refUrl}
                onChange={(e) => setRefUrl(e.target.value)}
                placeholder="Link a otra publicación"
              />
            </div>
          </div>


          {mode === "edit" && (
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PUBLICATION_STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "edit" && publication && red === "instagram" && (
            <PublicationAutoPublish
              publicationId={publication.id}
              initialAuto={publication.auto_publicar ?? false}
              initialMedia={publication.publish_media ?? []}
              publishedAt={publication.published_at ?? null}
              publishError={publication.publish_error ?? null}
              igPermalink={publication.ig_permalink ?? null}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
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
