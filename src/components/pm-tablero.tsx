"use client";

/**
 * El tablero de la Project Manager (20/10/2026): una tarjeta por cuenta nueva
 * con lo que hay que hacer hoy arriba (preguntas Sí/No y pasos atrasados) y,
 * más abajo, lo pausado y lo que viene. Ver lib/pm/tablero.ts.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Check, ChevronDown, Loader2, X } from "lucide-react";
import { FechaReunionOnboarding } from "@/components/fecha-reunion-onboarding";
import { cn } from "@/lib/utils";
import type { CuentaPm, PasoPm, PreguntaPm } from "@/lib/pm/tablero";
import { avisarPasoAtrasado, responderPregunta } from "@/app/(app)/onboarding/actions";
import { TrabadaBoton } from "@/components/trabada-boton";

const PILL = {
  ok: { txt: "Bien", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  atento: { txt: "Atento", cls: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  mal: { txt: "En riesgo", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
} as const;
const PUNTO = { ok: "bg-emerald-500", atento: "bg-amber-500", mal: "bg-rose-500" } as const;

const ddmm = (ymd: string | null) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}` : "sin fecha");

export function PmTablero({ cuentas }: { cuentas: CuentaPm[] }) {
  if (!cuentas.length)
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">No hay cuentas nuevas con gestión de redes.</div>;
  return (
    // Una fila por cuenta que se abre (24/10/2026, pedido del dueño: menos de una).
    <div className="jd-cascada divide-y overflow-hidden rounded-2xl border bg-card">
      {cuentas.map((c) => (
        <Tarjeta key={c.id} c={c} />
      ))}
    </div>
  );
}

function Tarjeta({ c }: { c: CuentaPm }) {
  const pct = c.arranque && c.arranque.total ? Math.round((c.arranque.hechos / c.arranque.total) * 100) : null;
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.location.hash.endsWith(c.id)) ref.current.open = true;
  }, [c.id]);
  return (
    <details ref={ref} id={`cuenta-${c.id}`} className="group scroll-mt-24">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", PUNTO[c.estado])} aria-label={PILL[c.estado].txt} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{c.nombre}</div>
          <div className="text-xs text-muted-foreground">
            Día {c.dia} · {c.mes === 1 ? "primer mes" : `mes ${c.mes}`}
            {c.arranque && !c.arranque.terminado ? ` · arranque ${c.arranque.hechos}/${c.arranque.total}` : ""}
          </div>
        </div>
        {c.preguntas.length > 0 && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            {c.preguntas.length} para responder
          </span>
        )}
        {c.atrasados.length > 0 && (
          <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
            {c.atrasados.length} atrasado{c.atrasados.length === 1 ? "" : "s"}
          </span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="border-t bg-muted/10 px-4 pb-4 pt-1">
      <Link href={`/clientes/${c.id}`} className="mt-2 inline-block text-xs text-primary hover:underline">
        Ver la ficha de {c.nombre} →
      </Link>

      {c.arranque && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {c.arranque.terminado ? "Arranque terminado" : `Arranque de 15 días · ${c.arranque.hechos} de ${c.arranque.total} pasos`}
            </span>
            {c.atrasados.length > 0 && (
              <a href={`#atrasados-${c.id}`} className="font-semibold text-rose-600 hover:underline dark:text-rose-400">
                {c.atrasados.length === 1 ? "1 atrasado" : `${c.atrasados.length} atrasados`} →
              </a>
            )}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct ?? 0}%` }} />
          </div>
          {/* El día de la reunión de onboarding (pedido de Luz, 19/10): el arranque cuenta desde ahí.
              Se había perdido al rehacer esta pantalla el 20/10; vuelve adentro de cada cuenta (22/10). */}
          {!c.arranque.terminado && (
            <div className="mt-2">
              <FechaReunionOnboarding clienteId={c.id} fecha={c.arranque.fechaInicio} marcada={c.arranque.reunionMarcada} />
            </div>
          )}
        </div>
      )}

      {c.chequeos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {c.chequeos.map((q) => (
            <li key={q.clave} className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", PUNTO[q.estado])} />
              <span className="text-muted-foreground">{q.label}:</span>
              <span className={cn(q.estado === "mal" && "font-medium")}>{q.detalle}</span>
            </li>
          ))}
        </ul>
      )}

      {c.preguntas.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Para responder hoy</h3>
          {c.preguntas.map((p) => (
            <Pregunta key={p.id} p={p} />
          ))}
        </div>
      )}

      {c.atrasados.length > 0 && (
        <div id={`atrasados-${c.id}`} className="mt-4 scroll-mt-24 space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Atrasados</h3>
          <ListaCorta pasos={c.atrasados} atrasado />
        </div>
      )}

      {c.pausados.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">En pausa · esperando al cliente</h3>
          {c.pausados.map((p) => (
            <FilaPaso key={p.id} p={p} pausado />
          ))}
        </div>
      )}

      {c.pendientesHoy === 0 && c.pausados.length === 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Al día: nada para hacer hoy en esta cuenta.
        </p>
      )}

      {c.proximos.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /> Lo que viene ({c.proximos.length})
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {c.proximos.map((p) => (
              <FilaPaso key={p.id} p={p} />
            ))}
          </div>
        </details>
      )}
      </div>
    </details>
  );
}

function FilaPaso({ p, atrasado, pausado }: { p: PasoPm; atrasado?: boolean; pausado?: boolean }) {
  const [enviando, empezar] = useTransition();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm",
        atrasado && "border-rose-300/60 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20",
        pausado && "border-orange-300/60 bg-orange-50/40 dark:border-orange-900/50 dark:bg-orange-950/20"
      )}
    >
      <Link href={`/tareas/${p.id}`} className="min-w-0 basis-full font-medium hover:underline sm:basis-0 sm:flex-1">
        {p.titulo}
        {pausado && p.detallePausa && <span className="block text-xs font-normal text-muted-foreground">Falta: {p.detallePausa}</span>}
      </Link>
      <span className="text-xs text-muted-foreground">
        {p.responsable?.split(" ")[0] ?? "Sin responsable"} · {atrasado ? `venció el ${ddmm(p.vence)}` : ddmm(p.vence)}
      </span>
      {(atrasado || pausado) && (
        <span className="flex items-center gap-1.5">
          {atrasado && p.responsableId && (
            <button
              type="button"
              disabled={enviando}
              onClick={() =>
                empezar(async () => {
                  const r = await avisarPasoAtrasado(p.id);
                  if ("error" in r && r.error) toast.error(r.error);
                  else toast.success(`Le avisamos a ${p.responsable?.split(" ")[0] ?? "quien la tiene"}.`);
                })
              }
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium hover:bg-muted"
            >
              {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />} Avisar
            </button>
          )}
          <TrabadaBoton taskId={p.id} titulo={p.titulo} bloqueo={pausado ? "cliente" : null} texto="Pausar" />
        </span>
      )}
    </div>
  );
}

function Pregunta({ p }: { p: PreguntaPm }) {
  const router = useRouter();
  const [pidiendo, setPidiendo] = useState(false);
  const [detalle, setDetalle] = useState("");
  const [enviando, empezar] = useTransition();
  const responder = (r: "si" | "no") =>
    empezar(async () => {
      const res = await responderPregunta(p.id, r, detalle);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(
        "pausada" in res && res.pausada
          ? "En pausa esperando al cliente: lo ve en su plataforma."
          : p.tipo === "jornada" && r === "si"
            ? "Listo: te armamos la tarea para coordinar la jornada."
            : "Respondida."
      );
      router.refresh();
    });
  // Al material que no llegó le pedimos qué falta: es lo que lee el cliente.
  const noPideDetalle = p.tipo === "material";
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{p.pregunta}</p>
          <p className="text-xs text-muted-foreground">Día {p.dia} del arranque{p.vence ? ` · ${ddmm(p.vence)}` : ""}</p>
        </div>
        {!pidiendo && (
          <div className="flex gap-1.5">
            <button type="button" disabled={enviando} onClick={() => responder("si")} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
              <Check className="h-3.5 w-3.5" /> Sí
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => (noPideDetalle ? setPidiendo(true) : responder("no"))}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> No
            </button>
          </div>
        )}
      </div>
      {pidiendo && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            autoFocus
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="¿Qué falta? Lo va a leer el cliente (ej.: los videos del local)"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
          />
          <button type="button" disabled={enviando} onClick={() => responder("no")} className="rounded-md bg-orange-600 px-3 text-xs font-semibold text-white hover:bg-orange-700">
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pausar: lo ve el cliente"}
          </button>
          <button type="button" onClick={() => setPidiendo(false)} className="text-xs text-muted-foreground hover:underline">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

/** Los atrasados de a 4: con 9 la tarjeta se vuelve una lista eterna. */
function ListaCorta({ pasos, atrasado }: { pasos: PasoPm[]; atrasado?: boolean }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? pasos : pasos.slice(0, 4);
  return (
    <>
      {visibles.map((p) => (
        <FilaPaso key={p.id} p={p} atrasado={atrasado} />
      ))}
      {pasos.length > 4 && (
        <button type="button" onClick={() => setTodos(!todos)} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
          {todos ? "Ver menos" : `Ver los ${pasos.length}`}
        </button>
      )}
    </>
  );
}
