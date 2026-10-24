import { createAdmin } from "@/lib/supabase/admin";
import { BloquePlegable } from "@/components/bloque-plegable";
import { cargaDe, type Carga, type NivelCarga } from "@/lib/equipo/carga";
import { cn } from "@/lib/utils";

const NIVEL: Record<NivelCarga, { label: string; barra: string; chip: string }> = {
  desbordado: { label: "Desbordado", barra: "bg-red-500", chip: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
  al_limite: { label: "Al límite", barra: "bg-amber-400", chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  bien: { label: "Con aire", barra: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  sin_datos: { label: "Sin historia", barra: "bg-muted-foreground/40", chip: "bg-muted text-muted-foreground" },
};
const ORDEN: NivelCarga[] = ["desbordado", "al_limite", "bien", "sin_datos"];

/**
 * La carga de cada persona (19/10/2026), para la dirección y coordinación:
 * lo que tiene en los próximos 7 días (más lo vencido) contra lo que suele
 * cerrar por semana. El que está en rojo se va a atrasar si nadie reparte.
 */
export async function CargaEquipo() {
  const admin = createAdmin();
  const hoy = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const en7 = new Date(Date.parse(`${hoy}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const hace28 = new Date(Date.now() - 28 * 86_400_000).toISOString();
  const [{ data: us }, { data: abiertas }, { data: cerradas }] = await Promise.all([
    admin.from("users").select("id, nombre, rol, area").eq("activo", true).neq("rol", "admin").order("nombre"),
    admin
      .from("tasks")
      .select("asignado_a_id, fecha_limite, bloqueo")
      .not("estado", "in", "(completada,archivada)")
      .not("asignado_a_id", "is", null)
      .lte("fecha_limite", en7)
      .limit(5000),
    admin.from("tasks").select("asignado_a_id").eq("estado", "completada").gte("fecha_completada", hace28).limit(10000),
  ]);
  const personas = (us ?? []) as { id: string; nombre: string; rol: string; area: string | null }[];
  const abiertasPor = new Map<string, { p7: number; v: number }>();
  for (const t of (abiertas ?? []) as { asignado_a_id: string; fecha_limite: string; bloqueo?: string | null }[]) {
    if (t.bloqueo) continue; // trabadas: esperan a otro
    const e = abiertasPor.get(t.asignado_a_id) ?? { p7: 0, v: 0 };
    if (t.fecha_limite < hoy) e.v++;
    else e.p7++;
    abiertasPor.set(t.asignado_a_id, e);
  }
  const cerradasPor = new Map<string, number>();
  for (const t of (cerradas ?? []) as { asignado_a_id: string | null }[]) {
    if (t.asignado_a_id) cerradasPor.set(t.asignado_a_id, (cerradasPor.get(t.asignado_a_id) ?? 0) + 1);
  }
  const filas = personas
    .map((p) => {
      const a = abiertasPor.get(p.id) ?? { p7: 0, v: 0 };
      return { ...p, carga: cargaDe({ pendientes7: a.p7, vencidas: a.v, cerradas28: cerradasPor.get(p.id) ?? 0 }) as Carga };
    })
    .filter((f) => f.carga.pendientes > 0 || f.carga.capacidad > 0)
    .sort((a, b) => ORDEN.indexOf(a.carga.nivel) - ORDEN.indexOf(b.carga.nivel) || (b.carga.ratio ?? 0) - (a.carga.ratio ?? 0));
  if (!filas.length) return null;
  const desbordados = filas.filter((f) => f.carga.nivel === "desbordado").length;

  return (
    <BloquePlegable
      pegado
      emoji="⚖️"
      titulo="Carga del equipo, próximos 7 días"
      resumen={desbordados ? `${desbordados} desbordado${desbordados === 1 ? "" : "s"}: hay que repartir` : "Nadie desbordado"}
    >
      <ul className="jd-cascada divide-y">
        {filas.map((f) => {
          const n = NIVEL[f.carga.nivel];
          const ancho = f.carga.ratio == null ? 30 : Math.min(100, (f.carga.ratio / 2) * 100);
          return (
            <li key={f.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 px-4 py-2 text-sm">
              <span className="truncate font-medium">{f.nombre}</span>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-muted" title={`Tiene ${f.carga.pendientes}, cierra ~${f.carga.capacidad} por semana`}>
                {/* La marca de lo que suele cerrar: el 50% de la barra. */}
                <span className="absolute inset-y-0 left-1/2 z-10 w-px bg-foreground/30" />
                <span className={cn("block h-full rounded-full", n.barra)} style={{ width: `${Math.max(4, ancho)}%` }} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="tabular-nums text-muted-foreground">
                  {f.carga.pendientes} / {f.carga.capacidad || "–"}
                  {f.carga.vencidas > 0 && <span className="text-red-600"> · {f.carga.vencidas} venc.</span>}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 font-semibold", n.chip)}>{n.label}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        Tiene / cierra por semana (promedio del último mes). La rayita del medio es su ritmo normal: si la barra la pasa, se le juntó trabajo.
      </p>
    </BloquePlegable>
  );
}
