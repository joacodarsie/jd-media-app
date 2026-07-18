"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  assignClientTeam,
  createTeam,
  deleteTeam,
  updateTeam,
} from "@/app/(app)/coordinacion/equipos/actions";

export interface TeamRow {
  id: string;
  nombre: string;
  orden: number;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  media_buyer_id: string | null;
  notas: string | null;
}

export interface TeamClientRow {
  id: string;
  nombre: string;
  team_id: string | null;
}

const ROLES: { key: keyof TeamRow; label: string }[] = [
  { key: "cm_id", label: "CM" },
  { key: "disenador_id", label: "Diseño" },
  { key: "audiovisual_id", label: "Edición" },
  { key: "media_buyer_id", label: "Paid Media" },
];

export function EquiposManager({
  teams,
  clients,
  users,
}: {
  teams: TeamRow[];
  clients: TeamClientRow[];
  users: { id: string; nombre: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [aplicarEquipo, setAplicarEquipo] = useState(true);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error ?? "Error");
    });

  const sinEquipo = clients.filter((c) => !c.team_id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => createTeam(`Equipo ${teams.length + 1}`))}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          + Nuevo equipo
        </button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={aplicarEquipo}
            onChange={(e) => setAplicarEquipo(e.target.checked)}
          />
          Al asignar un cliente, pisar su CM/diseño/edición/paid con los del equipo
        </label>
      </div>

      {teams.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Todavía no hay equipos. Creá el primero y asignale personas y clientes.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((t) => {
          const delEquipo = clients.filter((c) => c.team_id === t.id);
          return (
            <div key={t.id} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <input
                  defaultValue={t.nombre}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.nombre) run(() => updateTeam({ id: t.id, nombre: v }));
                  }}
                  className="w-40 rounded-md border bg-background px-2 py-1 text-sm font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`¿Borrar ${t.nombre}? Sus clientes quedan sin equipo.`)) return;
                    run(() => deleteTeam(t.id));
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Borrar
                </button>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <div key={r.key}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {r.label}
                    </div>
                    <select
                      value={(t[r.key] as string | null) ?? ""}
                      onChange={(e) =>
                        run(() =>
                          updateTeam({ id: t.id, [r.key]: e.target.value || null })
                        )
                      }
                      className="mt-0.5 w-full rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      <option value="">— sin asignar —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Clientes · {delEquipo.length}
              </div>
              <div className="mt-1 space-y-1">
                {delEquipo.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{c.nombre}</span>
                    <button
                      type="button"
                      onClick={() => run(() => assignClientTeam({ clienteId: c.id, teamId: null }))}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      quitar
                    </button>
                  </div>
                ))}
                {delEquipo.length === 0 && (
                  <div className="text-xs text-muted-foreground">Sin clientes todavía.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {teams.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">
            Clientes sin equipo · {sinEquipo.length}
          </h3>
          {sinEquipo.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Todos los clientes activos tienen equipo. 🎉
            </p>
          ) : (
            <div className="space-y-1.5">
              {sinEquipo.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{c.nombre}</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      run(() =>
                        assignClientTeam({
                          clienteId: c.id,
                          teamId: e.target.value,
                          aplicarEquipo,
                        })
                      );
                    }}
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Asignar a…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
