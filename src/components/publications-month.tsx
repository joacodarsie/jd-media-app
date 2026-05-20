"use client";

import { useMemo, useState, useEffect } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
} from "lucide-react";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_STATUS_BADGE,
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

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
type Mode = "mes" | "lista";

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
}: {
  publications: PublicationWithRels[];
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
  defaultClientId?: string;
}) {
  const [mode, setMode] = useState<Mode>("mes");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [fCliente, setFCliente] = useState<string>(defaultClientId ?? "__all__");
  const [fRed, setFRed] = useState<string>("__all__");
  const [fEstado, setFEstado] = useState<string>("__all__");

  useEffect(() => {
    const v = localStorage.getItem("jd:contenidos:mode") as Mode | null;
    if (v === "mes" || v === "lista") setMode(v);
  }, []);
  useEffect(() => {
    localStorage.setItem("jd:contenidos:mode", mode);
  }, [mode]);

  const filtered = useMemo(() => {
    return publications.filter((p) => {
      if (fCliente !== "__all__" && p.cliente_id !== fCliente) return false;
      if (fRed !== "__all__" && p.red !== fRed) return false;
      if (fEstado !== "__all__" && p.estado !== fEstado) return false;
      return true;
    });
  }, [publications, fCliente, fRed, fEstado]);

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
          <select
            value={fCliente}
            onChange={(e) => setFCliente(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="__all__">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
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
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[88px] border-b border-r p-1.5 text-xs last:border-r-0",
                      !inMonth && "bg-muted/30 text-muted-foreground",
                      isToday && "bg-primary/5"
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
                        <PubChip key={p.id} pub={p} clients={clients} users={users} />
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

          {unscheduled.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Sin fecha asignada ({unscheduled.length})
              </h3>
              <div className="space-y-1.5">
                {unscheduled.map((p) => (
                  <PubRow key={p.id} pub={p} clients={clients} users={users} />
                ))}
              </div>
            </div>
          )}
        </>
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
                      "inline-block h-2 w-2 rounded-full",
                      PUBLICATION_STATUS_BADGE[s].split(" ")[0]
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
}: {
  pub: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
}) {
  return (
    <PublicationDetailDialog
      publication={pub}
      clients={clients}
      users={users}
      trigger={
        <button
          className={cn(
            "w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium",
            PUBLICATION_STATUS_BADGE[pub.estado]
          )}
          title={`${pub.titulo} · ${PUBLICATION_STATUS_LABEL[pub.estado]}`}
        >
          {PUBLICATION_TYPE_LABEL[pub.tipo]} · {pub.titulo}
        </button>
      }
    />
  );
}

function PubRow({
  pub,
  clients,
  users,
}: {
  pub: PublicationWithRels;
  clients: ClientForPub[];
  users: Pick<AppUser, "id" | "nombre">[];
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
        <button className="flex w-full items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40">
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
