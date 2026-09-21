import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { tituloMadre, DIAS_ONBOARDING } from "@/lib/retencion/onboarding-15";
import {
  panoramaDeArranques,
  resumenDeArranques,
  type ArranqueCrudo,
  type PasoCrudo,
} from "@/lib/retencion/onboarding-panorama";
import { OnboardingPanorama } from "@/components/onboarding-panorama";

export const dynamic = "force-dynamic";

/**
 * Arranques: los onboardings de todas las cuentas nuevas, juntos.
 *
 * Nace el 21/9/2026 de dos problemas del mismo día: el onboarding no se creaba
 * nunca (cero tickets en la historia de la app) y, cuando se creaba, vivía
 * repartido en cuatro botones dentro de la ficha de cada cliente. Sin un lugar
 * donde verlos todos, nadie mira cómo arranca una cuenta — y el arranque es
 * donde se mueren: ninguna de las 7 bajas pasó de 3,2 meses.
 */
export default async function OnboardingPage() {
  const me = await requireUser();
  const admin = createAdmin();
  const puedeVer = userInRoles(me, ["admin", "coordinador"]);
  if (!puedeVer) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        Esta sección la ven la dirección y la coordinación.
      </div>
    );
  }

  // Los tickets madre del arranque y, de una, sus pasos.
  const { data: madresRaw } = await admin
    .from("tasks")
    .select("id, numero, titulo, cliente_id, cliente:clients(id, nombre, fecha_inicio)")
    .like("titulo", "Onboarding 15 días — %")
    .is("parent_id", null);

  const madres = ((madresRaw ?? []) as unknown as {
    id: string;
    numero: number | null;
    titulo: string;
    cliente_id: string | null;
    cliente: { id: string; nombre: string; fecha_inicio: string | null } | null;
  }[]).filter((m) => m.cliente);

  let pasos: (PasoCrudo & { parent_id: string })[] = [];
  if (madres.length) {
    const { data: pasosRaw } = await admin
      .from("tasks")
      .select(
        "id, numero, titulo, estado, area, fecha_limite, parent_id, asignado:users!tasks_asignado_a_id_fkey(nombre)"
      )
      .in(
        "parent_id",
        madres.map((m) => m.id)
      );
    pasos = ((pasosRaw ?? []) as unknown as {
      id: string;
      numero: number | null;
      titulo: string;
      estado: string;
      area: string | null;
      fecha_limite: string | null;
      parent_id: string;
      asignado: { nombre: string } | null;
    }[]).map((p) => ({
      id: p.id,
      numero: p.numero,
      titulo: p.titulo,
      estado: p.estado,
      area: p.area,
      fecha_limite: p.fecha_limite,
      parent_id: p.parent_id,
      asignado_nombre: p.asignado?.nombre ?? null,
    }));
  }

  const hoy = hoyYmd();
  const crudos: ArranqueCrudo[] = madres.map((m) => ({
    ticketId: m.id,
    numero: m.numero,
    clienteId: m.cliente!.id,
    clienteNombre: m.cliente!.nombre,
    // Si la cuenta no tiene fecha de inicio cargada, el plan se ancla al primer
    // paso; peor sería no mostrar el arranque.
    fechaInicio:
      m.cliente!.fecha_inicio?.slice(0, 10) ??
      pasos
        .filter((p) => p.parent_id === m.id)
        .map((p) => p.fecha_limite?.slice(0, 10) ?? hoy)
        .sort()[0] ??
      hoy,
    pasos: pasos.filter((p) => p.parent_id === m.id),
  }));

  const filas = panoramaDeArranques(crudos, hoy);
  const resumen = resumenDeArranques(filas);

  // Cuentas activas recientes que todavía no tienen su ticket: no debería
  // pasar (el cron lo arma solo), pero si pasa hay que verlo acá y no en la
  // base. Es el mismo problema que estuvo escondido tres meses.
  const { data: activasRaw } = await admin
    .from("clients")
    .select("id, nombre, fecha_inicio")
    .eq("estado", "activo")
    .eq("es_interno", false);
  const conTicket = new Set(madres.map((m) => m.cliente!.nombre));
  const sinArranque = ((activasRaw ?? []) as {
    id: string;
    nombre: string;
    fecha_inicio: string | null;
  }[]).filter((c) => {
    if (conTicket.has(c.nombre) || madres.some((m) => m.titulo === tituloMadre(c.nombre)))
      return false;
    if (!c.fecha_inicio) return false;
    const dias =
      (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${c.fecha_inicio.slice(0, 10)}T00:00:00Z`)) /
      86_400_000;
    return dias <= 30;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Arranques</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Los {DIAS_ONBOARDING} primeros días de cada cuenta nueva, todos juntos. Es donde se
          decide si la cuenta se queda: ninguna de las bajas de los últimos meses pasó de 3,2
          meses.
        </p>
      </div>

      {filas.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border bg-card px-3 py-1">
            <b>{resumen.enCurso}</b> arrancando
          </span>
          {resumen.conAtraso > 0 && (
            <span className="rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <b>{resumen.conAtraso}</b> con pasos atrasados ({resumen.pasosAtrasados} en total)
            </span>
          )}
        </div>
      )}

      {sinArranque.length > 0 && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {sinArranque.length} cuenta{sinArranque.length === 1 ? "" : "s"} activa
            {sinArranque.length === 1 ? "" : "s"} sin plan de arranque
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            {sinArranque.map((c) => c.nombre).join(", ")}. El cron de la noche lo arma solo; si
            mañana sigue acá, avisá.
          </p>
        </div>
      )}

      <OnboardingPanorama filas={filas} />
    </div>
  );
}
