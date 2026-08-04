"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  saveAutoPublish,
  retryAutoPublish,
} from "@/app/(app)/contenidos/actions";

/** Mismo criterio que el publicador (VIDEO_EXT en lib/social/auto-publish). */
const esVideo = (nombre: string) => /\.(mp4|mov|m4v)$/i.test(nombre);

/** URL pública del bucket, igual que la que recibe Instagram. */
const publicUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/publish-media/${path}`;

export interface PublishMediaRef {
  path: string;
  name: string;
}

/**
 * Sección "Auto-publicación" del form de una pieza de Instagram:
 * subir archivos finales + activar que salga sola a su fecha/hora.
 */
export function PublicationAutoPublish({
  publicationId,
  initialAuto,
  initialMedia,
  publishedAt,
  publishError,
  igPermalink,
  fbPermalink = null,
  fbError = null,
}: {
  publicationId: string;
  initialAuto: boolean;
  initialMedia: PublishMediaRef[];
  publishedAt: string | null;
  publishError: string | null;
  igPermalink: string | null;
  fbPermalink?: string | null;
  fbError?: string | null;
}) {
  const [auto, setAuto] = useState(initialAuto);
  const [media, setMedia] = useState<PublishMediaRef[]>(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    auto !== initialAuto ||
    JSON.stringify(media) !== JSON.stringify(initialMedia);

  if (publishedAt) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-300/60 bg-emerald-50/40 p-2.5 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          Publicada automáticamente el{" "}
          {new Date(publishedAt).toLocaleString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </span>
        <span className="ml-auto inline-flex items-center gap-3">
          {igPermalink && (
            <a
              href={igPermalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Instagram
            </a>
          )}
          {fbPermalink && (
            <a
              href={fbPermalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Facebook
            </a>
          )}
          {!fbPermalink && fbError && (
            <span title={fbError} className="text-amber-600">
              FB no salió
            </span>
          )}
        </span>
      </div>
    );
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const next = [...media];
      for (const f of Array.from(files)) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${publicationId}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("publish-media")
          .upload(path, f, { upsert: false });
        if (error) throw new Error(`${f.name}: ${error.message}`);
        next.push({ path, name: f.name });
      }
      setMedia(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error subiendo el archivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // La portada es la imagen que acompaña a un video: Instagram la recorta al
  // cuadrado del medio para la grilla del perfil, así que conviene verlo antes.
  const portada = media.some((m) => esVideo(m.name))
    ? media.find((m) => !esVideo(m.name))
    : undefined;

  /** Mueve un archivo en la lista: el orden es el orden del carrusel. */
  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= media.length) return;
    const next = [...media];
    [next[i], next[j]] = [next[j], next[i]];
    setMedia(next);
  }

  function save() {
    start(async () => {
      const res = await saveAutoPublish(publicationId, {
        auto_publicar: auto,
        publish_media: media,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success(
        auto
          ? "Auto-publicación activada: sale sola a su fecha/hora si está aprobada."
          : "Auto-publicación guardada."
      );
    });
  }

  function retry() {
    start(async () => {
      const res = await retryAutoPublish(publicationId);
      if (res?.error) return void toast.error(res.error);
      toast.success("Listo: se reintenta en la próxima corrida.");
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        Publicar automáticamente (Instagram + Facebook)
      </label>
      <p className="text-[11px] text-muted-foreground">
        Sale sola a la fecha/hora de la pieza cuando está <b>Aprobada</b> y
        tiene el archivo final subido (el copy y hashtags del form van de
        caption). Se publica en Instagram y se replica en la página de
        Facebook del cliente. TikTok se suma cuando su app apruebe la revisión.
        <br />
        <b>Varias fotos</b> = carrusel, en el orden en que las subas (hasta 10).{" "}
        <b>Reel con portada</b>: subí el video y además una imagen — esa imagen
        se usa como portada; si no, Instagram elige un cuadro al azar.
      </p>

      {publishError && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-red-300/60 bg-red-50/50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          <span className="min-w-0 flex-1">⚠️ {publishError}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={retry}
            disabled={pending}
            className="h-7 gap-1 text-xs"
          >
            <RefreshCw className="h-3 w-3" /> Reintentar
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="h-8 gap-1.5"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Subir archivo final
        </Button>
        {dirty && (
          <Button size="sm" onClick={save} disabled={pending} className="h-8">
            {pending ? "Guardando…" : "Guardar auto-publicación"}
          </Button>
        )}
      </div>

      {media.length > 0 && (
        <ul className="space-y-1">
          {media.map((m, i) => (
            <li
              key={m.path}
              className="flex items-center gap-2 rounded border bg-card px-2 py-1 text-xs"
            >
              <span className="w-4 shrink-0 text-muted-foreground">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              {esVideo(m.name) ? (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  video
                </span>
              ) : media.some((x) => esVideo(x.name)) ? (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  portada
                </span>
              ) : null}
              {/* El navegador entrega los archivos en orden alfabético, no en el
                  orden en que se clickean: sin estas flechas el carrusel sale
                  en un orden que nadie eligió. */}
              <button
                type="button"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Subir"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => mover(i, 1)}
                disabled={i === media.length - 1}
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Bajar"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMedia(media.filter((x) => x.path !== m.path))}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                title="Quitar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {portada && <PreviewPortada url={publicUrl(portada.path)} />}
    </div>
  );
}

/**
 * Cómo va a verse la portada del reel en los dos lugares donde aparece.
 *
 * Instagram muestra la portada completa (9:16) en la solapa de Reels, pero en
 * la **grilla del perfil** recorta el cuadrado del medio, y eso no se puede
 * cambiar por API — no hay parámetro para mover el recorte, siempre agarra el
 * centro. Por eso lo mostramos: es la única forma de que quien diseña la
 * portada vea qué se va a perder antes de publicar, en vez de descubrirlo con
 * el reel ya arriba.
 */
function PreviewPortada({ url }: { url: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="mb-1.5 text-[11px] font-medium">Cómo va a quedar la portada</p>
      <div className="flex items-start gap-3">
        <figure className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Portada completa"
            className="h-28 w-[63px] rounded border object-cover"
          />
          <figcaption className="mt-0.5 text-center text-[10px] text-muted-foreground">
            en Reels
          </figcaption>
        </figure>
        <figure className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Recorte cuadrado de la grilla"
            className="h-[63px] w-[63px] rounded border object-cover"
          />
          <figcaption className="mt-0.5 text-center text-[10px] text-muted-foreground">
            en la grilla
          </figcaption>
        </figure>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          En la grilla del perfil, Instagram recorta <b>el cuadrado del medio</b> y
          eso no se puede mover desde la app. Si lo importante (logo, cara, texto)
          queda centrado en la portada, se ve bien en los dos lados. Medida ideal:
          1080 × 1920.
        </p>
      </div>
    </div>
  );
}
