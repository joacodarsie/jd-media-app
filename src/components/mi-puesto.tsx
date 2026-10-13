import Link from "next/link";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cargarTablero, type Tablero } from "@/lib/direccion/coordinadores-run";
import { cargarPanelPuesto, type Bloque } from "@/lib/direccion/mi-puesto-run";
import { PUESTO_LABEL } from "@/lib/direccion/coordinadores";
import { TarjetaCoordinador } from "@/components/tarjeta-coordinador";
import { BandejaAprobar } from "@/components/bandeja-aprobar";
import { cn } from "@/lib/utils";

/**
 * Mi día por rol (12/10/2026). Para cada coordinador, arriba de todo:
 * - **Lo de tu puesto:** la lista concreta de qué hacer hoy (repartir, aprobar,
 *   cobrar, conectar pauta…), con el link para resolver cada cosa.
 * - **Cómo te ve la dirección:** su tarjeta, la misma que ve el dueño.
 *
 * Pedido de Santi: que cada uno gestione lo suyo a su manera. En vez de una
 * sección por persona, el mismo Mi día cambia según el puesto.
 */
export async function MiPuesto({ userId }: { userId: string }) {
  const admin = createAdmin();
  const hoy = hoyYmd();
  const { tarjetas, pedidos } = await cargarTablero(admin, hoy, userId).catch(
    (): Tablero => ({ tarjetas: [], pedidos: {} })
  );
  const t = tarjetas[0];
  if (!t) return null;
  const panel = await cargarPanelPuesto(admin, hoy, { id: userId }, t.puesto).catch(() => null);

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Lo de tu puesto · {PUESTO_LABEL[t.puesto]}
      </h2>
      {panel?.puesto === "direccion_creativa" && panel.aprobar.length > 0 && (
        <BandejaAprobar titulo="Para aprobar" items={panel.aprobar} puedeDecidir />
      )}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          {(panel?.bloques ?? []).map((b) => (
            <BloqueLista key={b.titulo} b={b} />
          ))}
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Cómo te ve la dirección
          </p>
          <TarjetaCoordinador t={t} pedidos={pedidos[userId] ?? []} puedePedir={false} />
        </div>
      </div>
    </section>
  );
}

function BloqueLista({ b }: { b: Bloque }) {
  const total = b.total ?? b.lineas.length;
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <h3 className="text-sm font-semibold">{b.titulo}</h3>
        {total > 0 && <span className="text-xs text-muted-foreground">({total})</span>}
        {b.verTodo && (
          <Link href={b.verTodo.href} className="ml-auto text-xs text-primary hover:underline">
            {b.verTodo.texto} →
          </Link>
        )}
      </div>
      {b.lineas.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{b.vacio}</p>
      ) : (
        <ul className="divide-y">
          {b.lineas.map((l, i) => {
            const fila = (
              <div className="flex items-center gap-3 px-4 py-1.5 text-sm">
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", l.urgente ? "bg-red-500" : "bg-muted-foreground/40")}
                />
                <span className="min-w-0 flex-1 truncate">{l.texto}</span>
                {l.detalle && (
                  <span
                    className={cn(
                      "max-w-[55%] shrink-0 truncate text-xs",
                      l.urgente ? "text-red-600" : "text-muted-foreground"
                    )}
                    title={l.detalle}
                  >
                    {l.detalle}
                  </span>
                )}
              </div>
            );
            return (
              <li key={i}>
                {l.href ? (
                  <Link href={l.href} className="block hover:bg-accent">
                    {fila}
                  </Link>
                ) : (
                  fila
                )}
              </li>
            );
          })}
        </ul>
      )}
      {total > b.lineas.length && (
        <p className="border-t px-4 py-1.5 text-[11px] text-muted-foreground">
          Y {total - b.lineas.length} más.
        </p>
      )}
    </div>
  );
}
