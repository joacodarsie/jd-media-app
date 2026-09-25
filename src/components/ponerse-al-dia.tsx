"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTicket } from "@/lib/tareas/tickets";
import { TIPOS_VENCIDA, type GrupoPersona, type Persona, type TareaVencida, type TipoVencida } from "@/lib/tareas/vencidas";
import { TareaPeekProvider, useTareaPeek } from "@/components/tarea-peek";
import {
  bulkReassignTasks,
  bulkSetDueDate,
  updateTaskStatus,
} from "@/app/(app)/tareas/actions";

type Fila = TareaVencida & { cliente: string | null };
type Grupo = Omit<GrupoPersona, "tareas"> & { tareas: Fila[] };

/** Cuántos renglones se ven por persona antes de "Ver todas". */
const VISIBLES = 8;

function sumarDias(ymd: string, dias: number): string {
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
  return new Date(t + dias * 86_400_000).toISOString().slice(0, 10);
}

export function PonerseAlDia(props: { grupos: Grupo[]; personas: Persona[]; hoy: string }) {
  return (
    <TareaPeekProvider>
      <Vista {...props} />
    </TareaPeekProvider>
  );
}

function Vista({ grupos, personas, hoy }: { grupos: Grupo[]; personas: Persona[]; hoy: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoVencida | "todas">("todas");
  // Lo que ya se resolvió acá: se saca al toque, sin esperar al refresh.
  const [resueltas, setResueltas] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const todas = useMemo(
    () => grupos.flatMap((g) => g.tareas).filter((t) => !resueltas.has(t.id)),
    [grupos, resueltas]
  );
  const cuenta = (t: TipoVencida) => todas.filter((x) => x.tipo === t).length;
  const sugeridas = todas.filter((t) => t.sugerido);

  const visibles = grupos
    .map((g) => ({
      ...g,
      tareas: g.tareas.filter((t) => !resueltas.has(t.id) && (tipo === "todas" || t.tipo === tipo)),
    }))
    .filter((g) => g.tareas.length > 0);

  function sacar(ids: string[]) {
    setResueltas((prev) => new Set([...prev, ...ids]));
    router.refresh();
  }

  function hecha(t: Fila) {
    start(async () => {
      const r = await updateTaskStatus(t.id, "completada");
      if ("error" in r && r.error) return void toast.error(r.error);
      if (r.aviso) toast.message(r.aviso);
      // Diseño y edición pasan a revisión en vez de cerrarse: siguen vencidas
      // pero ya no dependen de quien las tenía.
      if (r.estado === "completada") sacar([t.id]);
      else router.refresh();
    });
  }

  function posponer(t: Fila, dias: number) {
    const fecha = sumarDias(hoy, dias);
    start(async () => {
      const r = await bulkSetDueDate([t.id], fecha);
      if ("error" in r && r.error) return void toast.error(r.error);
      sacar([t.id]);
    });
  }

  function pasarA(ids: string[], a: Persona) {
    start(async () => {
      const r = await bulkReassignTasks(ids, a.id);
      if (r && "error" in r && r.error) return void toast.error(r.error);
      toast.success(ids.length === 1 ? `Pasada a ${a.nombre}.` : `${ids.length} tareas pasadas a ${a.nombre}.`);
      router.refresh();
    });
  }

  function pasarSugeridas() {
    const porPersona = new Map<string, { a: Persona; ids: string[] }>();
    for (const t of sugeridas) {
      const g = porPersona.get(t.sugerido!.id) ?? { a: t.sugerido!, ids: [] };
      g.ids.push(t.id);
      porPersona.set(t.sugerido!.id, g);
    }
    for (const { a, ids } of porPersona.values()) pasarA(ids, a);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/tareas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Tareas
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Ponerse al día</h1>
        <p className="text-muted-foreground">
          {todas.length === 0
            ? "No hay tareas vencidas en el equipo."
            : `${todas.length} tareas vencidas. Cada una sale de la lista cuando está hecha, tiene fecha nueva o pasa a otra persona.`}
        </p>
      </div>

      {sugeridas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-500/40 dark:bg-violet-950">
          <p className="text-sm text-violet-900 dark:text-violet-200">
            <b>
              {sugeridas.length} {sugeridas.length === 1 ? "reunión mensual está" : "reuniones mensuales están"} a nombre
              de quien no las da.
            </b>{" "}
            Desde el 22/9 la reunión la da el director creativo de cada cuenta.
          </p>
          <button
            onClick={pasarSugeridas}
            disabled={pending}
            className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Pasárselas a {[...new Set(sugeridas.map((t) => t.sugerido!.nombre.split(" ")[0]))].join(" y ")}
          </button>
        </div>
      )}

      {todas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[{ value: "todas" as const, label: "Todas", n: todas.length }, ...TIPOS_VENCIDA.map((t) => ({ ...t, n: cuenta(t.value) }))]
            .filter((c) => c.n > 0)
            .map((c) => (
              <button
                key={c.value}
                onClick={() => setTipo(c.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  tipo === c.value
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {c.label} · {c.n}
              </button>
            ))}
        </div>
      )}

      {visibles.map((g) => (
        <TarjetaPersona
          key={g.persona?.id ?? "nadie"}
          grupo={g}
          personas={personas}
          pending={pending}
          onHecha={hecha}
          onPosponer={posponer}
          onPasar={(t, a) => pasarA([t.id], a)}
        />
      ))}
    </div>
  );
}

function TarjetaPersona({
  grupo,
  personas,
  pending,
  onHecha,
  onPosponer,
  onPasar,
}: {
  grupo: Grupo;
  personas: Persona[];
  pending: boolean;
  onHecha: (t: Fila) => void;
  onPosponer: (t: Fila, dias: number) => void;
  onPasar: (t: Fila, a: Persona) => void;
}) {
  const [todas, setTodas] = useState(false);
  const { abrir } = useTareaPeek();
  const lista = todas ? grupo.tareas : grupo.tareas.slice(0, VISIBLES);
  const masVieja = Math.max(...grupo.tareas.map((t) => t.diasAtraso));

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-baseline justify-between gap-2 border-b px-4 py-2.5">
          <p className="font-semibold">
            {grupo.persona?.nombre ?? "Sin asignar"}{" "}
            <span className="font-normal text-muted-foreground">· {grupo.tareas.length}</span>
          </p>
          <span className="text-xs text-muted-foreground">
            la más atrasada, {masVieja} {masVieja === 1 ? "día" : "días"}
          </span>
        </div>
        <ul>
          {lista.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 last:border-0">
              <span
                className={cn(
                  "w-12 shrink-0 text-right text-xs font-semibold tabular-nums",
                  t.diasAtraso > 14 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                )}
              >
                {t.diasAtraso} d
              </span>
              <button onClick={() => abrir(t.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium hover:underline">{t.titulo}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[formatTicket(t.numero), t.cliente, t.estado === "en_revision" ? "esperando aprobación" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {t.sugerido && (
                  <button
                    onClick={() => onPasar(t, t.sugerido!)}
                    disabled={pending}
                    title={`Pasársela a ${t.sugerido.nombre}`}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-300 px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-950"
                  >
                    <ArrowRight className="h-3 w-3" /> {t.sugerido.nombre.split(" ")[0]}
                  </button>
                )}
                <select
                  value=""
                  disabled={pending}
                  onChange={(e) => e.target.value && onPosponer(t, Number(e.target.value))}
                  title="Ponerle fecha nueva"
                  className="rounded-md border bg-background px-1.5 py-1 text-xs text-muted-foreground [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="">Nueva fecha</option>
                  <option value="1">Mañana</option>
                  <option value="3">En 3 días</option>
                  <option value="7">En una semana</option>
                </select>
                <select
                  value=""
                  disabled={pending}
                  onChange={(e) => {
                    const a = personas.find((p) => p.id === e.target.value);
                    if (a) onPasar(t, a);
                  }}
                  title="Pasársela a otra persona"
                  className="max-w-[7.5rem] rounded-md border bg-background px-1.5 py-1 text-xs text-muted-foreground [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="">Pasar a…</option>
                  {personas
                    .filter((p) => p.id !== grupo.persona?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => onHecha(t)}
                  disabled={pending}
                  title="Marcar como hecha"
                  className="rounded-md border p-1 text-muted-foreground hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {grupo.tareas.length > VISIBLES && (
          <button
            onClick={() => setTodas((v) => !v)}
            className="w-full border-t px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {todas ? "Ver menos" : `Ver las ${grupo.tareas.length - VISIBLES} restantes`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
