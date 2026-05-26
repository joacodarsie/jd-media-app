"use client";

import { useEffect } from "react";

const KEY = "jd:novedades-last-seen";

/**
 * Marker invisible que se monta en /novedades.
 * Al entrar, guarda en localStorage el `latestDate` del ultimo entry visible
 * para que el badge del sidebar se apague hasta que aparezca una novedad nueva.
 */
export function NovedadesSeenMarker({ latestDate }: { latestDate: string | null }) {
  useEffect(() => {
    if (!latestDate) return;
    try {
      const prev = localStorage.getItem(KEY);
      if (prev !== latestDate) {
        localStorage.setItem(KEY, latestDate);
      }
      window.dispatchEvent(new CustomEvent("jd:novedades-seen", { detail: latestDate }));
    } catch {
      /* localStorage puede estar bloqueado en algunos navegadores */
    }
  }, [latestDate]);
  return null;
}
