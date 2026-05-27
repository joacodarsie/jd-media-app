"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function TemplatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/templates] error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-base font-bold">No se pudo cargar /templates</h2>
              <p className="text-sm text-muted-foreground">
                Detalle del error abajo. Mandalo a soporte para que lo arreglen.
              </p>
            </div>
            <pre className="overflow-auto rounded bg-card p-3 text-[11px] leading-tight">
              {error.message}
              {error.digest && `\n\nDigest: ${error.digest}`}
              {error.stack && `\n\n${error.stack}`}
            </pre>
            <Button onClick={reset} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
