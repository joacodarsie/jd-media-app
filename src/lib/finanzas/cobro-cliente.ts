/**
 * El cobro de un cliente en un mes = TODAS sus facturas de ese mes.
 *
 * Por qué existe (12/10/2026): el generador crea una factura por servicio
 * (redes, WhatsApp, chatter…), pero la pantalla de Cobros mostraba una sola por
 * cliente — Nazar Hogar figuraba con $50.000 en vez de $475.000 — y "Me pagó"
 * pisaba el monto de una factura con el de otra. Las facturas por servicio se
 * quedan (sirven para el detalle); lo que cambia es que el cobro se mira junto.
 *
 * Puro: entra lo que hay en la base, sale el cobro del cliente.
 */

export interface FacturaMes {
  id: string;
  monto: number;
  fecha_cobro: string | null;
  created_at?: string | null;
  concepto?: string | null;
  notas?: string | null;
  gestion_estado?: string | null;
}

export interface Entrega {
  id: string;
  monto: number;
  fecha: string;
  nota: string | null;
}

/**
 * La factura principal: la de mayor monto (el abono de redes, casi siempre).
 * Ahí van la nota, la etapa, las entregas a cuenta y los ajustes del total.
 */
export function ordenarFacturas<T extends FacturaMes>(facturas: T[]): T[] {
  return [...facturas].sort(
    (a, b) => b.monto - a.monto || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id)
  );
}

/** "Freedom · gestion_whatsapp — 2026-10" → "gestion whatsapp". */
export function nombreServicio(concepto: string | null | undefined): string {
  const medio = (concepto ?? "").split(" · ")[1] ?? concepto ?? "";
  return medio.split(" — ")[0].replace(/_/g, " ").trim() || "servicio";
}

export interface CobroCliente {
  /** Lo que tiene que pagar en el mes: la suma de todas sus facturas. */
  monto: number;
  /** Fecha del cobro si TODAS están cobradas (la última). */
  cobradoEl: string | null;
  /** Entregas a cuenta + los servicios que ya pagó por separado. */
  pagos: Entrega[];
  principalId: string | null;
  nota: string | null;
  etapa: string | null;
  cantidad: number;
}

export function cobroDelCliente(facturas: FacturaMes[], entregas: Map<string, Entrega[]>): CobroCliente {
  const orden = ordenarFacturas(facturas);
  const principal = orden[0] ?? null;
  const todasPagas = orden.length > 0 && orden.every((f) => !!f.fecha_cobro);
  const pagos: Entrega[] = [];
  for (const f of orden) {
    if (f.fecha_cobro && !todasPagas) {
      // Un servicio pagado por separado cuenta como una entrega del total. Id
      // con prefijo: no se puede borrar como entrega (se deshace el cobro).
      pagos.push({ id: `factura:${f.id}`, monto: f.monto, fecha: f.fecha_cobro, nota: `${nombreServicio(f.concepto)} (pagado aparte)` });
    } else if (!f.fecha_cobro) {
      pagos.push(...(entregas.get(f.id) ?? []));
    }
  }
  return {
    monto: orden.reduce((a, f) => a + f.monto, 0),
    cobradoEl: todasPagas ? orden.map((f) => f.fecha_cobro!).sort().at(-1)! : null,
    pagos: pagos.sort((a, b) => a.fecha.localeCompare(b.fecha)),
    principalId: principal?.id ?? null,
    nota: principal?.notas ?? null,
    etapa: principal?.gestion_estado ?? null,
    cantidad: orden.length,
  };
}

/**
 * Para llevar el total del mes a `nuevoTotal` sin tocar los demás servicios:
 * cuánto tiene que valer la factura principal. null si no alcanza (el total
 * pedido es menor que lo que suman los otros servicios).
 */
export function montoPrincipalPara(facturas: FacturaMes[], nuevoTotal: number): number | null {
  const [principal, ...resto] = ordenarFacturas(facturas);
  if (!principal) return nuevoTotal;
  const otros = resto.reduce((a, f) => a + f.monto, 0);
  const m = nuevoTotal - otros;
  return m > 0 ? m : null;
}
