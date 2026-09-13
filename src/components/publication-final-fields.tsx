"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, ExternalLink, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePublicationFinalFields } from "@/app/(app)/contenidos/actions";

/**
 * El link del posteo publicado.
 *
 * Antes eran tres campos, uno por red. Quedó solo Instagram: las columnas de
 * TikTok y Facebook estaban vacías en las 678 piezas, Instagram es la red
 * principal de planificación, y es la única que se mira para analizar
 * repercusión en el informe del cliente (migración 0167).
 */
export function PublicationFinalFields({
  id,
  initialLinkInstagram,
}: {
  id: string;
  initialLinkInstagram: string | null;
}) {
  const router = useRouter();
  const [ig, setIg] = useState(initialLinkInstagram ?? "");
  const [pending, start] = useTransition();
  const dirty = ig !== (initialLinkInstagram ?? "");

  function save() {
    start(async () => {
      const res = await updatePublicationFinalFields(id, ig.trim() || null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Link guardado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Link de la publicación
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          El posteo en Instagram. Aparece en el reporte mensual del cliente y es con lo
          que se mide qué repercusión tuvo.
        </p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Camera className="h-3.5 w-3.5 text-pink-600" />
          Instagram
        </div>
        <div className="flex gap-2">
          <Input
            value={ig}
            onChange={(e) => setIg(e.target.value)}
            placeholder="https://instagram.com/p/…"
            className="h-8 text-xs"
          />
          {ig && (
            <a
              href={ig.startsWith("http") ? ig : `https://${ig}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border bg-background px-2 hover:bg-muted"
              title="Abrir"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
      {dirty && (
        <Button size="sm" onClick={save} disabled={pending} className="gap-1">
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Guardar link
        </Button>
      )}
    </div>
  );
}
