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
  // navegar (ChunkLoadError). Recargamos con cache-busting (?_v=…) para forzar
  // que el navegador traiga el documento + bundle nuevos del server (un reload
  // normal puede servir el documento cacheado y re-fallar). Si tras recargar
  // sigue fallando (no era un chunk viejo), mostramos el cartel normal.
  const isChunkError =
    error?.name === "ChunkLoadError" ||
    /loading chunk|importing a module script failed|dynamically imported module|failed to fetch dynamically/i.test(
      error?.message ?? ""
    );

  const KEY = "jd:chunk-reload-at";
  const recentlyReloaded =
    typeof window !== "undefined" &&
    Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 15000;

  useEffect(() => {
    if (isChunkError && typeof window !== "undefined" && !recentlyReloaded) {
      sessionStorage.setItem(KEY, String(Date.now()));
      const u = new URL(window.location.href);
      u.searchParams.set("_v", Date.now().toString());
      window.location.replace(u.toString());
      return;
    }
    // En producción esto va a aparecer en Vercel runtime logs
    console.error("[app error boundary]", error);
  }, [error, isChunkError, recentlyReloaded]);

  // Mientras se dispara la recarga no mostramos el cartel de error. Si ya
  // recargamos hace poco y volvió a caer, sí mostramos el cartel (no era chunk).
  if (isChunkError && !recentlyReloaded) {
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
