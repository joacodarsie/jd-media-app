"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PenLine } from "lucide-react";
import { changePublicationStatus } from "@/app/(app)/contenidos/actions";
import {
  estadoAlElegirEtapa,
  etapaDe,
  ETAPAS,
  ETAPA_AYUDA,
  ETAPA_HEX,
  ETAPA_LABEL,
  tieneCorrecciones,
  type Etapa,
} from "@/lib/contenidos/etapas";
import { PUBLICATION_STATUS_LABEL } from "@/lib/constants";
import type { PublicationStatus, Publication } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { tiposQuePidenLink } from "@/lib/contenidos/link-publicado";

/**
 * En qué etapa está la pieza.
 *
 * Antes este select tenía los NUEVE estados de la base y el equipo usaba dos:
 * al 20/9 había 129 piezas en "idea", 377 en "publicado" y cero en "en diseño".
 * Ahora ofrece las cuatro etapas de `lib/contenidos/etapas` y la app traduce a
 * qué estado fino corresponde —producir un posteo es diseñarlo y producir un
 * reel es editarlo—, que es lo que nadie iba a elegir bien a mano.
 */
export function PublicationStatusSelect({
  publication,
  className,
  size = "sm",
}: {
  publication: Pick<Publication, "id" | "estado"> & { tipo?: string | null };
  className?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingNote, setPendingNote] = useState<"publicado" | "rechazado" | null>(null);
  const [notes, setNotes] = useState("");
  const [linkPosteo, setLinkPosteo] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  // Estado local optimista: refleja el estado mostrado en el SelectTrigger
  // sin esperar a que el padre rerenderice tras router.refresh().
  const [localEstado, setLocalEstado] = useState<PublicationStatus>(publication.estado);

  useEffect(() => {
    setLocalEstado(publication.estado);
  }, [publication.estado]);

  const etapaActual: Etapa = etapaDe(localEstado);
  const conCorrecciones = tieneCorrecciones(localEstado);

  function apply(target: PublicationStatus, finalNote?: string, link?: string) {
    setInlineError(null);
    start(async () => {
      try {
        const res = await changePublicationStatus(
          publication.id,
          target,
          finalNote,
          link ?? null
        );
        if (res?.error) {
          const msg = "No se pudo cambiar: " + res.error;
          setInlineError(msg);
          toast.error(msg);
          return;
        }
        setLocalEstado(target);
        toast.success(
          target === "rechazado"
            ? "Cambios pedidos."
            : "Etapa: " + ETAPA_LABEL[etapaDe(target)]
        );
        setPendingNote(null);
        setNotes("");
        setLinkPosteo("");
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        setInlineError(msg);
        toast.error(msg);
      }
    });
  }

  function onChange(value: string) {
    const destino = estadoAlElegirEtapa(value as Etapa, localEstado, publication.tipo);
    if (!destino) return;
    // "Publicado" pide el link del posteo: se abre un campito abajo en vez de
    // un diálogo. Las historias no tienen link fijo (duran 24 h).
    if (destino === "publicado" && tiposQuePidenLink(publication.tipo)) {
      setPendingNote("publicado");
      setInlineError(null);
      return;
    }
    apply(destino);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Select
        key={localEstado}
        value={etapaActual}
        onValueChange={onChange}
        disabled={pending}
      >
        <SelectTrigger
          style={{ backgroundColor: ETAPA_HEX[etapaActual] + "2e" }}
          className={cn(
            "w-full border-0 font-medium text-foreground",
            size === "sm" ? "h-8 text-xs" : "h-9 text-sm"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ETAPAS.map((e) => (
            <SelectItem key={e} value={e}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ETAPA_HEX[e] }}
                />
                <span>
                  {ETAPA_LABEL[e]}
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                    {ETAPA_AYUDA[e]}
                  </span>
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* La marca de correcciones: la etapa dice "Produciendo" y esto dice por
          qué volvió. Antes era un estado propio y sacaba la pieza del flujo. */}
      {conCorrecciones && !pendingNote && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Volvió con correcciones. Mirá las notas de revisión.
        </p>
      )}

      {!pendingNote && localEstado !== "publicado" && (
        <button
          type="button"
          onClick={() => {
            setPendingNote("rechazado");
            setInlineError(null);
          }}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <PenLine className="h-3 w-3" /> Pedir cambios
        </button>
      )}

      {pendingNote === "publicado" && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2">
          <p className="text-xs font-medium">
            Pegá el link del posteo para marcarla publicada:
          </p>
          <input
            autoFocus
            value={linkPosteo}
            onChange={(e) => setLinkPosteo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && linkPosteo.trim() && !pending) {
                apply("publicado", undefined, linkPosteo);
              }
            }}
            placeholder="https://www.instagram.com/p/…"
            className="w-full rounded-md border bg-background p-2 text-xs"
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Sirve para abrir el posteo de una y para medir qué repercusión tuvo en el
            informe del cliente.
          </p>
          {inlineError && (
            <p className="rounded bg-red-100 px-2 py-1 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {inlineError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingNote(null);
                setLinkPosteo("");
                setInlineError(null);
              }}
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => apply("publicado", undefined, linkPosteo)}
              disabled={pending || !linkPosteo.trim()}
              className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Marcar publicada
            </button>
          </div>
        </div>
      )}

      {pendingNote === "rechazado" && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2">
          <p className="text-xs font-medium">
            Contá qué hay que ajustar. Le llega a quien la está haciendo:
          </p>
          <textarea
            rows={2}
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: cambiar el copy del primer slide, color del fondo más oscuro…"
            className="w-full rounded-md border bg-background p-2 text-xs"
            disabled={pending}
          />
          {inlineError && (
            <p className="rounded bg-red-100 px-2 py-1 text-[11px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {inlineError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingNote(null);
                setNotes("");
                setInlineError(null);
              }}
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!notes.trim()) {
                  toast.error("Dejá una nota.");
                  return;
                }
                apply("rechazado", notes);
              }}
              disabled={pending || !notes.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending && <Loader2 className="h-3 w-3 animate-spin" />}
              {pending ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {/* El estado fino, chiquito: sirve para entender de dónde viene una pieza
          vieja sin volver a llenar la pantalla de casilleros. */}
      {PUBLICATION_STATUS_LABEL[localEstado] !== ETAPA_LABEL[etapaActual] && (
        <p className="text-[10px] text-muted-foreground">
          {PUBLICATION_STATUS_LABEL[localEstado]}
        </p>
      )}
    </div>
  );
}
