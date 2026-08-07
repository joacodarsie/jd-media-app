"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ExternalLink, Loader2, X, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  aplicarSeguras,
  confirmarCruce,
  descartarCruce,
  crearPiezaDesdePosteo,
  marcarNoPublicada,
} from "@/app/(app)/contenidos/salio/actions";

export interface CuentaConciliada {
  clienteId: string;
  clienteNombre: string;
  fechaSnapshot: string | null;
  nota: string | null;
  resumen: {
    salieron: number;
    enFecha: number;
    tarde: number;
    antes: number;
    sinPieza: number;
    fantasmas: number;
  };
  aplicables: {
    piezaId: string;
    titulo: string;
    permalink: string | null;
    fechaReal: string | null;
    fechaPlan: string | null;
    diasDiferencia: number | null;
    motivo: string;
  }[];
  dudosos: {
    piezaId: string;
    titulo: string;
    mediaId: string;
    permalink: string | null;
    fechaReal: string | null;
    fechaPlan: string | null;
    motivo: string;
    score: number;
  }[];
  sinPieza: {
    id: string;
    caption: string | null;
    media_type: string;
    permalink: string | null;
    timestamp: string | null;
  }[];
  fantasmas: { piezaId: string; titulo: string; fechaPlan: string | null }[];
}

function desfase(dias: number | null): { txt: string; clase: string } | null {
  if (dias == null) return null;
  if (dias === 0)
    return { txt: "en fecha", clase: "text-emerald-700 dark:text-emerald-300" };
  if (dias > 0)
    return {
      txt: `${dias} día${dias === 1 ? "" : "s"} tarde`,
      clase: "text-amber-700 dark:text-amber-300",
    };
  return {
    txt: `${-dias} día${dias === -1 ? "" : "s"} antes`,
    clase: "text-muted-foreground",
  };
}

/**
 * Panel de conciliación por cuenta. Todo se resuelve con un clic: la idea es
 * que nadie tenga que abrir la pieza, copiar el link y editar el estado a mano
 * — ese trabajo manual es justamente el que nunca se hace.
 */
export function ConciliacionPanel({ cuentas }: { cuentas: CuentaConciliada[] }) {
  return (
    <div className="space-y-4">
      {cuentas.map((c) => (
        <TarjetaCuenta key={c.clienteId} cuenta={c} />
      ))}
    </div>
  );
}

function TarjetaCuenta({ cuenta: c }: { cuenta: CuentaConciliada }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);

  const hayAlgo =
    c.aplicables.length + c.dudosos.length + c.sinPieza.length + c.fantasmas.length > 0;

  async function correr(clave: string, fn: () => Promise<{ ok?: boolean; error?: string }>, msg: string) {
    setOcupado(clave);
    const r = await fn();
    setOcupado(null);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(msg);
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">{c.clienteNombre}</h2>
          <p className="text-xs text-muted-foreground">
            {c.resumen.salieron} publicaci{c.resumen.salieron === 1 ? "ón" : "ones"} este
            mes en Instagram · {c.resumen.enFecha} en fecha
            {c.resumen.tarde > 0 && ` · ${c.resumen.tarde} tarde`}
            {c.fechaSnapshot && ` · datos al ${c.fechaSnapshot}`}
          </p>
        </div>
        {c.aplicables.length > 0 && (
          <Button
            size="sm"
            disabled={ocupado !== null}
            onClick={() =>
              correr(
                "aplicar",
                () => aplicarSeguras(c.clienteId, c.clienteNombre),
                `Listo: ${c.aplicables.length} pieza${c.aplicables.length === 1 ? "" : "s"} marcada${c.aplicables.length === 1 ? "" : "s"} como publicada${c.aplicables.length === 1 ? "" : "s"}.`,
              )
            }
          >
            {ocupado === "aplicar" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-1 h-4 w-4" />
            )}
            Marcar las {c.aplicables.length} seguras
          </Button>
        )}
      </div>

      {c.nota && (
        <p className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">{c.nota}</p>
      )}

      {!hayAlgo && !c.nota && (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          El calendario coincide con lo que salió. Nada para corregir.
        </p>
      )}

      {c.aplicables.length > 0 && (
        <Seccion titulo="Salieron y el calendario no se enteró" tono="ok">
          {c.aplicables.map((m) => {
            const d = desfase(m.diasDiferencia);
            return (
              <Fila
                key={m.piezaId}
                titulo={m.titulo}
                detalle={
                  <>
                    {m.fechaPlan && <>planificada {m.fechaPlan}</>}
                    {m.fechaReal && <> · salió {m.fechaReal}</>}
                    {d && <> · <span className={d.clase}>{d.txt}</span></>}
                    {m.motivo === "id" && <> · publicada por la app</>}
                  </>
                }
                permalink={m.permalink}
              />
            );
          })}
        </Seccion>
      )}

      {c.dudosos.length > 0 && (
        <Seccion titulo="Puede ser, confirmá vos" tono="duda">
          {c.dudosos.map((m) => (
            <Fila
              key={`${m.piezaId}::${m.mediaId}`}
              titulo={m.titulo}
              detalle={
                <>
                  {m.fechaPlan && <>planificada {m.fechaPlan}</>}
                  {m.fechaReal && <> · posteo del {m.fechaReal}</>}
                  {m.motivo === "fecha" ? " · coincide la fecha" : " · el texto se parece"}
                </>
              }
              permalink={m.permalink}
              acciones={
                <>
                  <IconBtn
                    label="Sí, es esta"
                    disabled={ocupado !== null}
                    cargando={ocupado === `si-${m.piezaId}`}
                    onClick={() =>
                      correr(
                        `si-${m.piezaId}`,
                        () =>
                          confirmarCruce(m.piezaId, m.titulo, m.mediaId, m.permalink, c.clienteId),
                        "Marcada como publicada.",
                      )
                    }
                    tono="ok"
                    icono={<Check className="h-4 w-4" />}
                  />
                  <IconBtn
                    label="No es esta"
                    disabled={ocupado !== null}
                    cargando={ocupado === `no-${m.piezaId}`}
                    onClick={() =>
                      correr(
                        `no-${m.piezaId}`,
                        () => descartarCruce(c.clienteId, m.piezaId, m.mediaId),
                        "Descartado: no vuelve a proponerse.",
                      )
                    }
                    tono="neutral"
                    icono={<X className="h-4 w-4" />}
                  />
                </>
              }
            />
          ))}
        </Seccion>
      )}

      {c.sinPieza.length > 0 && (
        <Seccion titulo="Salió en Instagram y no está en el calendario" tono="neutral">
          {c.sinPieza.map((m) => (
            <Fila
              key={m.id}
              titulo={(m.caption?.split("\n")[0] || "Posteo sin texto").slice(0, 80)}
              detalle={
                <>
                  {m.timestamp?.slice(0, 10)} ·{" "}
                  {m.media_type === "VIDEO"
                    ? "reel"
                    : m.media_type === "CAROUSEL_ALBUM"
                      ? "carrusel"
                      : "post"}
                </>
              }
              permalink={m.permalink}
              acciones={
                <>
                  <IconBtn
                    label="Sumarlo al calendario"
                    disabled={ocupado !== null}
                    cargando={ocupado === `add-${m.id}`}
                    onClick={() =>
                      correr(
                        `add-${m.id}`,
                        () => crearPiezaDesdePosteo(c.clienteId, m),
                        "Registrado en el calendario como publicado.",
                      )
                    }
                    tono="ok"
                    icono={<Plus className="h-4 w-4" />}
                  />
                  <IconBtn
                    label="No es contenido nuestro"
                    disabled={ocupado !== null}
                    cargando={ocupado === `skip-${m.id}`}
                    onClick={() =>
                      correr(
                        `skip-${m.id}`,
                        () => descartarCruce(c.clienteId, null, m.id),
                        "Listo, no vuelve a aparecer.",
                      )
                    }
                    tono="neutral"
                    icono={<X className="h-4 w-4" />}
                  />
                </>
              }
            />
          ))}
        </Seccion>
      )}

      {c.fantasmas.length > 0 && (
        <Seccion titulo="Dice publicado y en Instagram no está" tono="mal">
          {c.fantasmas.map((f) => (
            <Fila
              key={f.piezaId}
              titulo={f.titulo}
              detalle={<>figura publicada el {f.fechaPlan}</>}
              permalink={null}
              acciones={
                <>
                  <Link
                    href={`/contenidos?cliente=${c.clienteId}`}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  >
                    Ver en el calendario
                  </Link>
                  <IconBtn
                    label="No salió: volver a Aprobado"
                    disabled={ocupado !== null}
                    cargando={ocupado === `ghost-${f.piezaId}`}
                    onClick={() =>
                      correr(
                        `ghost-${f.piezaId}`,
                        () => marcarNoPublicada(f.piezaId, c.clienteId),
                        "Vuelve a figurar como pendiente de publicar.",
                      )
                    }
                    tono="neutral"
                    icono={<AlertTriangle className="h-4 w-4" />}
                  />
                </>
              }
            />
          ))}
        </Seccion>
      )}
    </div>
  );
}

function Seccion({
  titulo,
  tono,
  children,
}: {
  titulo: string;
  tono: "ok" | "duda" | "mal" | "neutral";
  children: React.ReactNode;
}) {
  const clase =
    tono === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tono === "duda"
        ? "text-amber-700 dark:text-amber-300"
        : tono === "mal"
          ? "text-red-700 dark:text-red-300"
          : "text-muted-foreground";
  return (
    <div className="border-b px-4 py-3 last:border-b-0">
      <p className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${clase}`}>{titulo}</p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function Fila({
  titulo,
  detalle,
  permalink,
  acciones,
}: {
  titulo: string;
  detalle: React.ReactNode;
  permalink: string | null;
  acciones?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {permalink && (
          <a
            href={permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Ver posteo
          </a>
        )}
        {acciones}
      </div>
    </li>
  );
}

function IconBtn({
  label,
  icono,
  onClick,
  disabled,
  cargando,
  tono,
}: {
  label: string;
  icono: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  cargando?: boolean;
  tono: "ok" | "neutral";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
        tono === "ok"
          ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-950"
          : "hover:bg-accent"
      }`}
    >
      {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icono}
      {label}
    </button>
  );
}
