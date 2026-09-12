import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings, type AgencySettings } from "@/lib/coordinacion";
import { CotizadorPanel } from "@/components/cotizador-panel";

export const dynamic = "force-dynamic";

/**
 * Cotizador a medida.
 *
 * Existe porque desde que se cotiza personalizado —y no por pack de lista— el
 * precio se venía poniendo a ojo. Acá se arma la combinación real de
 * componentes y sale el costo, lo que deja el primer mes, lo que deja de ahí en
 * adelante y el precio mínimo con el que no se pierde plata.
 *
 * Los gastos fijos de la agencia no entran: se pagan con este cliente o sin él,
 * así que cargárselos a una cotización hace parecer que una cuenta rentable da
 * pérdida. La pregunta de si la estructura queda cubierta es de la cartera
 * entera y se responde en Finanzas, no acá.
 */
export default async function CotizadorPage() {
  await requireFeature("finanzas");
  const admin = createAdmin();

  const { data: settingsRaw } = await admin
    .from("agency_settings")
    .select("packs, rates")
    .eq("id", 1)
    .maybeSingle();

  const settings = mergeSettings(settingsRaw as Partial<AgencySettings> | null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cotizador</h1>
        <p className="max-w-3xl text-muted-foreground">
          Armá lo que va a incluir la propuesta y mirá <b>cuánto te cuesta a vos</b> y qué precio
          tenés que poner. Las tarifas salen de <b>Coordinación → Tarifas</b>, así que si cambian
          los pagos al equipo, esto cambia solo.
        </p>
      </div>

      <CotizadorPanel rates={settings.rates} />
    </div>
  );
}
