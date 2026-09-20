"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  ExternalLink,
  Loader2,
  PenLine,
  ThumbsUp,
} from "lucide-react";
import {
  aprobarIdeasEnBloque,
  aprobarPieza,
  corregirPieza,
} from "@/app/(app)/contenidos/actions";
import { bandejaDeAprobacion, tieneArchivo } from "@/lib/contenidos/aprobacion";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_TYPE_LABEL,
} from "@/lib/constants";
import type { PublicationWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * La bandeja de aprobación del mes.
 *
 * Pedido de Luz (20/9): aprobar el calendario entero de una cuenta de un saque
 * y no pieza por pieza. Son dos bloques porque son dos decisiones distintas:
 * primero se aprueban las IDEAS (antes de que nadie diseñe) y después las
 * PIEZAS TERMINADAS (antes de que salgan al cliente). Para lo segundo el link
 * del Drive o del Canva es obligatorio: aprobar algo que no se puede abrir no
 * es aprobar.
 *
 * Las dos cosas se resuelven sin salir de la fila: aprobar es un clic y
 * corregir es escribir dos líneas ahí mismo.
 */
export function AprobacionMes({
  pubs,
  mesLabel,
  clienteNombre,
  pendientesFuera,
}: {
  /** Las piezas del mes y la cuenta que se están mirando. */
  pubs: PublicationWithRels[];
  mesLabel: string;
  clienteNombre: string | null;
  /** Cuántas piezas esperan decisión fuera de este mes. */
  pendientesFuera: number;
}) {
  const router = useRouter();
  const [, refrescar] = useTransition();
  const [bloque, setBloque] = useState(false);

  const { ideas, terminadas } = useMemo(() => bandejaDeAprobacion(pubs), [pubs]);
  const total = ideas.length + terminadas.length;

  function aprobarTodasLasIdeas() {
    setBloque(true);
    aprobarIdeasEnBloque(ideas.map((p) => p.id))
      .then((res) => {
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        const n = "aprobadas" in res ? res.aprobadas : ideas.length;
        toast.success(
          `${n} idea${n === 1 ? "" : "s"} aprobada${n === 1 ? "" : "s"}. Ya están en producción.`
        );
        refrescar(() => router.refresh());
      })
      .finally(() => setBloque(false));
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <ThumbsUp className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
        <p className="text-sm font-medium">
          No hay nada esperando tu aprobación en {mesLabel}
          {clienteNombre ? ` de ${clienteNombre}` : ""}.
        </p>
        {pendientesFuera > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Hay {pendientesFuera} pieza{pendientesFuera === 1 ? "" : "s"} esperando en otros meses:
            cambiá de mes con las flechas.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendientesFuera > 0 && (
        <p className="text-xs text-muted-foreground">
          Además hay {pendientesFuera} pieza{pendientesFuera === 1 ? "" : "s"} esperando decisión en
          otros meses.
        </p>
      )}

      <Bloque
        titulo="Ideas para aprobar"
        bajada="Todavía no las diseñó nadie: corregir acá no cuesta nada."
        vacio="Ninguna idea pendiente en este mes."
        cantidad={ideas.length}
        accion={
          ideas.length > 1 ? (
            <Button size="sm" onClick={aprobarTodasLasIdeas} disabled={bloque}>
              {bloque ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-1.5 h-4 w-4" />
              )}
              Aprobar las {ideas.length}
            </Button>
          ) : null
        }
      >
        {ideas.map((p) => (
          <FilaAprobacion key={p.id} pub={p} pideArchivo={false} />
        ))}
      </Bloque>

      <Bloque
        titulo="Diseños y videos para aprobar"
        bajada="Lo último antes de que salga al cliente. Va con el link del Drive o del Canva."
        vacio="Ninguna pieza terminada esperando en este mes."
        cantidad={terminadas.length}
      >
        {terminadas.map((p) => (
          <FilaAprobacion key={p.id} pub={p} pideArchivo />
        ))}
      </Bloque>
    </div>
  );
}

function Bloque({
  titulo,
  bajada,
  vacio,
  cantidad,
  accion,
  children,
}: {
  titulo: string;
  bajada: string;
  vacio: string;
  cantidad: number;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">
            {titulo} <span className="font-normal text-muted-foreground">({cantidad})</span>
          </h3>
          <p className="text-xs text-muted-foreground">{bajada}</p>
        </div>
        {accion}
      </div>
      {cantidad === 0 ? (
        <p className="px-4 py-4 text-xs text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}

function FilaAprobacion({
  pub,
  pideArchivo,
}: {
  pub: PublicationWithRels;
  pideArchivo: boolean;
}) {
  const router = useRouter();
  const [, refrescar] = useTransition();
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [nota, setNota] = useState("");
  const [link, setLink] = useState(pub.asset_url ?? "");
  const [guardando, setGuardando] = useState<"aprobar" | "corregir" | null>(null);

  const notas = (pub as { notas_revision?: string | null }).notas_revision ?? null;
  const listoParaAprobar = !pideArchivo || !!link.trim() || tieneArchivo(pub);

  function aprobar() {
    setGuardando("aprobar");
    aprobarPieza(pub.id, pideArchivo ? link : undefined)
      .then((res) => {
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success(
          pideArchivo
            ? "Aprobada. Va al Drive del cliente."
            : "Idea aprobada. Ya está en producción."
        );
        refrescar(() => router.refresh());
      })
      .finally(() => setGuardando(null));
  }

  function corregir() {
    setGuardando("corregir");
    corregirPieza(pub.id, nota)
      .then((res) => {
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Correcciones mandadas. Le llega un aviso a quien la hizo.");
        setCorrigiendo(false);
        setNota("");
        refrescar(() => router.refresh());
      })
      .finally(() => setGuardando(null));
  }

  const dia = pub.fecha_publicacion
    ? `${pub.fecha_publicacion.slice(8, 10)}/${pub.fecha_publicacion.slice(5, 7)}`
    : "sin fecha";
  const texto = pub.copy?.trim() || pub.descripcion?.trim() || pub.guion?.trim() || "";

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
          {dia}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{pub.titulo}</p>
          <p className="text-[11px] text-muted-foreground">
            {PUBLICATION_TYPE_LABEL[pub.tipo]} · {PUBLICATION_NETWORK_LABEL[pub.red]}
            {pub.cliente ? ` · ${pub.cliente.nombre}` : ""}
          </p>
          {texto && (
            <p className="line-clamp-4 whitespace-pre-line text-xs text-muted-foreground">
              {texto}
            </p>
          )}
          {notas && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Correcciones pedidas: {notas}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            onClick={aprobar}
            disabled={guardando !== null || !listoParaAprobar}
            title={
              listoParaAprobar
                ? "Aprobar"
                : "Cargá el link del Drive o del Canva para poder aprobar"
            }
            className="gap-1.5"
          >
            {guardando === "aprobar" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Aprobar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCorrigiendo((v) => !v)}
            disabled={guardando !== null}
            className="gap-1.5"
          >
            <PenLine className="h-3.5 w-3.5" />
            Corregir
          </Button>
        </div>
      </div>

      {pideArchivo && (
        <div className="flex items-center gap-1.5 pl-[4.25rem]">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link del Drive o del Canva con la pieza terminada…"
            className={cn("h-8 text-xs", !link.trim() && "border-amber-400")}
          />
          {link.trim() && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 shrink-0 items-center rounded-md border px-2 text-muted-foreground hover:bg-muted"
              title="Abrir la pieza"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      )}

      {corrigiendo && (
        <div className="space-y-2 pl-[4.25rem]">
          <textarea
            rows={2}
            autoFocus
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Qué hay que corregir. Ej: el hook no engancha, cambiar el copy de la placa 1, el fondo más oscuro…"
            className="w-full rounded-md border bg-background p-2 text-xs"
            disabled={guardando !== null}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCorrigiendo(false);
                setNota("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <Button size="sm" onClick={corregir} disabled={guardando !== null || !nota.trim()}>
              {guardando === "corregir" && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Mandar correcciones
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
