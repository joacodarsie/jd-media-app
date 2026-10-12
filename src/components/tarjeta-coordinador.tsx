import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTicket } from "@/lib/tareas/tickets";
import { PUESTO_LABEL, type Semaforo, type Tarjeta } from "@/lib/direccion/coordinadores";
import type { Pedido } from "@/lib/direccion/coordinadores-run";
import { PedirACoordinador } from "@/components/pedir-a-coordinador";

const PUNTO: Record<Semaforo, string> = {
  ok: "bg-emerald-500",
  atento: "bg-amber-500",
  mal: "bg-red-500",
};
const BORDE: Record<Semaforo, string> = {
  ok: "border-emerald-500/40",
  atento: "border-amber-500/50",
  mal: "border-red-500/50",
};
const FRASE: Record<Semaforo, string> = {
  ok: "Viene bien",
  atento: "Hay que mirar",
  mal: "Está trabado",
};

/**
 * La tarjeta de un coordinador. La ve la dirección (con "Pedirle algo") y la
 * ve la persona en su Mi día: el mismo número para los dos.
 */
export function TarjetaCoordinador({
  t,
  pedidos,
  puedePedir,
}: {
  t: Tarjeta;
  pedidos: Pedido[];
  puedePedir: boolean;
}) {
  const nombreCorto = t.nombre.split(" ")[0];
  return (
    <section className={cn("rounded-xl border-2 bg-card", BORDE[t.estado])}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <span className={cn("h-2.5 w-2.5 rounded-full", PUNTO[t.estado])} />
        <h2 className="text-sm font-semibold">{t.nombre}</h2>
        <span className="text-xs text-muted-foreground">· {PUESTO_LABEL[t.puesto]}</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground">{FRASE[t.estado]}</span>
      </div>
      <ul className="divide-y">
        {t.indicadores.map((i) => {
          const fila = (
            <div className="flex items-center gap-3 px-4 py-2">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  i.estado ? PUNTO[i.estado] : "bg-muted-foreground/30"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm">{i.label}</div>
                <div className="truncate text-[11px] text-muted-foreground">{i.detalle}</div>
              </div>
              <span className="shrink-0 text-base font-semibold tabular-nums">{i.valor}</span>
            </div>
          );
          return (
            <li key={i.label}>
              {i.href ? (
                <Link href={i.href} className="block transition-colors hover:bg-accent">
                  {fila}
                </Link>
              ) : (
                fila
              )}
            </li>
          );
        })}
      </ul>
      {(pedidos.length > 0 || puedePedir) && (
        <div className="space-y-1.5 border-t px-4 py-2.5">
          {pedidos.length > 0 && (
            <ul className="space-y-1">
              {pedidos.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatTicket(p.numero) ?? "—"}
                  </span>
                  <Link href={`/tareas/${p.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {p.titulo}
                  </Link>
                  {p.fecha_limite && (
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        p.vencido ? "font-medium text-red-600" : "text-muted-foreground"
                      )}
                    >
                      {p.vencido ? "venció " : ""}
                      {p.fecha_limite.slice(8, 10)}/{p.fecha_limite.slice(5, 7)}
                    </span>
                  )}
                </li>
              ))}
              {pedidos.length > 5 && (
                <li className="text-[11px] text-muted-foreground">Y {pedidos.length - 5} más.</li>
              )}
            </ul>
          )}
          {puedePedir && <PedirACoordinador personaId={t.personaId} nombre={nombreCorto} />}
        </div>
      )}
    </section>
  );
}
