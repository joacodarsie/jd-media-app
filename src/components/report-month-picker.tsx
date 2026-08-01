"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** "2026-08" → "agosto de 2026" */
function label(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m) return mes;
  const nombre = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/** Suma o resta meses sobre "YYYY-MM" sin pasar por Date (evita el corrimiento por zona horaria). */
function mover(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Selector de mes del reporte, con flechas.
 *
 * Antes era un `<input type="month">`: se ve distinto en cada navegador, en el
 * celular abre un teclado numérico y para ver el mes anterior había que abrir
 * el calendario del sistema. Con flechas es un clic.
 */
export function ReportMonthPicker({
  currentMes,
  clientId,
}: {
  currentMes: string;
  clientId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function ir(mes: string) {
    const qs = new URLSearchParams(params.toString());
    qs.set("mes", mes);
    // El token del portal (si viene) tiene que sobrevivir al cambio de mes:
    // si no, al cliente lo saca la sesión y termina en el login.
    router.push(`/reporte/cliente/${clientId}?${qs.toString()}`);
  }

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const esFuturo = mover(currentMes, 1) > mesActual;

  return (
    <div className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-1 py-0.5">
      <button
        type="button"
        onClick={() => ir(mover(currentMes, -1))}
        aria-label="Mes anterior"
        className="rounded p-1 text-zinc-600 hover:bg-zinc-100"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[130px] text-center text-sm font-medium text-zinc-800">
        {label(currentMes)}
      </span>
      <button
        type="button"
        onClick={() => ir(mover(currentMes, 1))}
        disabled={esFuturo}
        aria-label="Mes siguiente"
        className="rounded p-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
