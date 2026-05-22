"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePublicationFinalFields } from "@/app/(app)/contenidos/actions";

export function PublicationFinalFields({
  id,
  initialUrl,
  initialResubido,
}: {
  id: string;
  initialUrl: string | null;
  initialResubido: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [resubido, setResubido] = useState<boolean>(initialResubido);
  const [pending, start] = useTransition();
  const dirty = url !== (initialUrl ?? "") || resubido !== initialResubido;

  function save() {
    start(async () => {
      const res = await updatePublicationFinalFields(id, url.trim() || null, resubido);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Guardado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pieza publicada
      </div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://instagram.com/p/…"
            className="h-8 text-xs"
          />
          {url && (
            <a
              href={url.startsWith("http") ? url : `https://${url}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border bg-background px-2 hover:bg-muted"
              title="Abrir"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={resubido}
            onChange={(e) => setResubido(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span>Resubido a TikTok</span>
        </label>
        {dirty && (
          <Button size="sm" onClick={save} disabled={pending} className="gap-1">
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Guardar
          </Button>
        )}
      </div>
    </div>
  );
}
