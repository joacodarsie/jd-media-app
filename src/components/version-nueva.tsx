"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Avisa cuando la pestaña quedó con una versión vieja de la plataforma.
 *
 * Tras un deploy, una pestaña abierta de antes sigue mostrando todo bien pero
 * sus botones apuntan a acciones que el servidor ya no tiene: "no funcionan los
 * botones" (Santi, 28/10/2026). No se recarga sola para no perder lo que la
 * persona esté escribiendo: aparece una barra con «Actualizar».
 *
 * Se chequea al volver a la pestaña (como mucho cada 2 minutos), no con un
 * intervalo, para no sumar pedidos al servidor.
 */
export function VersionNueva({ actual }: { actual: string | null }) {
  const [vieja, setVieja] = useState(false);

  useEffect(() => {
    if (!actual) return;
    let ultimo = Date.now();
    const chequear = async () => {
      if (document.visibilityState !== "visible" || Date.now() - ultimo < 120_000) return;
      ultimo = Date.now();
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const j = (await r.json()) as { id: string | null };
        if (j.id && j.id !== actual) setVieja(true);
      } catch {}
    };
    document.addEventListener("visibilitychange", chequear);
    window.addEventListener("focus", chequear);
    return () => {
      document.removeEventListener("visibilitychange", chequear);
      window.removeEventListener("focus", chequear);
    };
  }, [actual]);

  if (!vieja) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg"
      >
        <RefreshCw className="h-4 w-4" />
        Hay una versión nueva de la plataforma · Actualizar
      </button>
    </div>
  );
}
