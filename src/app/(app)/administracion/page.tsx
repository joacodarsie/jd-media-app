import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod, fmtARS } from "@/lib/finanzas";
import { cargarCobrosDelMes, cuantasFaltanCobrar } from "@/lib/finanzas/cobros-mes";
import { cargarJornadas } from "@/lib/jornadas/cargar";
import { estadoJornada, repartoJornada } from "@/lib/jornadas/registro";
import { hoyYmd } from "@/lib/dates";
import { AREAS_PLAN, PLAN_ADMINISTRACION } from "@/lib/administracion/plan";

export const dynamic = "force-dynamic";

/**
 * Administración y Personas: el lugar de trabajo de quien se hace cargo de la
 * plata, lo legal y el equipo. No repite pantallas: muestra qué hay pendiente
 * en cada una y lleva ahí con un clic.
 */
export default async function AdministracionPage() {
  const me = await requireUser();
  if (me.rol !== "admin") redirect("/dashboard");

  const admin = createAdmin();
  const hoy = hoyYmd();
  const [{ filas }, jornadas, clientes, usuarios, contratos, busquedas, tareas] = await Promise.all([
    cargarCobrosDelMes(currentPeriod()),
    cargarJornadas(admin),
    admin.from("clients").select("id, contrato_numero, contacto_dni_cuit").eq("estado", "activo").eq("es_interno", false),
    admin.from("users").select("id").eq("activo", true),
    admin.from("freelance_contracts").select("user_id, estado, signed_at"),
    admin.from("recruitment_searches").select("id").eq("estado", "abierta").eq("es_pool", false),
    admin.from("tasks").select("rutina_key, estado").like("rutina_key", "adm:%"),
  ]);

  const faltanCobrar = cuantasFaltanCobrar(filas);
  const porPagar = jornadas.filter((j) => estadoJornada(j, hoy) === "pagar");
  const debeJornadas = porPagar.reduce((n, j) => n + repartoJornada(j).faltaPagar, 0);
  const cuentas = (clientes.data ?? []) as { contrato_numero: string | null; contacto_dni_cuit: string | null }[];
  const sinContrato = cuentas.filter((c) => !c.contrato_numero).length;
  const sinCuit = cuentas.filter((c) => !c.contacto_dni_cuit).length;
  const activos = new Set(((usuarios.data ?? []) as { id: string }[]).map((u) => u.id));
  const firmados = new Set(
    ((contratos.data ?? []) as { user_id: string; estado: string; signed_at: string | null }[]).filter((c) => (c.signed_at || c.estado === "activo") && activos.has(c.user_id)).map((c) => c.user_id)
  );
  const sinAcuerdo = activos.size - firmados.size;
  const estadoTarea = new Map(((tareas.data ?? []) as { rutina_key: string; estado: string }[]).map((t) => [t.rutina_key, t.estado]));

  const tarjetas = [
    { emoji: "💰", titulo: "Cobros del mes", numero: faltanCobrar, detalle: faltanCobrar === 1 ? "cuenta sin saldar" : "cuentas sin saldar", href: "/cobros" },
    { emoji: "🎬", titulo: "Jornadas por pagar", numero: porPagar.length, detalle: debeJornadas ? `${fmtARS(debeJornadas)} al equipo` : "al día", href: "/jornadas" },
    { emoji: "🧾", titulo: "Sueldos", numero: null, detalle: "Liquidación del mes", href: "/coordinacion/sueldos" },
    { emoji: "📑", titulo: "Clientes sin contrato", numero: sinContrato, detalle: `${sinCuit} sin CUIT cargado`, href: "/clientes" },
    { emoji: "✍️", titulo: "Equipo sin acuerdo vigente", numero: sinAcuerdo, detalle: `de ${activos.size} personas, según la plataforma`, href: "/contratos" },
    { emoji: "🔎", titulo: "Búsquedas abiertas", numero: (busquedas.data ?? []).length, detalle: "Selección de personas", href: "/reclutamiento" },
  ];

  const hechos = PLAN_ADMINISTRACION.filter((p) => estadoTarea.get(`adm:${p.clave}`) === "completada").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administración y Personas</h1>
        <p className="text-sm text-muted-foreground">La plata, lo legal y el equipo, en un solo lugar.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tarjetas.map((t) => (
          <Link key={t.titulo} href={t.href} className="rounded-2xl border bg-card p-4 transition-colors hover:border-primary/60">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                <span aria-hidden="true">{t.emoji}</span> {t.titulo}
              </span>
              {t.numero !== null && <span className="text-2xl font-bold tabular-nums">{t.numero}</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.detalle}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="font-semibold">Plan de arranque</h2>
          <span className="text-sm tabular-nums text-muted-foreground">{hechos} de {PLAN_ADMINISTRACION.length}</span>
        </div>
        <div className="divide-y">
          {AREAS_PLAN.map((a) => (
            <div key={a.area} className="px-4 py-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span aria-hidden="true">{a.emoji}</span> {a.titulo}
              </h3>
              <ul className="space-y-2">
                {PLAN_ADMINISTRACION.filter((p) => p.area === a.area).map((p) => {
                  const hecho = estadoTarea.get(`adm:${p.clave}`) === "completada";
                  return (
                    <li key={p.clave} className="flex items-start gap-2 text-sm">
                      {hecho ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span>
                        <span className="font-medium">{p.titulo}</span>
                        <span className="block text-xs text-muted-foreground">{p.hecho}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
