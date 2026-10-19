import { createAdmin } from "@/lib/supabase/admin";
import { NAV_GROUPS } from "@/lib/nav";
import { resumirUso, type FilaUso } from "@/lib/uso/resumen";

/**
 * «Qué se usa de la plataforma», en Dirección (19/10/2026): visitas de los
 * últimos 30 días por sección, sin contar al dueño, y las secciones del menú
 * que nadie abrió. Con esto se ordena y se poda el menú.
 */
export async function DireccionUso() {
  const admin = createAdmin();
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [{ data, error }, { data: admins }] = await Promise.all([
    admin.from("uso_secciones").select("user_id, seccion, dia, vistas").gte("dia", desde).limit(20000),
    admin.from("users").select("id").eq("rol", "admin"),
  ]);
  if (error) return null; // sin la 0204
  const delMenu = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.label));
  const { secciones, nunca, dias } = resumirUso(
    (data ?? []) as FilaUso[],
    delMenu,
    new Set(((admins ?? []) as { id: string }[]).map((a) => a.id))
  );
  const max = Math.max(1, ...secciones.map((s) => s.vistas));

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-baseline gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">📊 Qué usa el equipo de la plataforma</h2>
        <span className="text-xs text-muted-foreground">
          {dias === 0 ? "se empezó a medir hoy" : `últimos ${Math.min(dias, 30)} día${dias === 1 ? "" : "s"}, sin contarte a vos`}
        </span>
      </div>
      <div className="space-y-4 p-4">
        {secciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay visitas del equipo. En unos días se ve qué secciones usan y cuáles nadie abre.
          </p>
        ) : (
          <ul className="jd-cascada space-y-1.5">
            {secciones.slice(0, 15).map((s) => (
              <li key={s.seccion} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate">{s.seccion}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (s.vistas / max) * 100)}%` }} />
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {s.vistas} · {s.personas} {s.personas === 1 ? "persona" : "personas"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {secciones.length > 0 && nunca.length > 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
            <b>Nadie las abrió:</b> {nunca.join(", ")}.{" "}
            <span className="text-muted-foreground">Candidatas a esconder o a juntar con otra.</span>
          </div>
        )}
      </div>
    </section>
  );
}
