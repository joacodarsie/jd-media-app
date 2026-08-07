"use client";

/**
 * Botones de la propuesta pública. Client component chico y aparte para que
 * toda la página siga siendo server-rendered (abre rápido en el celular, que es
 * donde se lee).
 */

export function PropuestaAcciones({ waHref, web }: { waHref: string; web: string }) {
  return (
    <div className="no-print mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-full bg-[#FFD400] px-7 py-3.5 text-center text-sm font-bold text-black transition-opacity hover:opacity-90 sm:w-auto"
      >
        Escribirnos por WhatsApp
      </a>
      <a
        href={web}
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-full border border-white/20 px-7 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
      >
        Ver la web
      </a>
    </div>
  );
}

/**
 * "Guardar en PDF" = el diálogo de impresión del navegador con la hoja A4 ya
 * configurada. Sin dependencias ni servidor de por medio: el mismo documento
 * que se ve en pantalla es el PDF.
 */
export function BotonPdf() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
    >
      Guardar en PDF
    </button>
  );
}
