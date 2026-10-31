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

    // Una pestaña abierta desde antes de un deploy tiene los botones "muertos":
    // sus acciones apuntan a la versión vieja y el servidor ya no las conoce
    // ("Failed to find Server Action"). Santi lo vivió el 28/10. Si pasa,
    // recargamos una vez para traer la versión nueva.
    const KEY = "jd:version-reload-at";
    const VIEJA = /failed to find server action|older or newer deployment|unexpected response was received from the server|chunkloaderror|loading chunk/i;
    const recargar = (msg: string) => {
      if (!VIEJA.test(msg)) return;
      if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 15000) return;
      sessionStorage.setItem(KEY, String(Date.now()));
      const u = new URL(window.location.href);
      u.searchParams.set("_v", Date.now().toString());
      window.location.replace(u.toString());
    };
    const onRechazo = (e: PromiseRejectionEvent) =>
      recargar(String((e.reason as Error)?.message ?? e.reason ?? ""));
    const onError = (e: ErrorEvent) => recargar(String(e.message ?? ""));
    window.addEventListener("unhandledrejection", onRechazo);
    window.addEventListener("error", onError);
    const quitar = () => {
      window.removeEventListener("unhandledrejection", onRechazo);
      window.removeEventListener("error", onError);
    };

    if (!("serviceWorker" in navigator)) return quitar;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("[sw] register falló:", err));
  }, []);
  return null;
}
