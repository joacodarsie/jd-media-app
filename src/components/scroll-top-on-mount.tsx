"use client";

import { useEffect } from "react";

/**
 * Fuerza el scroll al tope al montar la página. Soluciona el caso de entrar a
 * una vista (ej. ficha del cliente) y que aparezca scrolleada hacia abajo por
 * la restauración de scroll del navegador. Doble pasada (ahora + próximo frame)
 * para ganarle a un reflow tardío del contenido.
 */
export function ScrollTopOnMount() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const id = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
