"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createPortalNotice,
  deletePortalNotice,
  markNoticeRead,
} from "@/app/(app)/portal/actions";

export interface PortalNoticeRow {
  id: string;
  titulo: string;
  cuerpo: string;
  destinatarios: string[];
  created_by: string | null;
  created_at: string;
  leida: boolean;
  autor: string;
}

export function PortalNotices({
  notices,
  users,
  isAdmin,
  meId,
}: {
  notices: PortalNoticeRow[];
  users: { id: string; nombre: string }[];
  isAdmin: boolean;
  meId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [paraTodos, setParaTodos] = useState(true);
  const [dest, setDest] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await createPortalNotice({
        titulo,
        cuerpo,
        destinatarios: paraTodos ? [] : dest,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Aviso publicado y notificado");
      setTitulo("");
      setCuerpo("");
      setDest([]);
      setParaTodos(true);
      setShowForm(false);
    });
  }

  function toggleDest(id: string) {
    setDest((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="rounded-lg border bg-card p-4">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              📣 Nuevo aviso al equipo
            </button>
          ) : (
            <div className="space-y-3">
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título del aviso (ej: Cambio en los cobros)"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                placeholder="El mensaje para el equipo…"
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={paraTodos}
                    onChange={(e) => setParaTodos(e.target.checked)}
                  />
                  Para todo el equipo
                </label>
                {!paraTodos && (
                  <div className="flex flex-wrap gap-1.5">
                    {users
                      .filter((u) => u.id !== meId)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleDest(u.id)}
                          className={`rounded-full border px-2.5 py-0.5 text-xs ${
                            dest.includes(u.id)
                              ? "border-foreground bg-foreground text-background"
                              : "bg-background hover:bg-accent"
                          }`}
                        >
                          {u.nombre}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || !titulo.trim() || !cuerpo.trim() || (!paraTodos && dest.length === 0)}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {pending ? "Publicando…" : "Publicar y notificar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-md border px-3 py-1.5 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {notices.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No hay avisos todavía.
        </div>
      )}

      {notices.map((n) => (
        <div
          key={n.id}
          className={`rounded-lg border p-4 ${
            n.leida
              ? "bg-card"
              : "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-semibold">
                {!n.leida && <span className="mr-1.5">🔔</span>}
                {n.titulo}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {n.autor} ·{" "}
                {new Date(n.created_at).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                })}
                {n.destinatarios.length > 0
                  ? ` · para ${n.destinatarios.length} persona${n.destinatarios.length > 1 ? "s" : ""}`
                  : " · para todo el equipo"}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {!n.leida && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await markNoticeRead(n.id);
                      if (!r.ok) toast.error(r.error);
                    })
                  }
                  className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  ✓ Leído
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("¿Borrar este aviso para todos?")) return;
                    startTransition(async () => {
                      const r = await deletePortalNotice(n.id);
                      if (!r.ok) toast.error(r.error);
                    });
                  }}
                  className="rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{n.cuerpo}</p>
        </div>
      ))}
    </div>
  );
}
