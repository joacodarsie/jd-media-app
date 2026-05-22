"use client";

import { useState, useEffect } from "react";
import { History, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";

interface HistoryEntry {
  id: string;
  service_id: string | null;
  cliente_id: string;
  accion: "created" | "updated" | "deleted";
  snapshot: Record<string, unknown>;
  cambios: Record<string, { antes: unknown; despues: unknown }> | null;
  user_id: string | null;
  created_at: string;
  autor?: { nombre: string } | null;
}

const FIELD_LABEL: Record<string, string> = {
  tipo: "Tipo de servicio",
  pack: "Pack",
  monto_mensual: "Monto",
  moneda: "Moneda",
  fecha_inicio: "Fecha inicio",
  fecha_fin: "Fecha fin",
  activo: "Activo",
  pack_detalle: "Detalle del pack",
  notas: "Notas",
};

function fmtVal(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "tipo") return SERVICE_TYPE_LABEL[v as string] ?? String(v);
  if (field === "monto_mensual") return new Intl.NumberFormat("es-AR").format(Number(v));
  if (field === "activo") return v === true || v === "true" ? "sí" : "no";
  if (field === "pack_detalle") return JSON.stringify(v);
  return String(v);
}

export function ServiceHistory({ clienteId }: { clienteId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const sb = createClient();
    sb.from("client_services_history")
      .select("*, autor:users!client_services_history_user_id_fkey(nombre)")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setEntries((data ?? []) as unknown as HistoryEntry[]);
        setLoading(false);
      });
  }, [open, clienteId]);

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5 text-xs"
      >
        <History className="h-3.5 w-3.5" />
        {open ? "Ocultar historial" : "Ver historial de servicios"}
      </Button>

      {open && (
        <div className="mt-2 rounded-md border bg-card p-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando...
            </div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin cambios registrados todavía.
            </p>
          ) : (
            <ol className="space-y-3 text-sm">
              {entries.map((e) => {
                const Icon =
                  e.accion === "created"
                    ? Plus
                    : e.accion === "deleted"
                      ? Trash2
                      : Pencil;
                const accentColor =
                  e.accion === "created"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : e.accion === "deleted"
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      : "bg-sky-500/15 text-sky-700 dark:text-sky-300";
                const snap = e.snapshot as Record<string, unknown>;
                const tipoLabel =
                  snap.tipo ? (SERVICE_TYPE_LABEL[snap.tipo as string] ?? String(snap.tipo)) : "servicio";
                return (
                  <li key={e.id} className="flex gap-2">
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        accentColor
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs">
                        <span className="font-semibold">
                          {e.accion === "created"
                            ? `Se agregó ${tipoLabel}`
                            : e.accion === "deleted"
                              ? `Se eliminó ${tipoLabel}`
                              : `Se actualizó ${tipoLabel}`}
                        </span>
                        {snap.pack ? (
                          <span className="text-muted-foreground"> · pack {String(snap.pack)}</span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {e.autor?.nombre ?? "Sistema"} ·{" "}
                        {new Date(e.created_at).toLocaleString("es-AR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                      {e.cambios && Object.keys(e.cambios).length > 0 && (
                        <ul className="space-y-0.5 rounded bg-muted/40 p-2 text-[11px]">
                          {Object.entries(e.cambios).map(([field, val]) => (
                            <li key={field} className="flex flex-wrap gap-1">
                              <span className="font-medium text-foreground">
                                {FIELD_LABEL[field] ?? field}:
                              </span>
                              <span className="text-muted-foreground">{fmtVal(field, val.antes)}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{fmtVal(field, val.despues)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
