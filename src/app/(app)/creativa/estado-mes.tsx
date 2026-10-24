import { cn } from "@/lib/utils";
import type { MesCalendario } from "@/lib/creativa/cargar";

/** El estado del calendario de un mes, como chip (Área Creativa, 23/10/2026). */
export function EstadoMes({ m, prefijo }: { m: MesCalendario; prefijo?: string }) {
  const [txt, tono] =
    m.estado === "aprobado"
      ? ["✓ Aprobado", "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"]
      : m.estado === "pendiente"
        ? [`● ${m.porAprobar} por aprobar`, "bg-red-500/15 text-red-700 dark:text-red-300"]
        : ["Sin calendario", "bg-muted text-muted-foreground"];
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", tono)} title={m.total ? `${m.total} piezas` : undefined}>
      {prefijo ? `${prefijo}: ` : ""}
      {txt}
    </span>
  );
}
