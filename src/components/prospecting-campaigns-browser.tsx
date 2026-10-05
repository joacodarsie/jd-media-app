"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Clock, FolderOpen, MapPin, Search, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ORDENES_CAMPANIAS,
  filtrarCampanias,
  haceCuanto,
  ordenarCampanias,
  type CampaniaLista,
  type OrdenCampanias,
} from "@/lib/prospecting/campanias-lista";

export interface CampaniaCard extends CampaniaLista {
  canalLabel: string;
  estado: string;
  total: number;
  ganados: number;
  tasaRespuesta: number | null;
}

const LS_ORDEN = "jd:prospeccion:orden";

/**
 * Las campañas con buscador y "Ordenar por". Por defecto, las usadas
 * recientemente primero: es la que el dueño quiere encontrar al entrar.
 */
export function ProspectingCampaignsBrowser({ campanias }: { campanias: CampaniaCard[] }) {
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<OrdenCampanias>("uso");

  useEffect(() => {
    try {
      const o = localStorage.getItem(LS_ORDEN) as OrdenCampanias | null;
      if (o && ORDENES_CAMPANIAS.some((x) => x.value === o)) setOrden(o);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_ORDEN, orden);
    } catch {}
  }, [orden]);

  const visibles = useMemo(() => ordenarCampanias(filtrarCampanias(campanias, q), orden), [campanias, q, orden]);

  const carpetas = useMemo(() => {
    if (orden !== "rubro") return null;
    const m = new Map<string, CampaniaCard[]>();
    for (const c of visibles) {
      const k = c.rubro?.trim() || "Sin rubro";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()];
  }, [visibles, orden]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campaña por nombre, rubro o zona…"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as OrdenCampanias)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Ordenar campañas"
        >
          {ORDENES_CAMPANIAS.map((o) => (
            <option key={o.value} value={o.value}>
              Ordenar: {o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {visibles.length} campaña{visibles.length === 1 ? "" : "s"}
        </span>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay campañas que coincidan con «{q}».
        </p>
      ) : carpetas ? (
        <div className="space-y-3">
          {carpetas.map(([rubro, arr]) => (
            <details key={rubro} open className="group rounded-xl border bg-card/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-accent/40">
                <span className="flex items-center gap-2 font-semibold">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  {rubro}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    {arr.length}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-3 p-3 pt-0 sm:grid-cols-2 lg:grid-cols-3">
                {arr.map((c) => (
                  <Tarjeta key={c.id} c={c} />
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((c) => (
            <Tarjeta key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tarjeta({ c }: { c: CampaniaCard }) {
  return (
    <Link
      href={`/prospeccion/${c.id}`}
      className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{c.nombre}</h3>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{c.rubro}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {c.ubicacion && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {c.ubicacion}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Send className="h-3 w-3" /> {c.canalLabel}
        </span>
        <span className="inline-flex items-center gap-1" title="Última vez que se abrió o se trabajó">
          <Clock className="h-3 w-3" /> {haceCuanto(c.ultimoUso)}
        </span>
        {c.estado === "pausada" && <Badge className="bg-muted text-muted-foreground">pausada</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span>
          <b>{c.total}</b> leads
        </span>
        {c.tasaRespuesta != null && (
          <span className="text-muted-foreground">
            <b>{c.tasaRespuesta}%</b> respuesta
          </span>
        )}
        {c.ganados > 0 && (
          <span className="text-emerald-600 dark:text-emerald-400">
            <b>{c.ganados}</b> ganados
          </span>
        )}
      </div>
    </Link>
  );
}
