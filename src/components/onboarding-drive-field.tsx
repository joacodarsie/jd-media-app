"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  FolderPlus,
  Loader2,
  Save,
  Sparkles,
  PlugZap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  autoCreateClientDrive,
  setClientDriveUrl,
} from "@/app/(app)/clientes/[id]/onboarding/actions";

const SUBFOLDERS = ["Identidad visual", "Calendario de contenidos", "Contenido crudo"];

export function OnboardingDriveField({
  clientId,
  initialUrl,
  driveEmail = null,
  driveNeedsUpdate = false,
}: {
  clientId: string;
  initialUrl: string | null;
  /** Email de la cuenta de Google con Drive conectado (null = nadie conectó). */
  driveEmail?: string | null;
  /** La conexión tiene el permiso viejo (drive.file): pedir reconectar. */
  driveNeedsUpdate?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, start] = useTransition();
  const [creating, startCreate] = useTransition();
  // Si el server avisa que no hay conexión (por si driveEmail vino desactualizado).
  const [needsConnect, setNeedsConnect] = useState(false);

  const dirty = (url.trim() || null) !== (initialUrl?.trim() || null);
  const connectHref = `/api/google/auth?drive=1&label=${encodeURIComponent(
    "Drive JD Media"
  )}&returnTo=${encodeURIComponent(pathname)}`;
  const showConnect =
    (!driveEmail || needsConnect || driveNeedsUpdate) && !initialUrl;
  const canAutoCreate =
    !initialUrl && !!driveEmail && !needsConnect && !driveNeedsUpdate;

  function save() {
    start(async () => {
      const res = await setClientDriveUrl(clientId, url || null);
      if (res?.error) return void toast.error(res.error);
      toast.success(url.trim() ? "Drive guardado." : "Link de Drive borrado.");
      router.refresh();
    });
  }

  function autoCreate() {
    startCreate(async () => {
      const res = await autoCreateClientDrive(clientId);
      if (res && "error" in res && res.error) {
        if ("noConnection" in res && res.noConnection) setNeedsConnect(true);
        return void toast.error(res.error);
      }
      toast.success("Carpeta creada en Drive con sus 3 subcarpetas. Link listo para enviar.");
      router.refresh();
    });
  }

  return (
    <div className="w-full space-y-2 rounded-md border bg-muted/20 p-2.5">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <FolderPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Carpeta del cliente en el Drive de JD Media con estas 3 subcarpetas:{" "}
          {SUBFOLDERS.map((f, i) => (
            <span key={f}>
              <b className="text-foreground">{f}</b>
              {i < SUBFOLDERS.length - 1 ? " · " : ""}
            </span>
          ))}
          . El link queda acá y se muestra en el calendario de contenidos.
        </span>
      </div>

      {canAutoCreate && (
        <Button
          size="sm"
          onClick={autoCreate}
          disabled={creating}
          className="h-8 gap-1.5"
        >
          {creating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {creating ? "Creando carpetas…" : "Crear automáticamente en Drive"}
        </Button>
      )}
      {canAutoCreate && (
        <p className="text-[11px] text-muted-foreground">
          Se crea en el Drive de <b>{driveEmail}</b>, dentro de{" "}
          <b>JD MEDIA › Clientes</b>, compartida por link. Si preferís, pegá un
          link a mano abajo.
        </p>
      )}

      {showConnect && (
        <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          {driveNeedsUpdate ? (
            <p>
              La conexión de Drive de <b>{driveEmail}</b> tiene permisos viejos.
              Reconectala (una vez) para que las carpetas se creen dentro de{" "}
              <b>JD MEDIA › Clientes</b> y se muevan solas al pausar una cuenta.
            </p>
          ) : (
            <p>
              Para crear la carpeta automáticamente hay que conectar (una sola
              vez) el Drive de la cuenta de Google de JD Media.
            </p>
          )}
          <a
            href={connectHref}
            className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium text-primary hover:bg-muted"
          >
            <PlugZap className="h-3.5 w-3.5" />{" "}
            {driveNeedsUpdate ? "Actualizar permisos de Drive" : "Conectar Google Drive"}
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          className="h-8 flex-1 text-xs"
        />
        <Button size="sm" onClick={save} disabled={pending || !dirty} className="h-8 gap-1.5">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Guardar
        </Button>
        {initialUrl && (
          <a
            href={initialUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs text-primary hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </a>
        )}
      </div>
    </div>
  );
}
