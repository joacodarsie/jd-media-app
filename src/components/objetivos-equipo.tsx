"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { guardarMetaPersona } from "@/app/(app)/objetivos/actions";
import type { Avance, PersonaObj } from "@/lib/objetivos/equipo";
import { cn } from "@/lib/utils";

export interface FichaMetrica {
  id: string;
  label: string;
  ayuda: string;
  unidad: "n" | "%";
  metaManual: boolean;
  semana: Avance | null;
  mes: Avance;
  metaSemanalGuardada: number | null;
  metaMensualGuardada: number | null;
}

export interface FichaPersona {
  persona: PersonaObj;
  metricas: FichaMetrica[];
}

const n = (v: number) => v.toLocaleString("es-AR");

export function ObjetivosEquipo({ fichas, canEdit }: { fichas: FichaPersona[]; canEdit: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {fichas.map((f) => (
        <div key={f.persona.id} className="rounded-xl border bg-card p-4">
          <div className="mb-3">
            <h2 className="font-semibold">{f.persona.nombre}</h2>
            <p className="text-xs text-muted-foreground">{f.persona.area ?? f.persona.rol}</p>
          </div>
          <div className="space-y-4">
            {f.metricas.map((m) => (
              <Metrica key={m.id} userId={f.persona.id} m={m} canEdit={canEdit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Metrica({ userId, m, canEdit }: { userId: string; m: FichaMetrica; canEdit: boolean }) {
  const [editando, setEditando] = useState(false);
  const [sem, setSem] = useState(m.metaSemanalGuardada?.toString() ?? "");
  const [mes, setMes] = useState(m.metaMensualGuardada?.toString() ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function guardar() {
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    start(async () => {
      const r = await guardarMetaPersona({ userId, metrica: m.id, metaSemanal: num(sem), metaMensual: num(mes) });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Meta guardada");
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium" title={m.ayuda}>
          {m.label}
        </div>
        {canEdit && m.metaManual && !editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Editar la meta de ${m.label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editando ? (
        <div className="mt-1.5 flex flex-wrap items-end gap-2">
          {m.semana && (
            <label className="text-xs text-muted-foreground">
              Meta semanal
              <Input value={sem} onChange={(e) => setSem(e.target.value)} type="number" min={0} className="mt-0.5 h-8 w-28" />
            </label>
          )}
          <label className="text-xs text-muted-foreground">
            Meta mensual{m.unidad === "%" ? " (%)" : ""}
            <Input value={mes} onChange={(e) => setMes(e.target.value)} type="number" min={0} className="mt-0.5 h-8 w-28" />
          </label>
          <Button size="sm" onClick={guardar} disabled={pending}>
            Guardar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={pending}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className={cn("mt-1.5 grid gap-3", m.semana ? "grid-cols-2" : "grid-cols-1")}>
          {m.semana && <Barra titulo="Esta semana" a={m.semana} unidad={m.unidad} />}
          <Barra titulo="Este mes" a={m.mes} unidad={m.unidad} />
        </div>
      )}
    </div>
  );
}

function Barra({ titulo, a, unidad }: { titulo: string; a: Avance; unidad: "n" | "%" }) {
  const pct = a.meta && a.meta > 0 ? Math.round((a.valor / a.meta) * 100) : null;
  if (a.meta === 0 && a.valor === 0)
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
        <div className="text-sm text-muted-foreground">Nada para este período</div>
      </div>
    );
  const color = pct == null ? "bg-muted-foreground/40" : pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className="text-sm">
        <b>{unidad === "%" ? `${a.valor}%` : n(a.valor)}</b>
        {a.meta != null ? (
          <span className="text-muted-foreground"> de {unidad === "%" ? `${a.meta}%` : n(a.meta)}</span>
        ) : (
          <span className="text-muted-foreground"> · sin meta</span>
        )}
      </div>
      {pct != null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      {a.proyeccion != null && a.meta != null && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          A este ritmo: {n(a.proyeccion)} {a.proyeccion >= a.meta ? "✓" : `(faltarían ${n(a.meta - a.proyeccion)})`}
        </div>
      )}
    </div>
  );
}
