import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { tituloMadre } from "@/lib/retencion/onboarding-15";
import { arranquesPorCuenta, cargarPanoramaArranques } from "@/lib/retencion/onboarding-panorama-run";
import { computeAccountHealth } from "@/lib/director/health";
import { cargarCuentasNuevas } from "@/lib/retencion/cuentas-nuevas-run";
import { tableroCuentasNuevas } from "@/lib/retencion/cuentas-nuevas";
import { cuentaParaPm, ordenarPm, resumenPm } from "@/lib/pm/tablero";
import { PmTablero } from "@/components/pm-tablero";

export const dynamic = "force-dynamic";

/**
 * Project Manager (antes «Cuentas nuevas», 20/10/2026): el tablero de Luz.
 * Una tarjeta por cuenta nueva con gestión de redes: lo que hay que responder
 * hoy (las preguntas del arranque, Sí o No), los pasos atrasados con quién los
 * tiene, lo que está en pausa esperando al cliente y lo que viene.
 *
 * Por qué: los arranques son donde se mueren las cuentas (ninguna baja pasó de
 * 3,2 meses) y la sección anterior mostraba números («13 de 14 · 1 atrasado»)
 * sin decir qué paso ni dejar resolverlo desde ahí.
 */
export default async function ProjectManagerPage() {
  const me = await requireUser();
  const admin = createAdmin();
  if (!userInRoles(me, ["admin", "coordinador"])) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        Esta sección la ven la dirección y la coordinación.
      </div>
    );
  }

  const hoy = hoyYmd();
  const { filas, madres } = await cargarPanoramaArranques(admin, hoy);
  const salud = await computeAccountHealth(admin).catch(() => null);
  const { cuentas } = await cargarCuentasNuevas(admin, hoy, {
    arranques: arranquesPorCuenta(filas),
    salud: new Map((salud?.cuentas ?? []).map((c) => [c.id, { semaforo: c.semaforo, alertas: c.alertas }])),
  });
  // Solo las cuentas con gestión de redes: un proyecto de marca (Simple Snack)
  // o una web no se manejan desde acá.
  const conRedes = new Set(cuentas.filter((c) => c.conRedes !== false).map((c) => c.id));
  const tablero = tableroCuentasNuevas(cuentas, hoy).filter((c) => conRedes.has(c.id));
  // Si una cuenta tiene dos arranques (cambio de nombre), manda el que sigue abierto.
  const arranqueDe = new Map<string, (typeof filas)[number]>();
  for (const f of filas) {
    const ya = arranqueDe.get(f.clienteId);
    if (!ya || ya.terminado) arranqueDe.set(f.clienteId, f);
  }
  const pm = ordenarPm(tablero.map((c) => cuentaParaPm(c, arranqueDe.get(c.id) ?? null, hoy)));
  const res = resumenPm(pm);

  // Cuentas activas recientes sin su plan de arranque: no debería pasar (el
  // cron lo arma solo), pero si pasa hay que verlo acá y no en la base.
  const { data: activasRaw } = await admin
    .from("clients")
    .select("id, nombre, fecha_inicio")
    .eq("estado", "activo")
    .eq("es_interno", false);
  const conTicket = new Set(madres.map((m) => m.cliente!.nombre));
  const sinArranque = ((activasRaw ?? []) as { id: string; nombre: string; fecha_inicio: string | null }[]).filter((c) => {
    if (!conRedes.has(c.id)) return false;
    if (conTicket.has(c.nombre) || madres.some((m) => m.titulo === tituloMadre(c.nombre))) return false;
    if (!c.fecha_inicio) return false;
    const dias = (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${c.fecha_inicio.slice(0, 10)}T00:00:00Z`)) / 86_400_000;
    return dias <= 30;
  });

  const nada = res.preguntas + res.atrasados === 0;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Project Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cómo viene cada cuenta en sus primeros 90 días y qué destrabar hoy. Ninguna de las bajas de la agencia pasó de 3,2 meses: acá se decide si se queda.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra n={res.preguntas} texto={res.preguntas === 1 ? "pregunta para responder" : "preguntas para responder"} tono={res.preguntas ? "primario" : "neutro"} />
        <Cifra n={res.atrasados} texto={res.atrasados === 1 ? "paso atrasado" : "pasos atrasados"} tono={res.atrasados ? "rojo" : "neutro"} />
        <Cifra n={res.pausados} texto="en pausa por el cliente" tono={res.pausados ? "naranja" : "neutro"} />
        <Cifra n={res.enRiesgo} texto={`de ${res.cuentas} cuentas en riesgo`} tono={res.enRiesgo ? "rojo" : "neutro"} />
      </div>
      {nada && pm.length > 0 && <p className="text-sm text-emerald-700 dark:text-emerald-400">Todo al día: no hay preguntas ni pasos atrasados.</p>}

      {sinArranque.length > 0 && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {sinArranque.length === 1 ? "1 cuenta activa sin plan de arranque" : `${sinArranque.length} cuentas activas sin plan de arranque`}
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            {sinArranque.map((c) => c.nombre).join(", ")}. El cron de la noche lo arma solo; si mañana sigue acá, avisá.
          </p>
        </div>
      )}

      <PmTablero cuentas={pm} />
    </div>
  );
}

function Cifra({ n, texto, tono }: { n: number; texto: string; tono: "primario" | "rojo" | "naranja" | "neutro" }) {
  const cls = {
    primario: "border-primary/40 bg-primary/5",
    rojo: "border-rose-400/50 bg-rose-50/60 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300",
    naranja: "border-orange-400/50 bg-orange-50/60 text-orange-800 dark:bg-orange-950/20 dark:text-orange-300",
    neutro: "bg-card text-muted-foreground",
  }[tono];
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <div className="text-2xl font-bold tabular-nums">{n}</div>
      <div className="text-xs">{texto}</div>
    </div>
  );
}
