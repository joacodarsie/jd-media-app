import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { PasoSemana } from "@/lib/equipo/primera-semana";
import { cn } from "@/lib/utils";

/**
 * «Tu primera semana» en Mi día (19/10/2026): el checklist de bienvenida, con
 * los pasos que se marcan solos a medida que la persona los hace.
 */
export function PrimeraSemana({ nombre, pasos }: { nombre: string; pasos: PasoSemana[] }) {
  const hechos = pasos.filter((p) => p.hecho).length;
  const pct = Math.round((hechos / pasos.length) * 100);
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative border-b bg-gradient-to-r from-primary/15 via-amber-100/40 to-transparent px-5 py-4 dark:from-primary/15 dark:via-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tu primera semana</p>
            <h2 className="mt-0.5 text-lg font-bold">¡Bienvenido/a, {nombre.split(" ")[0]}! 👋</h2>
            <p className="text-sm text-muted-foreground">Estos pasos se van tildando solos a medida que los hacés.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums">
                {hechos}
                <span className="text-base text-muted-foreground">/{pasos.length}</span>
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">listos</div>
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </div>
      <ul className="jd-cascada grid divide-y sm:grid-cols-2 sm:divide-y-0">
        {pasos.map((p) => (
          <li key={p.clave} className="sm:border-b sm:odd:border-r">
            <Link
              href={p.href}
              className={cn("group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40", p.hecho && "opacity-70")}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition",
                  p.hecho ? "jd-logro border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30 group-hover:border-primary"
                )}
              >
                {p.hecho && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", p.hecho && "line-through decoration-muted-foreground/40")}>{p.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.detalle}</span>
              </span>
              {!p.hecho && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Carga los datos y decide si mostrarla (los primeros 14 días de la persona).
 * `forzar` la muestra igual (para que la dirección vea cómo queda).
 */
export async function PrimeraSemanaMiDia({ userId, nombre, rol, forzar = false }: { userId: string; nombre: string; rol: string; forzar?: boolean }) {
  const { createAdmin } = await import("@/lib/supabase/admin");
  const { pasosPrimeraSemana, mostrarPrimeraSemana } = await import("@/lib/equipo/primera-semana");
  const admin = createAdmin();
  const { data: u } = await admin.from("users").select("created_at, avatar_url").eq("id", userId).maybeSingle();
  const yo = u as { created_at: string | null; avatar_url: string | null } | null;
  if (!yo) return null;
  if (!forzar && (!yo.created_at || Date.now() - Date.parse(yo.created_at) > 14 * 86_400_000)) return null;
  const [{ count: push }, { data: uso }, { count: cerradas }, { count: mensajes }] = await Promise.all([
    admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("uso_secciones").select("seccion").eq("user_id", userId),
    admin.from("tasks").select("id", { count: "exact", head: true }).eq("asignado_a_id", userId).eq("estado", "completada"),
    admin.from("team_messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const pasos = pasosPrimeraSemana({
    tieneFoto: !!yo.avatar_url,
    tienePush: (push ?? 0) > 0,
    secciones: new Set(((uso ?? []) as { seccion: string }[]).map((x) => x.seccion)),
    cerroUnaTarea: (cerradas ?? 0) > 0,
    escribioEnElChat: (mensajes ?? 0) > 0,
    rol,
  });
  if (!forzar && !mostrarPrimeraSemana(yo.created_at, Date.now(), pasos)) return null;
  return <PrimeraSemana nombre={nombre} pasos={pasos} />;
}
