"use client";

import { useEffect } from "react";

/**
 * Registra el service worker /sw.js apenas carga la app.
 * Silencioso si el browser no lo soporta o si estamos en localhost http.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
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
