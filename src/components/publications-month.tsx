"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  KanbanSquare,
  List,
  Plus,
} from "lucide-react";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_STATUS_BADGE,
  PUBLICATION_STATUS_DOT,
  PUBLICATION_STATUS_LABEL,
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
import { updatePublicationDate, changePublicationStatus } from "@/app/(app)/contenidos/actions";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
type Mode = "mes" | "lista" | "kanban";

const STATUS_ORDER: PublicationStatus[] = [
  "idea",
  "en_diseno",
  "guion",
  "edicion",
  "revision_creativa",
  "revision_cliente",
  "aprobado",
  "publicado",
  "rechazado",
];

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function PublicationsMonth({
  publications,
  clients,
  users,
  defaultClientId,
  unseenByPub,
}: {
  publications: PublicationWithRels[];
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  defaultClientId?: string;
  unseenByPub?: Record<string, number>;
}) {
  const router = useRouter();
  const [, startMove] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  function moveTo(id: string, date: string | null) {
    setHoverKey(null);
    setDraggingId(null);
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
    if (v === "mes" || v === "lista" || v === "kanban") setMode(v);
  }, []);
  useEffect(() => {
    localStorage.setItem("jd:contenidos:mode", mode);
  }, [mode]);

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

  return (
    <div className="space-y-4">
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
          {mode === "lista" && (
            <h2 className="text-lg font-semibold">
              {publications.length} publicacion{publications.length === 1 ? "" : "es"}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Mes / Lista */}
          <div className="flex items-center rounded-md border bg-card p-0.5">
            <ModeBtn icon={CalendarDays} label="Mes" active={mode === "mes"} onClick={() => setMode("mes")} />
            <ModeBtn icon={KanbanSquare} label="Kanban" active={mode === "kanban"} onClick={() => setMode("kanban")} />
            <ModeBtn icon={List} label="Lista" active={mode === "lista"} onClick={() => setMode("lista")} />
          </div>
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
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-semibold",
                      PUBLICATION_STATUS_BADGE[s]
                    )}
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
        // Modo lista — agrupado por estado del flujo
        <div className="space-y-4">
          {STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => {
            const arr = byStatus.get(s) ?? [];
            return (
              <section key={s}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span
                    className={cn(
                      "inline-block h-2.5 w-2.5 rounded-full",
                      PUBLICATION_STATUS_DOT[s]
                    )}
                  />
                  {PUBLICATION_STATUS_LABEL[s]} · {arr.length}
                </h3>
                <div className="space-y-1.5">
                  {arr.map((p) => (
                    <PubRow key={p.id} pub={p} clients={clients} users={users} />
                  ))}
                </div>
              </section>
            );
          })}
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
          className={cn(
            "flex w-full cursor-grab items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] font-medium active:cursor-grabbing",
            PUBLICATION_STATUS_BADGE[pub.estado],
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
          <span className="truncate">
            {PUBLICATION_TYPE_LABEL[pub.tipo]} · {pub.titulo}
          </span>
        </button>
      }
    />
  );
}

function PubRow({
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
  const fecha = pub.fecha_publicacion
    ? new Date(pub.fecha_publicacion).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      })
    : "Sin fecha";
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
          )}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                PUBLICATION_STATUS_BADGE[pub.estado]
              )}
            >
              {PUBLICATION_STATUS_LABEL[pub.estado]}
            </span>
            <span className="truncate">{pub.titulo}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {pub.cliente && <span className="hidden sm:inline">{pub.cliente.nombre}</span>}
            <span>{PUBLICATION_NETWORK_LABEL[pub.red]}</span>
            <span>· {fecha}</span>
          </div>
        </button>
      }
    />
  );
}
