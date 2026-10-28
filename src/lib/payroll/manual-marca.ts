// Manual de marca de una cuenta nueva: se le paga a quien diseña la cuenta la
// tarifa `manual_marca` en el mes en que lo terminó (el paso «Manual de marca»
// del onboarding de diseño, client_onboarding.dg_manual_marca_at).
//
// Estaba en la tarifa y en «cómo cobrás» del equipo, pero la nómina nunca lo
// pagaba: se agregaba a mano en la planilla de honorarios (Brisa por CATCH y
// Nazar en septiembre de 2026).
//
// Solo cuenta nueva: el manual tiene que estar hecho en el mes de arranque o el
// siguiente. Un rediseño de una cuenta vieja (Magic y Amelia marcaron el paso
// en octubre, pero su manual se pagó en julio) no se vuelve a pagar solo; si
// corresponde, va como extra.

import type { PayrollClient, PayrollLine } from "../payroll";
import { nextPeriod } from "../finanzas";

export interface ManualHecho {
  cliente_id: string;
  dg_manual_marca_at: string | null;
}

export function computeManualMarcaLines(
  clients: PayrollClient[],
  manuales: ManualHecho[],
  overrideClientIds: Set<string>,
  monto: number,
  periodo: string
): Map<string, PayrollLine[]> {
  const out = new Map<string, PayrollLine[]>();
  if (monto <= 0) return out;
  const byId = new Map(clients.map((c) => [c.id, c]));
  for (const m of manuales) {
    if ((m.dg_manual_marca_at ?? "").slice(0, 7) !== periodo) continue;
    const c = byId.get(m.cliente_id);
    if (!c?.disenador_id) continue;
    if (overrideClientIds.has(c.id)) continue; // el acuerdo fijo cubre todo
    const mesInicio = (c.fecha_inicio ?? "").slice(0, 7);
    if (mesInicio && periodo !== mesInicio && periodo !== nextPeriod(mesInicio)) continue;
    if (!out.has(c.disenador_id)) out.set(c.disenador_id, []);
    out.get(c.disenador_id)!.push({
      clienteId: c.id,
      cliente: c.nombre,
      concepto: "Manual de marca",
      monto,
      kind: "diseno",
    });
  }
  return out;
}
