import Link from "next/link";
import { BloquePlegable } from "@/components/bloque-plegable";
import { cn } from "@/lib/utils";
import { trabadas, vencenPronto, type TareaParaMirar } from "@/lib/tareas/pronto-y-trabadas";

type Fila = TareaParaMirar & { cliente?: { nombre: string } | null };

/**
 * Arriba de Tareas (24/10/2026, pedido de Luz): qué vence de hoy a 3 días y
 * qué está trabado esperando una aprobación, a otra persona o al cliente.
 * Coordinación lo ve de todo el equipo; el resto, lo suyo.
 */
export function TareasProntoTrabadas({
  tareas,
  hoy,
  nombres,
  delEquipo,
}: {
  tareas: Fila[];
  hoy: string;
  nombres: Record<string, string>;
  delEquipo: boolean;
}) {
  const nombre = (id: string) => nombres[id]?.split(" ")[0] ?? null;
  const pronto = vencenPronto(tareas, hoy);
  const frenadas = trabadas(tareas, nombre);
  if (!pronto.length && !frenadas.length) return null;
  const hoyN = pronto.filter((x) => x.dias === 0).length;
  const mananaN = pronto.filter((x) => x.dias === 1).length;
  const porTraba = (k: string) => frenadas.filter((x) => x.traba === k).length;
  const quien = (x: Fila) => (delEquipo && x.asignado_a_id ? nombre(x.asignado_a_id) : null);

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <BloquePlegable
        emoji="⏰"
        titulo={`Vence pronto${delEquipo ? " en el equipo" : ""}`}
        resumen={pronto.length ? `${hoyN} hoy · ${mananaN} mañana · ${pronto.length - hoyN - mananaN} en 2 o 3 días` : "Nada vence en los próximos 3 días"}
        derecha={<b className="text-lg tabular-nums">{pronto.length}</b>}
        pegado
      >
        <ul className="max-h-96 divide-y overflow-y-auto">
          {pronto.map((x) => (
            <li key={x.id}>
              <Link href={`/tareas/${x.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/40">
                <span
                  className={cn(
                    "w-36 shrink-0 text-xs font-medium",
                    x.dias === 0 ? "text-red-600 dark:text-red-400" : x.dias === 1 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
                  )}
                >
                  {x.cuando}
                </span>
                <span className="min-w-0 flex-1 truncate">{x.titulo}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {[x.cliente?.nombre, quien(x)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </BloquePlegable>
      <BloquePlegable
        emoji="🧱"
        titulo={`Trabadas${delEquipo ? " en el equipo" : ""}`}
        resumen={
          frenadas.length
            ? `${porTraba("aprobacion")} esperan aprobación · ${porTraba("persona")} a otra persona · ${porTraba("cliente")} al cliente`
            : "Nada trabado"
        }
        derecha={<b className="text-lg tabular-nums">{frenadas.length}</b>}
        pegado
      >
        <ul className="max-h-96 divide-y overflow-y-auto">
          {frenadas.map((x) => (
            <li key={x.id}>
              <Link href={`/tareas/${x.id}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/40">
                <span className="w-44 shrink-0 truncate text-xs font-medium text-orange-700 dark:text-orange-300">{x.espera}</span>
                <span className="min-w-0 flex-1 truncate">{x.titulo}</span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {[x.cliente?.nombre, quien(x)].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </BloquePlegable>
    </div>
  );
}
