"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_STATUS_BADGE,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_TYPE_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AppUser, Client, PublicationWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PublicationFormDialog } from "@/components/publication-form-dialog";
import { PublicationDetailDialog } from "@/components/publication-detail-dialog";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
  clients: Pick<Client, "id" | "nombre">[];
  users: Pick<AppUser, "id" | "nombre">[];
  defaultClientId?: string;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const m = new Map<string, PublicationWithRels[]>();
    for (const p of publications) {
      if (!p.fecha_publicacion) continue;
      const k = p.fecha_publicacion.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [publications]);

  const unscheduled = publications.filter((p) => !p.fecha_publicacion);

  const cells = useMemo(() => {
    const first = new Date(cursor);
    const startDow = (first.getDay() + 6) % 7; // lun=0
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
        </div>
        <PublicationFormDialog
          mode="create"
          clients={clients}
          users={users}
          defaultClientId={defaultClientId}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nueva publicación
            </Button>
          }
        />
      </div>

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
                  {items.slice(0, 4).map((p) => (
                    <PubChip key={p.id} pub={p} clients={clients} users={users} />
                  ))}
                  {items.length > 4 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{items.length - 4} más
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
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((p) => (
              <PubChip key={p.id} pub={p} clients={clients} users={users} large />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PubChip({
  pub,
  clients,
  users,
  large,
}: {
  pub: PublicationWithRels;
  clients: Pick<Client, "id" | "nombre">[];
  users: Pick<AppUser, "id" | "nombre">[];
  large?: boolean;
}) {
  return (
    <PublicationDetailDialog
      publication={pub}
      clients={clients}
      users={users}
      trigger={
        <button
          className={cn(
            "w-full truncate rounded px-1.5 py-1 text-left",
            PUBLICATION_STATUS_BADGE[pub.estado],
            large && "text-xs"
          )}
          title={`${pub.titulo} · ${PUBLICATION_STATUS_LABEL[pub.estado]}`}
        >
          <span className="font-medium">
            {PUBLICATION_TYPE_LABEL[pub.tipo]}·
            {PUBLICATION_NETWORK_LABEL[pub.red].slice(0, 2)}
          </span>{" "}
          {pub.titulo}
        </button>
      }
    />
  );
}
