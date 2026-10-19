import Link from "next/link";
import { createAdmin } from "@/lib/supabase/admin";
import { computeAccountHealth } from "@/lib/director/health";
import { NumeroVivo } from "@/components/numero-vivo";
import { cn } from "@/lib/utils";

/**
 * «El pulso de la agencia», arriba de Dirección (19/10/2026): los cinco
 * números que importan, de un vistazo, cada uno con su link al detalle. Antes
 * había que bajar toda la página para armarse el panorama.
 */
export async function PulsoAgencia() {
  const admin = createAdmin();
  const hoy = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const periodo = hoy.slice(0, 7);
  const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [salud, { count: vencidas }, { count: reuniones }, { count: cuentas }, { data: web }] = await Promise.all([
    computeAccountHealth(admin).catch(() => null),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .not("estado", "in", "(completada,archivada)")
      .lt("fecha_limite", hoy)
      .is("bloqueo", null),
    admin.from("client_meetings").select("id", { count: "exact", head: true }).eq("periodo", periodo),
    admin.from("clients").select("id", { count: "exact", head: true }).eq("estado", "activo").eq("es_interno", false),
    admin.from("web_eventos").select("tipo").gte("created_at", hace7).in("tipo", ["whatsapp", "formulario", "diagnostico"]),
  ]);
  const rojas = salud?.resumen.mal ?? 0;
  const consultas = (web ?? []).length;

  const datos: { valor: number; sufijo?: string; label: string; detalle: string; href: string; tono: "rojo" | "ambar" | "verde" | "neutro" }[] = [
    {
      valor: rojas,
      label: "cuentas en rojo",
      detalle: `de ${salud?.resumen.total ?? cuentas ?? 0} activas`,
      href: "/clientes",
      tono: rojas === 0 ? "verde" : rojas <= 3 ? "ambar" : "rojo",
    },
    {
      valor: vencidas ?? 0,
      label: "tareas vencidas",
      detalle: "de todo el equipo",
      href: "/tareas",
      tono: (vencidas ?? 0) === 0 ? "verde" : (vencidas ?? 0) <= 20 ? "ambar" : "rojo",
    },
    {
      valor: reuniones ?? 0,
      sufijo: ` / ${cuentas ?? 0}`,
      label: "reuniones del mes",
      detalle: "hechas con los clientes",
      href: "/comercial/reuniones",
      tono: (reuniones ?? 0) >= (cuentas ?? 0) * 0.8 ? "verde" : (reuniones ?? 0) >= (cuentas ?? 0) * 0.4 ? "ambar" : "rojo",
    },
    {
      valor: consultas,
      label: "consultas de la web",
      detalle: "esta semana",
      href: "/direccion#web",
      tono: consultas >= 5 ? "verde" : consultas >= 1 ? "ambar" : "rojo",
    },
  ];

  const TONO = {
    rojo: "text-rose-600 dark:text-rose-400",
    ambar: "text-amber-600 dark:text-amber-400",
    verde: "text-emerald-600 dark:text-emerald-400",
    neutro: "text-foreground",
  } as const;
  const PUNTO = { rojo: "bg-rose-500", ambar: "bg-amber-500", verde: "bg-emerald-500", neutro: "bg-muted-foreground" } as const;

  return (
    <section className="jd-cascada grid grid-cols-2 gap-3 md:grid-cols-4">
      {datos.map((d) => (
        <Link
          key={d.label}
          href={d.href}
          className="group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className={cn("absolute right-3 top-3 h-2 w-2 rounded-full", PUNTO[d.tono], d.tono === "rojo" && "animate-pulse")} />
          <div className={cn("text-3xl font-bold tabular-nums tracking-tight", TONO[d.tono])}>
            <NumeroVivo valor={d.valor} sufijo={d.sufijo} />
          </div>
          <div className="mt-1 text-sm font-medium">{d.label}</div>
          <div className="text-xs text-muted-foreground">{d.detalle}</div>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
        </Link>
      ))}
    </section>
  );
}
