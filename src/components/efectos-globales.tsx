"use client";

/**
 * Los efectos que viven en toda la plataforma (18/10/2026), con el mismo
 * espíritu que jdmedia.com.ar:
 * - Una luz suave que sigue al mouse sobre las tarjetas (.bg-card redondeadas).
 * - Botones principales con un destello al pasar el mouse (CSS .jd-brillo).
 * Todo con el mouse solamente y apagado con «reducir movimiento».
 */
import { useEffect } from "react";

export function EfectosGlobales() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let actual: HTMLElement | null = null;
    let pedido = 0;
    let ultimo: PointerEvent | null = null;

    const pintar = () => {
      pedido = 0;
      const e = ultimo;
      if (!e) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".bg-card.rounded-2xl, .bg-card.rounded-xl") ?? null;
      if (el !== actual) {
        actual?.classList.remove("jd-luz");
        actual = el;
        actual?.classList.add("jd-luz");
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const mover = (e: PointerEvent) => {
      ultimo = e;
      if (!pedido) pedido = requestAnimationFrame(pintar);
    };
    const salir = () => {
      actual?.classList.remove("jd-luz");
      actual = null;
    };
    document.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerleave", salir);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerleave", salir);
      salir();
    };
  }, []);
  return null;
}
