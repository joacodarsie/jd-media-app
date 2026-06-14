"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, FolderPlus, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setClientDriveUrl } from "@/app/(app)/clientes/[id]/onboarding/actions";

const SUBFOLDERS = ["Identidad visual", "Calendario de contenidos", "Contenido crudo"];

export function OnboardingDriveField({
  clientId,
  initialUrl,
}: {
  clientId: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, start] = useTransition();

  const dirty = (url.trim() || null) !== (initialUrl?.trim() || null);

  function save() {
    start(async () => {
      const res = await setClientDriveUrl(clientId, url || null);
      if (res?.error) return void toast.error(res.error);
      toast.success(url.trim() ? "Drive guardado." : "Link de Drive borrado.");
      router.refresh();
    });
  }

  return (
    <div className="w-full space-y-2 rounded-md border bg-muted/20 p-2.5">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <FolderPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Creá la carpeta del cliente dentro de <b>Clientes</b> en el Drive de JD Media,
          con estas 3 subcarpetas:{" "}
          {SUBFOLDERS.map((f, i) => (
            <span key={f}>
              <b className="text-foreground">{f}</b>
              {i < SUBFOLDERS.length - 1 ? " · " : ""}
            </span>
          ))}
          . Pegá el link de la carpeta acá: se muestra en el calendario de contenidos.
        </span>
      </div>
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
