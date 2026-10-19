"use client";

/**
 * Los efectos que viven en toda la plataforma (18/10/2026), con el mismo
 * espíritu que jdmedia.com.ar:
 * - Una luz suave que sigue al mouse sobre las tarjetas (.bg-card redondeadas).
 * - Botones principales con un destello al pasar el mouse (CSS .jd-brillo).
 * Todo con el mouse solamente y apagado con «reducir movimiento».
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

type DocConTransicion = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

/**
 * La tarjeta que se toca se expande hasta ser la pantalla nueva (18/10/2026).
 * Vale para los links con `data-expande`: si el link está dentro de una fila
 * marcada con `data-expande-fila`, crece la fila entera. Usa las transiciones
 * del navegador; donde no existen, se navega como siempre.
 */
function useExpansion(router: ReturnType<typeof useRouter>) {
  useEffect(() => {
    const doc = document as DocConTransicion;
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const clic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-expande]");
      if (!a || a.target === "_blank") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      const origen = a.closest<HTMLElement>("[data-expande-fila]") ?? a;
      const viejo = document.querySelector(".jd-pagina");
      origen.style.setProperty("view-transition-name", "jd-expande");
      const t = doc.startViewTransition!(
        () =>
          new Promise<void>((listo) => {
            origen.style.removeProperty("view-transition-name");
            router.push(url.pathname + url.search + url.hash);
            const t0 = performance.now();
            const esperar = () => {
              const nuevo = document.querySelector<HTMLElement>(".jd-pagina");
              if (nuevo && nuevo !== viejo) {
                nuevo.style.setProperty("view-transition-name", "jd-expande");
                return listo();
              }
              if (performance.now() - t0 > 1500) return listo();
              setTimeout(esperar, 25);
            };
            esperar();
          })
      );
      t.finished.finally(() => document.querySelector<HTMLElement>(".jd-pagina")?.style.removeProperty("view-transition-name"));
    };
    document.addEventListener("click", clic, true);
    return () => document.removeEventListener("click", clic, true);
  }, [router]);
}

export function EfectosGlobales() {
  const router = useRouter();
  useExpansion(router);
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
