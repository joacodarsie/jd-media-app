"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  List,
  Loader2,
  Plus,
  Trash2,
  Table as TableIcon,
  ExternalLink,
  Briefcase,
  FolderOpen,
  X,
} from "lucide-react";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_STATUS_HEX,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_TYPE_HEX,
  PUBLICATION_TYPE_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  AppUser,
  PublicationStatus,
  PublicationWithRels,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  PublicationFormDialog,
  type ClientForPub,
} from "@/components/publication-form-dialog";
import { PublicationDetailDialog } from "@/components/publication-detail-dialog";
import { PublicationStatusSelect } from "@/components/publication-status-select";
import {
  updatePublicationDate,
  changePublicationStatus,
  bulkDeletePublications,
  bulkChangePublicationStatus,
  setPublicationTiktokSubido,
} from "@/app/(app)/contenidos/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
type Mode = "mes" | "kanban" | "tabla";

const STATUS_ORDER: PublicationStatus[] = [
  "idea",
  "en_diseno",
  "edicion",
  "revision_creativa",
  "revision_cliente",
  "aprobado",
  "publicado",
  "rechazado",
];

function ymd(d: Date) {
  // Usamos componentes locales en lugar de toISOString() porque este
  // ultimo devuelve UTC. En Argentina (UTC-3) eso adelantaba el dia
  // marcado como "hoy" a partir de las 21hs locales.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PublicationsMonth({
  publications,
  clients,
  users,
  defaultClientId,
  unseenByPub,
  canEdit = true,
}: {
  publications: PublicationWithRels[];
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  defaultClientId?: string;
  unseenByPub?: Record<string, number>;
  /** Solo CM/coordinación/admin editan (crear, mover fecha, borrar). */
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [, startMove] = useTransition();
  const [bulkPending, startBulk] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    startBulk(async () => {
      const res = await bulkDeletePublications(ids);
      if (res?.error) { toast.error("Error al eliminar: " + res.error); return; }
      toast.success(`Se eliminaron ${res.deleted ?? ids.length} publicaciones`);
      clearSelection();
      router.refresh();
    });
  }

  function handleBulkStatus(estado: string) {
    const ids = Array.from(selectedIds);
    startBulk(async () => {
      const res = await bulkChangePublicationStatus(ids, estado);
      if (res?.error) { toast.error("Error al cambiar estado: " + res.error); return; }
      toast.success(`Estado actualizado para ${ids.length} publicaciones`);
      clearSelection();
      router.refresh();
    });
  }

  function moveTo(id: string, date: string | null) {
    setHoverKey(null);
    setDraggingId(null);
    if (!canEdit) return; // diseño/audiovisual no mueven fechas
    startMove(async () => {
      const res = await updatePublicationDate(id, date);
      if (res?.error) {
        toast.error("No se pudo mover: " + res.error);
        return;
      }
      toast.success(date ? "Movida al " + date : "Sin fecha");
      router.refresh();
    });
  }

  function moveToStatus(id: string, status: PublicationStatus) {
    setHoverKey(null);
    setDraggingId(null);
    startMove(async () => {
      const res = await changePublicationStatus(id, status);
      if (res?.error) {
        toast.error("No se pudo cambiar: " + res.error);
        return;
      }
      router.refresh();
    });
  }

  const [mode, setMode] = useState<Mode>("mes");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [fCliente, setFCliente] = useState<string>(defaultClientId ?? "__all__");
  const [fRed, setFRed] = useState<string>("__all__");
  const [fEstado, setFEstado] = useState<string>("__all__");
  const [fEstadoCliente, setFEstadoCliente] = useState<"activos" | "inactivos" | "todos">(
    "activos"
  );
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("jd:contenidos:mode") as Mode | null;
    if (v === "mes" || v === "kanban" || v === "tabla") {
      setMode(v);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("jd:contenidos:mode", mode);
  }, [mode]);

  // Cliente por defecto: si no viene fijado por la URL, mostrar el último
  // cliente al que entró la persona (si sigue activo), o el primero que lleve.
  useEffect(() => {
    if (defaultClientId) return; // la URL manda
    if (fCliente !== "__all__") return;
    const actives = clients.filter((c) => c.estado === "activo");
    if (actives.length === 0) return;
    const last = localStorage.getItem("jd:contenidos:lastClient");
    if (last && actives.some((c) => c.id === last)) setFCliente(last);
    else setFCliente(actives[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recordar el último cliente visto (para la próxima visita).
  useEffect(() => {
    if (fCliente !== "__all__") {
      localStorage.setItem("jd:contenidos:lastClient", fCliente);
    }
  }, [fCliente]);

  // Set de cliente_ids que tienen al menos una publicación
  const clientesConPubs = useMemo(() => {
    return new Set(publications.map((p) => p.cliente_id).filter(Boolean));
  }, [publications]);

  // Clientes visibles según el filtro Activos / Inactivos / Todos
  const visibleClients = useMemo(() => {
    if (defaultClientId) return clients.filter((c) => c.id === defaultClientId);
    if (fEstadoCliente === "activos") {
      return clients.filter((c) => c.estado === "activo");
    }
    if (fEstadoCliente === "inactivos") {
      return clients.filter(
        (c) => c.estado !== "activo" && clientesConPubs.has(c.id)
      );
    }
    return clients;
  }, [clients, fEstadoCliente, defaultClientId, clientesConPubs]);

  const visibleClientIds = useMemo(
    () => new Set(visibleClients.map((c) => c.id)),
    [visibleClients]
  );

  const filteredClientesByText = useMemo(() => {
    const term = clienteSearch.trim().toLowerCase();
    if (!term) return visibleClients;
    return visibleClients.filter((c) => c.nombre.toLowerCase().includes(term));
  }, [visibleClients, clienteSearch]);

  const filtered = useMemo(() => {
    return publications.filter((p) => {
      if (fCliente !== "__all__") {
        if (p.cliente_id !== fCliente) return false;
      } else if (!defaultClientId) {
        // Si no hay cliente seleccionado, restringir a clientes visibles según el filtro de estado
        if (p.cliente_id && !visibleClientIds.has(p.cliente_id)) return false;
      }
      if (fRed !== "__all__" && p.red !== fRed) return false;
      if (fEstado !== "__all__" && p.estado !== fEstado) return false;
      return true;
    });
  }, [publications, fCliente, fRed, fEstado, visibleClientIds, defaultClientId]);

  const byDay = useMemo(() => {
    const m = new Map<string, PublicationWithRels[]>();
    for (const p of filtered) {
      if (!p.fecha_publicacion) continue;
      const k = p.fecha_publicacion.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [filtered]);

  const byStatus = useMemo(() => {
    const m = new Map<PublicationStatus, PublicationWithRels[]>();
    for (const p of filtered) {
      if (!m.has(p.estado)) m.set(p.estado, []);
      m.get(p.estado)!.push(p);
    }
    for (const [, arr] of m) {
      arr.sort((a, b) => {
        if (!a.fecha_publicacion) return 1;
        if (!b.fecha_publicacion) return -1;
        return a.fecha_publicacion.localeCompare(b.fecha_publicacion);
      });
    }
    return m;
  }, [filtered]);

  const unscheduled = filtered.filter((p) => !p.fecha_publicacion);
  const activeFilters = (fCliente !== "__all__" ? 1 : 0) + (fRed !== "__all__" ? 1 : 0) + (fEstado !== "__all__" ? 1 : 0);

  const cells = useMemo(() => {
    const first = new Date(cursor);
    const startDow = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startDow);
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  // Conteo por tipo del MES visible (cursor) + cliente filtrado (ya en `filtered`).
  const cursorYM = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const monthTypeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of filtered) {
      if (!p.fecha_publicacion) continue;
      if (p.fecha_publicacion.slice(0, 7) !== cursorYM) continue;
      c[p.tipo] = (c[p.tipo] ?? 0) + 1;
    }
    return c;
  }, [filtered, cursorYM]);

  const selectedClient =
    fCliente !== "__all__" ? clients.find((c) => c.id === fCliente) ?? null : null;

  return (
    <div className="space-y-4">
      {selectedClient && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span className="text-base font-semibold">{selectedClient.nombre}</span>
          </div>
          {selectedClient.drive_url ? (
            <a
              href={selectedClient.drive_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <FolderOpen className="h-4 w-4" /> Abrir Drive del cliente
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Sin Drive cargado en la ficha</span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {mode === "mes" && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const t = new Date();
                  setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
                }}
              >
                Hoy
              </Button>
            </>
          )}
          {mode === "tabla" && (
            <h2 className="text-lg font-semibold">
              {publications.length} publicacion{publications.length === 1 ? "" : "es"}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle de vistas */}
          <div className="flex items-center rounded-md border bg-card p-0.5">
            <ModeBtn icon={CalendarDays} label="Mes" active={mode === "mes"} onClick={() => setMode("mes")} />
            <ModeBtn icon={KanbanSquare} label="Kanban" active={mode === "kanban"} onClick={() => setMode("kanban")} />
            <ModeBtn icon={TableIcon} label="Tabla" active={mode === "tabla"} onClick={() => setMode("tabla")} />
          </div>
          {canEdit && mode === "tabla" && (
            <Button
              variant={selectMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                if (selectMode) clearSelection();
                else setSelectMode(true);
              }}
            >
              {selectMode ? (
                <><X className="mr-1.5 h-4 w-4" /> Cancelar</>
              ) : (
                <><CheckSquare className="mr-1.5 h-4 w-4" /> Seleccionar</>
              )}
            </Button>
          )}
          {canEdit && (
          <PublicationFormDialog
            mode="create"
            clients={clients}
            users={users}
            defaultClientId={defaultClientId}
            trigger={
              <Button>
                <Plus className="mr-1.5 h-4 w-4" /> Nueva
              </Button>
            }
          />
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {!defaultClientId && (
          <>
            {/* Tabs por estado del cliente */}
            <div className="flex items-center rounded-md border bg-card p-0.5">
              {(["activos", "inactivos", "todos"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setFEstadoCliente(k);
                    setFCliente("__all__");
                  }}
                  className={cn(
                    "rounded-sm px-2 py-1 text-xs font-medium transition-colors",
                    fEstadoCliente === k
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {k === "activos" ? "Activos" : k === "inactivos" ? "Inactivos" : "Todos"}{" "}
                  ({k === "activos"
                    ? clients.filter((c) => c.estado === "activo").length
                    : k === "inactivos"
                    ? clients.filter((c) => c.estado !== "activo" && clientesConPubs.has(c.id)).length
                    : clients.length})
                </button>
              ))}
            </div>

            {/* Combobox con buscador para elegir cliente puntual */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setClienteSearchOpen((v) => !v)}
                className="h-8 rounded-md border bg-background px-2 text-xs hover:bg-muted"
              >
                {fCliente === "__all__"
                  ? `Todos (${visibleClients.length})`
                  : visibleClients.find((c) => c.id === fCliente)?.nombre ?? "Cliente"}
                {" ▾"}
              </button>
              {clienteSearchOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border bg-popover p-2 shadow-md">
                  <input
                    autoFocus
                    value={clienteSearch}
                    onChange={(e) => setClienteSearch(e.target.value)}
                    placeholder="Buscar cliente…"
                    className="mb-2 h-7 w-full rounded-md border bg-background px-2 text-xs"
                  />
                  <div className="max-h-64 overflow-y-auto">
                    <button
                      onClick={() => {
                        setFCliente("__all__");
                        setClienteSearchOpen(false);
                        setClienteSearch("");
                      }}
                      className={cn(
                        "w-full rounded-sm px-2 py-1 text-left text-xs hover:bg-muted",
                        fCliente === "__all__" && "bg-muted"
                      )}
                    >
                      Todos ({visibleClients.length})
                    </button>
                    {filteredClientesByText.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setFCliente(c.id);
                          setClienteSearchOpen(false);
                          setClienteSearch("");
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-xs hover:bg-muted",
                          fCliente === c.id && "bg-muted"
                        )}
                      >
                        <span>{c.nombre}</span>
                        {c.estado !== "activo" && (
                          <span className="text-[9px] text-muted-foreground">inactivo</span>
                        )}
                      </button>
                    ))}
                    {filteredClientesByText.length === 0 && (
                      <p className="px-2 py-2 text-xs text-muted-foreground">
                        Sin resultados.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        <select
          value={fRed}
          onChange={(e) => setFRed(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="__all__">Todas las redes</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
          <option value="youtube">YouTube</option>
          <option value="twitter">X / Twitter</option>
          <option value="otra">Otra</option>
        </select>
        <select
          value={fEstado}
          onChange={(e) => setFEstado(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="__all__">Todos los estados</option>
          <option value="idea">Idea</option>
          <option value="en_diseno">En diseño</option>
          <option value="guion">Guion</option>
          <option value="edicion">Edición</option>
          <option value="revision_creativa">Revisión creativa</option>
          <option value="revision_cliente">Revisión cliente</option>
          <option value="aprobado">Aprobado</option>
          <option value="publicado">Publicado</option>
          <option value="rechazado">Cambios pedidos</option>
        </select>
        {activeFilters > 0 && (
          <button
            onClick={() => { setFCliente(defaultClientId ?? "__all__"); setFRed("__all__"); setFEstado("__all__"); }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} publicación{filtered.length === 1 ? "" : "es"}
        </span>
      </div>

      {mode === "mes" ? (
        <>
          {/* Resumen del mes visible por formato (hace también de leyenda de colores) */}
          <MonthTypeSummary counts={monthTypeCounts} />
          <div className="rounded-xl border bg-card">
            <div className="grid grid-cols-7 border-b text-xs font-medium text-muted-foreground">
              {DAY_NAMES.map((d) => (
                <div key={d} className="px-2 py-2 text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const key = ymd(d);
                const items = byDay.get(key) ?? [];
                const isToday = ymd(new Date()) === key;
                const isHover = hoverKey === key && draggingId !== null;
                return (
                  <div
                    key={i}
                    onDragOver={(e) => {
                      if (!draggingId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (hoverKey !== key) setHoverKey(key);
                    }}
                    onDragLeave={() => {
                      if (hoverKey === key) setHoverKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain") || draggingId;
                      if (id) moveTo(id, key);
                    }}
                    className={cn(
                      "min-h-[88px] border-b border-r p-1.5 text-xs last:border-r-0 transition-colors",
                      !inMonth && "bg-muted/30 text-muted-foreground",
                      isToday && "bg-primary/5",
                      isHover && "bg-primary/15 ring-2 ring-inset ring-primary"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={cn(
                          "font-medium",
                          isToday && "rounded-full bg-primary px-1.5 text-primary-foreground"
                        )}
                      >
                        {d.getDate()}
                      </span>
                      {inMonth && (
                        <PublicationFormDialog
                          mode="create"
                          clients={clients}
                          users={users}
                          defaultClientId={defaultClientId}
                          defaultDate={key}
                          trigger={
                            <button className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                              <Plus className="h-3 w-3" />
                            </button>
                          }
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((p) => (
                        <PubChip
                          key={p.id}
                          pub={p}
                          clients={clients}
                          users={users}
                          unseenCount={unseenByPub?.[p.id] ?? 0}
                          onDragStart={(id) => setDraggingId(id)}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setHoverKey(null);
                          }}
                          dragging={draggingId === p.id}
                        />
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{items.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              if (hoverKey !== "__none__") setHoverKey("__none__");
            }}
            onDragLeave={() => {
              if (hoverKey === "__none__") setHoverKey(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || draggingId;
              if (id) moveTo(id, null);
            }}
            className={cn(
              "rounded-xl border bg-card p-4 transition-colors",
              hoverKey === "__none__" && "bg-primary/15 ring-2 ring-inset ring-primary",
              unscheduled.length === 0 && !draggingId && "hidden"
            )}
          >
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              Sin fecha asignada
              {unscheduled.length > 0 && ` (${unscheduled.length})`}
              {draggingId && unscheduled.length === 0 && (
                <span className="ml-1 text-primary">— soltá acá para quitar fecha</span>
              )}
            </h3>
            <div className="space-y-1.5">
              {unscheduled.map((p) => (
                <PubRow
                  key={p.id}
                  pub={p}
                  clients={clients}
                  users={users}
                  unseenCount={unseenByPub?.[p.id] ?? 0}
                  onDragStart={(id) => setDraggingId(id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setHoverKey(null);
                  }}
                  dragging={draggingId === p.id}
                />
              ))}
            </div>
          </div>
        </>
      ) : mode === "kanban" ? (
        // Modo kanban — columnas por estado del flujo, drag & drop entre columnas
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STATUS_ORDER.map((s) => {
            const arr = byStatus.get(s) ?? [];
            const dropHover = hoverKey === "k_" + s && draggingId;
            return (
              <div
                key={s}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const k = "k_" + s;
                  if (hoverKey !== k) setHoverKey(k);
                }}
                onDragLeave={() => {
                  if (hoverKey === "k_" + s) setHoverKey(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || draggingId;
                  if (id) moveToStatus(id, s);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-lg border bg-card transition-colors",
                  dropHover && "ring-2 ring-inset ring-primary"
                )}
              >
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-semibold text-foreground"
                    style={{ backgroundColor: PUBLICATION_STATUS_HEX[s] + "33" }}
                  >
                    {PUBLICATION_STATUS_LABEL[s]}
                  </span>
                  <span className="text-xs text-muted-foreground">{arr.length}</span>
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
                  {arr.length === 0 ? (
                    <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">
                      Vacío.
                    </p>
                  ) : (
                    arr.map((p) => (
                      <PubKanbanCard
                        key={p.id}
                        pub={p}
                        clients={clients}
                        users={users}
                        onDragStart={(id) => setDraggingId(id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setHoverKey(null);
                        }}
                        dragging={draggingId === p.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Modo tabla — planilla ordenada por fecha (con selección para bulk)
        <PubTable
          pubs={filtered}
          clients={clients}
          users={users}
          unseenByPub={unseenByPub}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}

      {/* Barra de bulk actions — fixed bottom cuando hay selección */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-card px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} seleccionada{selectedIds.size === 1 ? "" : "s"}
          </span>
          <div className="h-4 w-px bg-border" />
          <Select onValueChange={handleBulkStatus} disabled={bulkPending}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Cambiar estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {PUBLICATION_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkPending}
          >
            {bulkPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            Eliminar
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkPending}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function PubKanbanCard({
  pub,
  clients,
  users,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  pub: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  const fechaShort = pub.fecha_publicacion
    ? new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      })
    : null;
  return (
    <PublicationDetailDialog
      publication={pub}
      clients={clients}
      users={users}
      trigger={
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", pub.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart?.(pub.id);
          }}
          onDragEnd={() => onDragEnd?.()}
          className={cn(
            "block w-full cursor-grab rounded-md border bg-background p-2 text-left text-xs transition-colors hover:border-primary/40 active:cursor-grabbing",
            dragging && "opacity-40"
          )}
        >
          <div className="line-clamp-2 font-medium">{pub.titulo}</div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="truncate">{pub.cliente?.nombre ?? "—"}</span>
            <span className="shrink-0">{fechaShort ?? "sin fecha"}</span>
          </div>
        </button>
      }
    />
  );
}

function ModeBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof List;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function MonthTypeSummary({ counts }: { counts: Record<string, number> }) {
  // Posteo y carrusel son el mismo formato → se cuentan juntos como "Posteos".
  // El verde queda para "publicado", así que historia va en ámbar.
  const items: { key: string; label: string; hex: string; value: number; always: boolean }[] = [
    { key: "post", label: "Posteos", hex: PUBLICATION_TYPE_HEX.post, value: (counts.post ?? 0) + (counts.carrusel ?? 0), always: true },
    { key: "reel", label: "Reels", hex: PUBLICATION_TYPE_HEX.reel, value: counts.reel ?? 0, always: true },
    { key: "historia", label: "Historias", hex: PUBLICATION_TYPE_HEX.historia, value: counts.historia ?? 0, always: true },
    { key: "video", label: "Videos", hex: PUBLICATION_TYPE_HEX.video, value: counts.video ?? 0, always: false },
    { key: "otro", label: "Otros", hex: PUBLICATION_TYPE_HEX.otro, value: counts.otro ?? 0, always: false },
  ];
  const shown = items.filter((it) => it.always || it.value > 0);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-card px-3 py-1.5 text-xs">
      <span className="font-semibold text-muted-foreground">Este mes</span>
      {shown.map((it) => (
        <span key={it.key} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: it.hex }}
          />
          <span className="font-bold tabular-nums">{it.value}</span>
          <span className="text-muted-foreground">{it.label}</span>
        </span>
      ))}
    </div>
  );
}

function PubChip({
  pub,
  clients,
  users,
  unseenCount = 0,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  pub: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  unseenCount?: number;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  const titleWithBadge =
    unseenCount > 0
      ? `${pub.titulo} · ${PUBLICATION_STATUS_LABEL[pub.estado]} · ${unseenCount} comentario(s) del cliente sin ver`
      : `${pub.titulo} · ${PUBLICATION_STATUS_LABEL[pub.estado]}`;

  return (
    <PublicationDetailDialog
      publication={pub}
      clients={clients}
      users={users}
      trigger={
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", pub.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart?.(pub.id);
          }}
          onDragEnd={() => onDragEnd?.()}
          // Fondo por ESTADO (hex + opacidad, se ve bien en claro y oscuro);
          // texto neutro fijo. El TIPO se indica con el puntito de color.
          style={{
            backgroundColor:
              PUBLICATION_STATUS_HEX[pub.estado] +
              (pub.estado === "publicado" ? "59" : "2e"),
          }}
          className={cn(
            "flex w-full cursor-grab items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] font-medium text-foreground active:cursor-grabbing",
            dragging && "opacity-40"
          )}
          title={titleWithBadge}
        >
          {unseenCount > 0 && (
            <span
              aria-label={`${unseenCount} comentario(s) sin ver`}
              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold leading-none text-white"
            >
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: PUBLICATION_TYPE_HEX[pub.tipo] }}
            aria-label={PUBLICATION_TYPE_LABEL[pub.tipo]}
          />
          <span className="truncate">{pub.titulo}</span>
        </button>
      }
    />
  );
}

// Fila compacta de publicación. Se usa en el modo Mes para la lista de piezas
// "sin fecha asignada" (con drag & drop para programarlas).
function PubRow({
  pub,
  clients,
  users,
  unseenCount = 0,
  onDragStart,
  onDragEnd,
  dragging,
  selectMode,
  selected,
  onToggleSelect,
}: {
  pub: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  unseenCount?: number;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const fecha = pub.fecha_publicacion
    ? new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      })
    : "Sin fecha";

  const rowContent = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {selectMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onToggleSelect?.(pub.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 shrink-0 accent-primary"
        />
      )}
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-foreground"
        style={{ backgroundColor: PUBLICATION_STATUS_HEX[pub.estado] + "33" }}
      >
        {PUBLICATION_STATUS_LABEL[pub.estado]}
      </span>
      {unseenCount > 0 && (
        <span
          title={`${unseenCount} comentario(s) del cliente sin ver`}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
        >
          💬 {unseenCount > 9 ? "9+" : unseenCount}
        </span>
      )}
      <span className="truncate">{pub.titulo}</span>
    </div>
  );

  const rowMeta = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {pub.cliente && <span className="hidden sm:inline">{pub.cliente.nombre}</span>}
      <span>{PUBLICATION_NETWORK_LABEL[pub.red]}</span>
      <span>· {fecha}</span>
    </div>
  );

  if (selectMode) {
    return (
      <div
        onClick={() => onToggleSelect?.(pub.id)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors",
          selected ? "border-primary bg-primary/5" : "hover:border-primary/40",
          dragging && "opacity-40"
        )}
      >
        {rowContent}
        {rowMeta}
      </div>
    );
  }

  return (
    <PublicationDetailDialog
      publication={pub}
      clients={clients}
      users={users}
      trigger={
        <button
          draggable={!!onDragStart}
          onDragStart={(e) => {
            if (!onDragStart) return;
            e.dataTransfer.setData("text/plain", pub.id);
            e.dataTransfer.effectAllowed = "move";
            onDragStart(pub.id);
          }}
          onDragEnd={() => onDragEnd?.()}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40",
            onDragStart && "cursor-grab active:cursor-grabbing",
            dragging && "opacity-40"
          )}
        >
          {rowContent}
          {rowMeta}
        </button>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modo TABLA — vista clásica tipo planilla (fecha, contenido, copy, estado,
// TikTok, referencia). Pensada para quienes prefieren leer el mes como lista
// ordenada por fecha.
// ─────────────────────────────────────────────────────────────────────────
function PubTable({
  pubs,
  clients,
  users,
  unseenByPub,
  selectMode,
  selectedIds,
  onToggleSelect,
}: {
  pubs: PublicationWithRels[];
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  unseenByPub?: Record<string, number>;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const rows = useMemo(
    () =>
      [...pubs].sort((a, b) =>
        (a.fecha_publicacion ?? "9999-12-31").localeCompare(
          b.fecha_publicacion ?? "9999-12-31"
        )
      ),
    [pubs]
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No hay publicaciones para mostrar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            {selectMode && <th className="w-8 px-3 py-2.5" />}
            <th className="px-3 py-2.5 font-medium">Fecha</th>
            <th className="px-3 py-2.5 font-medium">Formato</th>
            <th className="px-3 py-2.5 font-medium">Contenido</th>
            <th className="px-3 py-2.5 font-medium">Desarrollo</th>
            <th className="px-3 py-2.5 font-medium">Copy</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 font-medium">Referencias</th>
            <th className="px-3 py-2.5 text-center font-medium">TikTok</th>
            <th className="px-3 py-2.5 font-medium">Canva / Drive</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <PubTableRow
              key={p.id}
              pub={p}
              clients={clients}
              users={users}
              unseenCount={unseenByPub?.[p.id] ?? 0}
              selectMode={selectMode}
              selected={selectedIds?.has(p.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PubTableRow({
  pub,
  clients,
  users,
  unseenCount = 0,
  selectMode,
  selected,
  onToggleSelect,
}: {
  pub: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  unseenCount?: number;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const fecha = pub.fecha_publicacion
    ? new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "Sin fecha";
  // reels y posts espejan en TikTok; el resto no aplica.
  const tiktokAplica = pub.tipo === "reel" || pub.tipo === "post";
  const subido = (pub as unknown as { tiktok_subido?: boolean }).tiktok_subido ?? false;

  return (
    <tr
      className={cn(
        "border-b last:border-0 align-top hover:bg-muted/30",
        selected && "bg-primary/5"
      )}
    >
      {selectMode && (
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(pub.id)}
            className="h-4 w-4 accent-primary"
          />
        </td>
      )}
      <td className="whitespace-nowrap px-3 py-2.5 capitalize text-muted-foreground">
        {fecha}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: PUBLICATION_TYPE_HEX[pub.tipo] }}
          />
          <span className="text-xs font-medium">{PUBLICATION_TYPE_LABEL[pub.tipo]}</span>
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {PUBLICATION_NETWORK_LABEL[pub.red]}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <PublicationDetailDialog
          publication={pub}
          clients={clients}
          users={users}
          trigger={
            <button className="group flex items-center gap-1.5 text-left">
              <span className="font-medium group-hover:underline">{pub.titulo}</span>
              {unseenCount > 0 && (
                <span
                  title={`${unseenCount} comentario(s) del cliente sin ver`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
                >
                  💬 {unseenCount > 9 ? "9+" : unseenCount}
                </span>
              )}
            </button>
          }
        />
        {pub.cliente && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {pub.cliente.nombre}
          </span>
        )}
      </td>
      <td className="max-w-[240px] px-3 py-2.5 text-xs text-muted-foreground">
        {pub.descripcion ? (
          <span className="line-clamp-3 whitespace-pre-wrap" title={pub.descripcion}>
            {pub.descripcion}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="max-w-[260px] px-3 py-2.5 text-xs text-muted-foreground">
        {pub.copy ? (
          <span className="line-clamp-3 whitespace-pre-wrap" title={pub.copy}>
            {pub.copy}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="w-40 px-3 py-2.5 align-middle">
        <PublicationStatusSelect publication={pub} size="sm" />
      </td>
      <td className="px-3 py-2.5">
        {pub.referencia_url ? (
          <a
            href={pub.referencia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver
          </a>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        {tiktokAplica ? (
          <TiktokCell id={pub.id} initial={subido} />
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {pub.asset_url ? (
          <a
            href={pub.asset_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </a>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>
    </tr>
  );
}

function TiktokCell({ id, initial }: { id: string; initial: boolean }) {
  const router = useRouter();
  const [subido, setSubido] = useState(initial);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !subido;
    setSubido(next); // optimista
    start(async () => {
      const res = await setPublicationTiktokSubido(id, next);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        setSubido(!next);
        return;
      }
      router.refresh();
    });
  }

  return (
    <input
      type="checkbox"
      checked={subido}
      disabled={pending}
      onChange={toggle}
      title={subido ? "Ya está subido a TikTok" : "Pendiente de subir a TikTok"}
      className={cn("h-4 w-4 cursor-pointer accent-emerald-500", pending && "opacity-60")}
    />
  );
}
