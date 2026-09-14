"use client";

import { useEffect, useState, useTransition } from "react";
import { obtenerPuerta } from "@/app/(app)/tareas/aprobacion-actions";
import { requiereAprobacion, vaPorLaPm } from "@/lib/tareas/puerta";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ListTree, Plus, X } from "lucide-react";
import { createTask, updateTask } from "@/app/(app)/tareas/actions";
import { AREAS, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { AppUser, Client, TaskWithRels } from "@/lib/types";
import { validarFechaLimite } from "@/lib/tareas/fecha-limite";
import { normalizarLinks, type LinkBorrador } from "@/lib/tareas/links";
import { LinksEditor } from "@/components/links-editor";
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

/** Una subtarea todavía no guardada, cargada dentro del formulario del ticket. */
interface SubtareaBorrador {
  titulo: string;
  asignado: string;
  fecha: string;
  descripcion: string;
  links: LinkBorrador[];
  abierta: boolean;
}

const subtareaVacia = (): SubtareaBorrador => ({
  titulo: "",
  asignado: NONE,
  fecha: "",
  descripcion: "",
  links: [],
  abierta: false,
});

/**
 * Crear o editar una tarea (ticket).
 *
 * Es una ventana grande a propósito, como la de Jira: a la izquierda lo que se
 * escribe (título, descripción, links de referencia y el desglose en
 * subtareas), a la derecha los campos del ticket. Así un ticket de "15 días de
 * contenido" nace completo, con cada pieza como subtarea y su propio detalle,
 * en vez de crearse vacío y completarse después.
 */
export function TaskFormDialog({
  mode,
  task,
  users,
  clients,
  trigger,
  tickets = [],
}: {
  mode: "create" | "edit";
  task?: TaskWithRels;
  users: Pick<AppUser, "id" | "nombre">[];
  clients: Pick<Client, "id" | "nombre">[];
  trigger: React.ReactNode;
  /** Tickets madre abiertos, para poder crear la tarea ya colgada de uno. */
  tickets?: { id: string; numero: number | null; titulo: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [titulo, setTitulo] = useState<string>(task?.titulo ?? "");
  const [descripcion, setDescripcion] = useState<string>(task?.descripcion ?? "");
  const [asignado, setAsignado] = useState<string>(task?.asignado_a_id ?? NONE);
  const [cliente, setCliente] = useState<string>(task?.cliente_id ?? NONE);
  const [area, setArea] = useState<string>(task?.area ?? "Community Manager");
  const [prioridad, setPrioridad] = useState<string>(task?.prioridad ?? "media");
  const [estado, setEstado] = useState<string>(task?.estado ?? "pendiente");
  const [fecha, setFecha] = useState<string>(task?.fecha_limite?.slice(0, 10) ?? "");
  const [aprobador, setAprobador] = useState<string>(task?.aprobador_id ?? NONE);
  // Colgar la tarea de un ticket al crearla. Solo al crear: mover una tarea de
  // ticket después es otra cosa (arrastra el desglose) y no se resuelve acá.
  const [madre, setMadre] = useState<string>(NONE);
  const [links, setLinks] = useState<LinkBorrador[]>([]);
  const [subtareas, setSubtareas] = useState<SubtareaBorrador[]>([]);

  // A quién le llega el pedido y quién lo aprueba. Se pregunta al abrir: la
  // ventana se usa desde varias pantallas y así ninguna tiene que pasarlo.
  const [puerta, setPuerta] = useState<Awaited<ReturnType<typeof obtenerPuerta>> | null>(null);
  useEffect(() => {
    if (!open || puerta) return;
    obtenerPuerta()
      .then(setPuerta)
      .catch(() => setPuerta(null));
  }, [open, puerta]);

  const esCreacion = mode === "create";
  const pasaPorPm = !!puerta && puerta.hayPm && !puerta.libre && vaPorLaPm(area);
  const pmCorto = puerta?.pmNombre?.split(" ")[0] ?? "la Project Manager";  // Una subtarea no puede tener su propio desglose (trigger de la 0165).
  const puedeDesglosar = esCreacion && madre === NONE;

  const setSub = (i: number, cambio: Partial<SubtareaBorrador>) =>
    setSubtareas((prev) => prev.map((s, j) => (j === i ? { ...s, ...cambio } : s)));

  function reset() {
    setTitulo("");
    setDescripcion("");
    setAsignado(NONE);
    setCliente(NONE);
    setFecha("");
    setMadre(NONE);
    setLinks([]);
    setSubtareas([]);
  }

  function submit() {
    if (!titulo.trim()) {
      toast.error("Poné un título.");
      return;
    }
    // La fecha también se valida en el servidor; acá se avisa antes de mandar
    // para no perder lo escrito.
    const chequeo = validarFechaLimite(fecha);
    if (!chequeo.ok) {
      toast.error(chequeo.error!);
      return;
    }
    const linksOk = normalizarLinks(links);
    if (linksOk.error) {
      toast.error(linksOk.error);
      return;
    }
    const subsPayload: {
      titulo: string;
      descripcion: string;
      asignado_a_id: string | null;
      fecha_limite: string | null;
      links: ReturnType<typeof normalizarLinks>["links"];
    }[] = [];
    if (puedeDesglosar) {
      for (const s of subtareas) {
        if (!s.titulo.trim()) continue;
        const l = normalizarLinks(s.links);
        if (l.error) {
          toast.error(`Subtarea "${s.titulo.trim()}": ${l.error}`);
          return;
        }
        subsPayload.push({
          titulo: s.titulo.trim(),
          descripcion: s.descripcion,
          asignado_a_id: s.asignado === NONE ? null : s.asignado,
          fecha_limite: s.fecha || null,
          links: l.links,
        });
      }
    }

    start(async () => {
      const payload = {
        titulo: titulo.trim(),
        descripcion,
        asignado_a_id: asignado === NONE ? null : asignado,
        cliente_id: cliente === NONE ? null : cliente,
        area,
        prioridad,
        fecha_limite: chequeo.fecha!,
        aprobador_id: aprobador === NONE ? null : aprobador,
        requiere_aprobacion: aprobador !== NONE,
      };
      const res = esCreacion
        ? await createTask({
            ...payload,
            ...(madre !== NONE ? { parent_id: madre } : {}),
            links: linksOk.links,
            subtareas: subsPayload,
          })
        : await updateTask(task!.id, { ...payload, estado });
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      const aviso = res && "aviso" in res ? (res.aviso as string | undefined) : undefined;
      toast.success(
        esCreacion
          ? `${
              subsPayload.length
                ? `Ticket creado con ${subsPayload.length} ${subsPayload.length === 1 ? "subtarea" : "subtareas"}`
                : "Tarea creada"
            }${pasaPorPm ? ` · le llegó a ${pmCorto}` : ""}`
          : aviso ?? "Tarea actualizada"
      );
      setOpen(false);
      if (esCreacion) reset();
      const nuevoId = esCreacion && res && "id" in res ? (res.id as string | undefined) : undefined;
      // El ticket con desglose se abre: es donde se sigue trabajando.
      if (nuevoId && subsPayload.length) router.push(`/tareas/${nuevoId}`);
      else router.refresh();
    });
  }

  const selectUsuarios = (value: string, onChange: (v: string) => void, vacio: string, clase = "") => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={clase}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{vacio}</SelectItem>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{esCreacion ? "Nueva tarea" : "Editar tarea"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
          {/* ── Lo que se escribe ── */}
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Contenido 1 al 15 de octubre · Impermax"
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea
                id="desc"
                rows={6}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Qué hay que hacer, con el detalle necesario: copys, indicaciones, fechas de publicación…"
              />
              <p className="text-[11px] text-muted-foreground">
                Acepta formato: **negrita**, listas con guiones y casillas con - [ ].
              </p>
            </div>

            {esCreacion && (
              <div className="space-y-2">
                <Label>Links de referencia</Label>
                <LinksEditor value={links} onChange={setLinks} />
              </div>
            )}

            {puedeDesglosar && (
              <div className="rounded-lg border">
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ListTree className="h-4 w-4 text-muted-foreground" />
                    Subtareas
                    {subtareas.length > 0 && (
                      <span className="font-normal text-muted-foreground">({subtareas.length})</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSubtareas((prev) => [...prev, { ...subtareaVacia(), abierta: false }])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Agregar subtarea
                  </Button>
                </div>

                {subtareas.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">
                    Dividí el trabajo en partes: una subtarea por pieza, por publicación o por
                    paso. Cada una tiene su responsable, su fecha y su propio detalle.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {subtareas.map((s, i) => (
                      <li key={i} className="space-y-2 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setSub(i, { abierta: !s.abierta })}
                            title={s.abierta ? "Ocultar detalle" : "Ver detalle"}
                          >
                            {s.abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          <Input
                            value={s.titulo}
                            onChange={(e) => setSub(i, { titulo: e.target.value })}
                            placeholder={`Subtarea ${i + 1} (ej: Carrusel «5 señales»)`}
                            className="h-8 min-w-[10rem] flex-1 text-sm"
                          />
                          {!pasaPorPm &&
                            selectUsuarios(s.asignado, (v) => setSub(i, { asignado: v }), "Como el ticket", "h-8 w-40 text-xs")}
                          <Input
                            type="date"
                            value={s.fecha}
                            onChange={(e) => setSub(i, { fecha: e.target.value })}
                            className="h-8 w-36 text-xs"
                            title="Entrega (vacío = la del ticket)"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setSubtareas((prev) => prev.filter((_, j) => j !== i))}
                            title="Quitar subtarea"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {s.abierta && (
                          <div className="ml-9 space-y-2 rounded-md bg-muted/40 p-3">
                            <Textarea
                              rows={3}
                              value={s.descripcion}
                              onChange={(e) => setSub(i, { descripcion: e.target.value })}
                              placeholder="El detalle de esta subtarea: el copy exacto, qué va en cada placa, indicaciones para diseño o edición…"
                              className="bg-background text-sm"
                            />
                            <LinksEditor value={s.links} onChange={(v) => setSub(i, { links: v })} compacto />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {subtareas.length > 0 && (
                  <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                    {pasaPorPm
                      ? `Heredan cliente, área y prioridad del ticket. Las reparte ${pmCorto}.`
                      : "Heredan cliente, área y prioridad del ticket. Sin responsable o fecha, usan los del ticket."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Los campos del ticket ── */}
          <div className="space-y-4 md:border-l md:pl-6">
            {esCreacion && tickets.length > 0 && (
              <div className="space-y-2">
                <Label>Parte de un ticket</Label>
                <Select value={madre} onValueChange={setMadre}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Tarea suelta</SelectItem>
                    {tickets.map((tk) => (
                      <SelectItem key={tk.id} value={tk.id}>
                        {tk.numero ? `JD-${tk.numero} · ` : ""}
                        {tk.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {madre !== NONE && (
                  <p className="text-[11px] text-muted-foreground">
                    Va a quedar adentro de ese ticket, en su desglose.
                  </p>
                )}
              </div>
            )}
            {!esCreacion && (
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Responsable</Label>
              {pasaPorPm && esCreacion ? (
                <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  Le llega a <b>{puerta?.pmNombre}</b>, Project Manager, que lo reparte a quien lo va a hacer.
                </p>
              ) : (
                selectUsuarios(asignado, setAsignado, "Sin asignar")
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">
                Fecha límite <span className="text-destructive">*</span>
              </Label>
              <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Interna (sin cliente)</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={setPrioridad}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aprobación</Label>
              {requiereAprobacion(area) ? (
                <p className="rounded-md border border-amber-400/50 bg-amber-50/60 px-3 py-2 text-xs dark:bg-amber-950/20">
                  Lo aprueba <b>{puerta?.directoraNombre ?? "la Directora Creativa"}</b> antes de ir al cliente. Le
                  llega cuando pasa a En revisión y tiene 24 h hábiles.
                </p>
              ) : (
                <>
                  {selectUsuarios(aprobador, setAprobador, "No requiere aprobación")}
                  <p className="text-[10px] text-muted-foreground">
                    Le llega el aviso cuando pasa a &quot;En revisión&quot;.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : esCreacion && subtareas.some((s) => s.titulo.trim()) ? "Crear ticket" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
