import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cargarTablero } from "@/lib/direccion/coordinadores-run";
import { TarjetaCoordinador } from "@/components/tarjeta-coordinador";
import { formatTicket } from "@/lib/tareas/tickets";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Dirección: cómo viene cada coordinador (12/10/2026).
 *
 * El dueño coordina a los coordinadores: acá ve en un minuto qué se traba, sin
 * entrar a buscar. Cada coordinador entra y ve SOLO su tarjeta, la misma que
 * ve la dirección.
 */
export default async function DireccionPage() {
  const me = await requireUser();
  const admin = createAdmin();
  const hoy = hoyYmd();
  const esDireccion = me.rol === "admin";

  const { tarjetas, pedidos } = await cargarTablero(admin, hoy, esDireccion ? undefined : me.id);
  if (!esDireccion && tarjetas.length === 0) redirect("/dashboard");

  // Las tareas propias de la dirección, abajo.
  const { data: mias } = esDireccion
    ? await admin
        .from("tasks")
        .select("id, numero, titulo, fecha_limite")
        .eq("asignado_a_id", me.id)
        .not("estado", "in", "(completada,archivada)")
        .order("fecha_limite", { ascending: true, nullsFirst: false })
        .limit(15)
    : { data: [] };
  const misTareas = (mias ?? []) as {
    id: string;
    numero: number | null;
    titulo: string;
    fecha_limite: string | null;
  }[];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{esDireccion ? "Dirección" : "Cómo te ve la dirección"}</h1>
        <p className="text-muted-foreground">
          {esDireccion
            ? "Cómo viene cada coordinador, con los números de su puesto. Lo que está peor, arriba. Cada uno ve su propia tarjeta en Mi día."
            : "Estos son los números con los que Joaquín sigue tu puesto. Se calculan solos con lo que hacés en la plataforma."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tarjetas.map((t) => (
          <TarjetaCoordinador
            key={t.personaId}
            t={t}
            pedidos={pedidos[t.personaId] ?? []}
            puedePedir={esDireccion}
          />
        ))}
      </div>

      {esDireccion && (
        <section className="rounded-xl border bg-card">
          <div className="flex items-center border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Tus tareas</h2>
            <Link href="/tareas" className="ml-auto text-xs text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          {misTareas.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nada pendiente.</p>
          ) : (
            <ul className="divide-y">
              {misTareas.map((t) => {
                const vencida = !!t.fecha_limite && t.fecha_limite < hoy;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/tareas/${t.id}`}
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                    >
                      <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
                        {formatTicket(t.numero) ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{t.titulo}</span>
                      {t.fecha_limite && (
                        <span
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            vencida ? "font-medium text-red-600" : "text-muted-foreground"
                          )}
                        >
                          {t.fecha_limite.slice(8, 10)}/{t.fecha_limite.slice(5, 7)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
