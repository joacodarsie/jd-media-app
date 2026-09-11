import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { toARSFijos } from "@/lib/finanzas";
import { mergeSettings, type AgencySettings } from "@/lib/coordinacion";
import { prorrateoFijos } from "@/lib/finanzas/cotizador";
import { CotizadorPanel } from "@/components/cotizador-panel";

export const dynamic = "force-dynamic";

/**
 * Cotizador a medida.
 *
 * Existe porque desde que se cotiza personalizado —y no por pack de lista— el
 * precio se venía poniendo a ojo. Acá se arma la combinación real de
 * componentes y sale el costo, el margen y el precio que hay que cobrar.
 *
 * La diferencia con la economía por pack de Coordinación: esto sirve para algo
 * que TODAVÍA NO EXISTE como cliente, y descuenta la parte de gastos fijos que
 * le toca a la cuenta. Sin eso, una cuenta que "deja $59.000" puede estar
 * dejando $5.000 de verdad.
 */
export default async function CotizadorPage() {
  await requireFeature("finanzas");
  const admin = createAdmin();

  const [{ data: settingsRaw }, { data: subsRaw }, { data: clientsRaw }, rates] = await Promise.all([
    admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    admin.from("subscriptions").select("costo, moneda, ciclo, activa").eq("activa", true),
    admin.from("clients").select("id, es_interno").eq("estado", "activo"),
    getExchangeRates(),
  ]);

  const settings = mergeSettings(settingsRaw as Partial<AgencySettings> | null);

  // Gastos fijos del mes: las suscripciones activas, que es de donde salen los
  // gastos recurrentes que ya se generan solos todos los meses.
  const subs = (subsRaw ?? []) as { costo: number | null; moneda: string | null; ciclo: string | null }[];
  const fijosMensuales = subs.reduce((acc, s) => {
    const monto = Number(s.costo) || 0;
    if (monto <= 0) return acc;
    // Una suscripción anual pesa un doceavo por mes.
    const mensual = s.ciclo === "anual" ? monto / 12 : monto;
    return acc + toARSFijos(mensual, s.moneda ?? "ARS", rates);
  }, 0);

  const cuentasActivas = ((clientsRaw ?? []) as { es_interno: boolean }[]).filter(
    (c) => !c.es_interno
  ).length;

  const porCuenta = prorrateoFijos(fijosMensuales, cuentasActivas);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cotizador</h1>
        <p className="max-w-3xl text-muted-foreground">
          Armá lo que va a incluir la propuesta y mirá <b>cuánto te cuesta a vos</b> y qué precio
          tenés que poner. Las tarifas salen de{" "}
          <b>Coordinación → Tarifas</b>, así que si cambian los pagos al equipo, esto cambia solo.
        </p>
      </div>

      <CotizadorPanel
        rates={settings.rates}
        fijosProrrateados={porCuenta}
        cuentasActivas={cuentasActivas}
        fijosMensuales={Math.round(fijosMensuales)}
      />
    </div>
  );
}
