/**
 * ¿Este cobro salió con factura?
 *
 * El dato vive en `client_invoices` (migración 0164). Como las migraciones las
 * aplica el dueño y el deploy va antes, todo lo de acá tiene que tolerar que la
 * columna todavía no exista: en ese caso `disponible` vuelve en false y la app
 * esconde la columna en vez de romperse. Cuando la migración entra, la función
 * se enciende sola sin tocar código.
 */

/** Cliente con el mínimo que usamos. `from` devuelve el query builder de Supabase. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = { from: (table: string) => any };

export interface FacturaState {
  facturado: boolean;
  factura_nro: string | null;
  facturado_at: string | null;
}

export interface FacturacionLookup {
  /** false = la migración 0164 no está aplicada todavía. */
  disponible: boolean;
  byId: Map<string, FacturaState>;
}

const VACIO: FacturacionLookup = { disponible: false, byId: new Map() };

/**
 * Trae el estado de facturación de los cobros de un período. Va en una consulta
 * aparte a propósito: si se pidieran estas columnas dentro del select principal,
 * una migración sin aplicar tiraría abajo toda la pantalla de cobros.
 */
export async function fetchFacturacion(
  db: DbLike,
  periodo?: string | null
): Promise<FacturacionLookup> {
  try {
    let q = db.from("client_invoices").select("id, facturado, factura_nro, facturado_at");
    if (periodo) q = q.eq("periodo", periodo);
    const { data, error } = await q;
    if (error) return VACIO;
    const byId = new Map<string, FacturaState>();
    for (const r of (data ?? []) as Array<{
      id: string;
      facturado: boolean | null;
      factura_nro: string | null;
      facturado_at: string | null;
    }>) {
      byId.set(r.id, {
        facturado: !!r.facturado,
        factura_nro: r.factura_nro ?? null,
        facturado_at: r.facturado_at ?? null,
      });
    }
    return { disponible: true, byId };
  } catch {
    return VACIO;
  }
}

/**
 * Cuánto se facturó en los últimos 12 meses, en pesos.
 *
 * Es EL número de ARCA: el monotributo se mide por lo facturado en los doce
 * meses corridos hacia atrás, no por el año calendario ni por el mes suelto.
 * Va por `facturado_at` y no por el período del cobro, porque lo que cuenta
 * para el fisco es cuándo se emitió la factura.
 *
 * Devuelve null si la migración 0164 no está aplicada (no hay dato que dar) o
 * si la consulta falla: mejor no mostrar nada que mostrar un número inventado.
 */
export async function fetchFacturadoUltimos12Meses(
  db: DbLike,
  hoy: string
): Promise<{ monto: number; desde: string } | null> {
  // Doce meses corridos: del mismo día del año pasado hasta hoy.
  const d = new Date(hoy + "T00:00:00");
  d.setFullYear(d.getFullYear() - 1);
  const desde = d.toISOString().slice(0, 10);
  try {
    const { data, error } = await db
      .from("client_invoices")
      .select("monto, moneda, facturado_at")
      .eq("facturado", true)
      .gte("facturado_at", desde)
      .lte("facturado_at", hoy);
    if (error) return null;
    // Solo pesos: lo que va a ARCA se factura en pesos. Un cobro en dólares
    // facturado se emite igual en pesos, así que el monto ya viene convertido.
    const monto = ((data ?? []) as Array<{ monto: number }>).reduce(
      (a, r) => a + Number(r.monto),
      0
    );
    return { monto, desde };
  } catch {
    return null;
  }
}

/**
 * Cuánto de lo que entró está facturado. Es la pregunta de ARCA y la respuesta
 * tiene que ser en plata, no en cantidad de cobros: diez facturas chicas hechas
 * y una grande sin hacer no es "91% facturado".
 *
 * Solo cuenta lo COBRADO: lo que todavía no te pagaron no debería estar
 * facturado, así que meterlo en el denominador daría un número alarmante y falso.
 */
export function resumenFacturacion(
  rows: Array<{
    fecha_cobro: string | null;
    facturado?: boolean | null;
    monto: number;
    moneda: string;
  }>,
  aArs: (monto: number, moneda: string) => number
): { facturado: number; sinFactura: number; total: number; pct: number; cuentaSinFactura: number } {
  let facturado = 0;
  let sinFactura = 0;
  let cuentaSinFactura = 0;
  for (const r of rows) {
    if (!r.fecha_cobro) continue;
    const ars = aArs(Number(r.monto), r.moneda);
    if (r.facturado) {
      facturado += ars;
    } else {
      sinFactura += ars;
      cuentaSinFactura += 1;
    }
  }
  const total = facturado + sinFactura;
  return {
    facturado,
    sinFactura,
    total,
    pct: total > 0 ? facturado / total : 0,
    cuentaSinFactura,
  };
}
