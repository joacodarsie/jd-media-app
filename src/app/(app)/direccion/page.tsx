import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cargarTablero } from "@/lib/direccion/coordinadores-run";
import { AREA_DIRECCION, cadenciaDe, type Cadencia } from "@/lib/direccion/rutina";
import { TarjetaCoordinador } from "@/components/tarjeta-coordinador";
import { formatTicket } from "@/lib/tareas/tickets";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { DireccionWeb } from "@/components/direccion-web";
import { DireccionReferidos } from "@/components/direccion-referidos";
import { DireccionUso } from "@/components/direccion-uso";
import { PulsoAgencia } from "@/components/pulso-agencia";
import { CargaEquipo } from "@/components/carga-equipo";

export const dynamic = "force-dynamic";

type FilaTarea = {
  id: string;
  numero: number | null;
  titulo: string;
  fecha_limite: string | null;
  estado: string;
  rutina_key: string | null;
};

const GRUPOS: { cadencia: Cadencia; titulo: string; ayuda: string }[] = [
  { cadencia: "semana", titulo: "Esta semana", ayuda: "La ronda con los coordinadores, mirando su tarjeta de acá abajo." },
  { cadencia: "mes", titulo: "Este mes", ayuda: "Cerrar el mes anterior, recursos humanos y los objetivos del que viene." },
  { cadencia: "trimestre", titulo: "Este trimestre", ayuda: "Evaluación, clima del equipo y sueldos." },
  { cadencia: "una_vez", titulo: "Para poner en orden (una sola vez)", ayuda: "Lo de recursos humanos que nunca se armó." },
];

/**
 * Dirección: el lugar al que acude el dueño (12/10/2026).
 *
 * Arriba, su proceso: qué le toca hoy, esta semana, este mes y este trimestre
 * (tareas de rutina que se generan solas). Abajo, cómo viene cada coordinador.
 * Cada coordinador que entra ve solo su tarjeta, la misma que ve el dueño.
 */
export default async function DireccionPage() {
  const me = await requireUser();
  const admin = createAdmin();
  const hoy = hoyYmd();
  const esDireccion = me.area === AREA_DIRECCION;

  const { tarjetas, pedidos } = await cargarTablero(admin, hoy, esDireccion ? undefined : me.id);
  if (!esDireccion && tarjetas.length === 0) redirect("/dashboard");

  // Las tareas propias: las de rutina (abiertas y las cerradas recién, para ver
  // el tilde) y el resto abiertas.
  const hace45 = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const { data: mias } = esDireccion
    ? await admin
        .from("tasks")
        .select("id, numero, titulo, fecha_limite, estado, rutina_key")
        .eq("asignado_a_id", me.id)
        .neq("estado", "archivada")
        .or(`estado.neq.completada,and(rutina_key.like.dir:%,fecha_limite.gte.${hace45})`)
        .order("fecha_limite", { ascending: true, nullsFirst: false })
        .limit(200)
    : { data: [] };
  const todas = (mias ?? []) as FilaTarea[];
  const lunes = (() => {
    const d = new Date(`${hoy}T12:00:00Z`);
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    return d.toISOString().slice(0, 10);
  })();
  const deRutina = (c: Cadencia) =>
    todas.filter((t) => {
      if (!t.rutina_key || cadenciaDe(t.rutina_key) !== c) return false;
      if (t.estado !== "completada") return true;
      // Las cerradas solo del período en curso, para ver qué ya hiciste.
      if (c === "semana") return t.rutina_key.includes(`:${lunes}:`);
      if (c === "mes") return t.rutina_key.includes(`:${hoy.slice(0, 7)}:`);
      return c === "trimestre";
    });
  const otras = todas.filter((t) => !t.rutina_key?.startsWith("dir:") && t.estado !== "completada");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{esDireccion ? "Dirección" : "Cómo te ve la dirección"}</h1>
        <p className="text-muted-foreground">
          {esDireccion
            ? "Tu lugar de trabajo, solo lo ves vos: arriba lo que te toca, después cómo viene cada coordinador, cómo anda la web y los referidos."
            : "Estos son los números con los que Joaquín sigue tu puesto. Se calculan solos con lo que hacés en la plataforma."}
        </p>
      </div>

      {/* El pulso de la agencia: los números que importan, de un vistazo (19/10/2026). */}
      {esDireccion && (
        <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-muted/40" />}>
          <PulsoAgencia />
        </Suspense>
      )}

      {esDireccion && (
        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Tu proceso</h2>
            <p className="text-xs text-muted-foreground">
              <b>Todos los días (5 minutos):</b> mirá las tarjetas de los coordinadores. Lo que está en
              rojo se destraba con un pedido concreto y con fecha.
            </p>
          </div>
          <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
            {GRUPOS.map((g) => {
              const filas = deRutina(g.cadencia);
              if (!filas.length) return null;
              return (
                <div key={g.cadencia} className="px-4 py-3">
                  <h3 className="text-sm font-medium">{g.titulo}</h3>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">{g.ayuda}</p>
                  <ul className="space-y-1">
                    {filas.map((t) => {
                      const hecha = t.estado === "completada";
                      const vencida = !hecha && !!t.fecha_limite && t.fecha_limite < hoy;
                      return (
                        <li key={t.id}>
                          <Link href={`/tareas/${t.id}`} className="flex items-center gap-2 text-sm hover:underline">
                            {hecha ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Circle className={cn("h-4 w-4 shrink-0", vencida ? "text-red-500" : "text-muted-foreground")} />
                            )}
                            <span className={cn("min-w-0 flex-1 truncate", hecha && "text-muted-foreground line-through")}>
                              {t.titulo}
                            </span>
                            {t.fecha_limite && !hecha && (
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
                </div>
              );
            })}
          </div>
        </section>
      )}

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
        <Suspense fallback={null}>
          <CargaEquipo />
        </Suspense>
      )}

      {esDireccion && (
        <Suspense fallback={null}>
          <DireccionWeb />
        </Suspense>
      )}

      {esDireccion && (
        <Suspense fallback={null}>
          <DireccionReferidos />
        </Suspense>
      )}

      {esDireccion && (
        <Suspense fallback={null}>
          <DireccionUso />
        </Suspense>
      )}

      {esDireccion && (
        <section className="rounded-xl border bg-card">
          <div className="flex items-center border-b px-4 py-2.5">
            <h2 className="text-sm font-semibold">Otras tareas tuyas</h2>
            <span className="ml-2 text-xs text-muted-foreground">({otras.length})</span>
            <Link href="/tareas" className="ml-auto text-xs text-primary hover:underline">
              Ver en Tareas
            </Link>
          </div>
          {otras.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nada pendiente 🎉</p>
          ) : (
            <ul className="divide-y">
              {otras.slice(0, 20).map((t) => {
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
