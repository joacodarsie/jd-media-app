"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Tras un deploy, una pestaña abierta puede tener chunks viejos y fallar al
  // navegar (ChunkLoadError). En vez de mostrar el error, recargamos una sola
  // vez para traer el bundle nuevo (guardado en sessionStorage para no loopear).
  const isChunkError =
    error?.name === "ChunkLoadError" ||
    /loading chunk|importing a module script failed|dynamically imported module|failed to fetch dynamically/i.test(
      error?.message ?? ""
    );

  useEffect(() => {
    if (isChunkError && typeof window !== "undefined") {
      const KEY = "jd:chunk-reload-at";
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      // Solo recargar si no lo hicimos en los últimos 10s (evita bucle).
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return;
      }
    }
    // En producción esto va a aparecer en Vercel runtime logs
    console.error("[app error boundary]", error);
  }, [error, isChunkError]);

  // Mientras se dispara la recarga no mostramos el cartel de error.
  if (isChunkError) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center text-sm text-muted-foreground">
        Actualizando a la última versión…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <Card className="border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">Algo se rompió en esta sección</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                El resto de la app sigue funcionando. Probá refrescar la página
                o volver al dashboard. Si el problema persiste, copiá el código
                de abajo y avisame.
              </p>
            </div>
          </div>

          {error.digest && (
            <code className="block break-all rounded bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
              ref: {error.digest}
            </code>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} variant="default" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
            <Button asChild variant="outline" className="gap-1.5">
              <Link href="/dashboard">
                <Home className="h-3.5 w-3.5" />
                Volver al inicio
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
