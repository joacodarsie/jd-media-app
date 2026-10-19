"use client";

/**
 * El movimiento del portal del cliente (18/10/2026): las tarjetas aparecen al
 * bajar, las barras se llenan y los números simples cuentan hasta su valor.
 * Es lo que más ve el cliente: tiene que sentirse cuidado. Sin JS, o con
 * «reducir movimiento», todo se ve quieto y completo.
 */
import { useEffect } from "react";

export function PortalMovimiento() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raiz = document.querySelector(".wrap");
    if (!raiz) return;
    raiz.classList.add("pm-vivo");

    const contar = (el: HTMLElement) => {
      const m = /^(\D*)(\d{1,3}(?:\.\d{3})*|\d+)(\D*)$/.exec(el.textContent?.trim() ?? "");
      if (!m) return;
      const hasta = Number(m[2].replace(/\./g, ""));
      if (!hasta) return;
      const t0 = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        el.textContent = m[1] + Math.round(hasta * (1 - Math.pow(1 - k, 3))).toLocaleString("es-AR") + m[3];
        if (k < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    };

    const io = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          e.target.classList.add("pm-visto");
          e.target.querySelectorAll<HTMLElement>(".cadencia-cell .val").forEach(contar);
        }),
      { threshold: 0.12 }
    );
    raiz.querySelectorAll(".card").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  return null;
}
