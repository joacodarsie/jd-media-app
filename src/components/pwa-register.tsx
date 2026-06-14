"use client";

import { useEffect } from "react";

/**
 * Registra el service worker /sw.js apenas carga la app.
 * Silencioso si el browser no lo soporta o si estamos en localhost http.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Limpiar el ?_v=… que agrega el error boundary para forzar recarga sin
    // caché tras un deploy (ChunkLoadError). La página ya cargó bien.
    if (window.location.search.includes("_v=")) {
      const u = new URL(window.location.href);
      u.searchParams.delete("_v");
      window.history.replaceState({}, "", u.pathname + u.search + u.hash);
    }

    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[sw] register falló:", err));
  }, []);
  return null;
}
