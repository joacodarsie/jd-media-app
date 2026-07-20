"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
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
}: {
  publicationId: string;
  initialAuto: boolean;
  initialMedia: PublishMediaRef[];
  publishedAt: string | null;
  publishError: string | null;
  igPermalink: string | null;
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
        {igPermalink && (
          <a
            href={igPermalink}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Ver en Instagram
          </a>
        )}
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
        Publicar automáticamente en Instagram
      </label>
      <p className="text-[11px] text-muted-foreground">
        Sale sola a la fecha/hora de la pieza cuando está <b>Aprobada</b> y
        tiene el archivo final subido (el copy y hashtags del form van de
        caption). Carrusel: subí las imágenes en orden.
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
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              <button
                type="button"
                onClick={() => setMedia(media.filter((x) => x.path !== m.path))}
                className="text-muted-foreground hover:text-destructive"
                title="Quitar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
