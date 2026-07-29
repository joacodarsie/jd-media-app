// Generación de los GASTOS FIJOS del mes a partir de las suscripciones activas.
//
// Por qué existe: la columna "real" de Finanzas estaba vacía no porque no se
// supieran los gastos, sino porque nadie va a re-tipear las mismas 14 líneas
// (Claude, Canva, monotributo, pauta…) todos los meses. Las suscripciones ya
// están cargadas con su costo y su moneda: el mes se arma solo, igual que las
// facturas de los clientes.
//
// Idempotente: busca por concepto + período, así que se puede correr mil veces.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface SubscriptionRow {
  id: string;
  nombre: string;
  categoria: string | null;
  costo: number | null;
  moneda: string | null;
  ciclo: string | null;
  activa: boolean | null;
}

export interface ExpenseToCreate {
  categoria: string;
  proveedor: string;
  concepto: string;
  monto: number;
  moneda: string;
  periodo: string;
  recurrente: true;
}

/** Categorías válidas de gasto; cualquier otra cae en "otros". */
const CATEGORIAS = new Set([
  "plataformas",
  "ads",
  "servicios",
  "impuestos",
  "bancos",
  "oficina",
  "equipamiento",
  "otros",
]);

/** El concepto es la clave de deduplicación: mismo texto = mismo gasto del mes. */
export function conceptoDeSuscripcion(nombre: string, periodo: string): string {
  return `${nombre.trim()} — ${periodo}`;
}

/**
 * Qué gastos habría que crear para el período. Puro: entra la lista de
 * suscripciones y los conceptos que ya existen, sale lo que falta.
 *
 * Solo toma las MENSUALES activas con costo: las anuales se cargan a mano el mes
 * que toca (si no, inflarían todos los meses por igual).
 */
export function subsToExpenses(
  subs: SubscriptionRow[],
  periodo: string,
  conceptosExistentes: string[]
): ExpenseToCreate[] {
  const yaEstan = new Set(conceptosExistentes.map((c) => c.trim().toLowerCase()));
  const out: ExpenseToCreate[] = [];

  for (const s of subs) {
    if (s.activa === false) continue;
    if ((s.ciclo ?? "mensual") !== "mensual") continue;
    const monto = Number(s.costo);
    if (!Number.isFinite(monto) || monto <= 0) continue;

    const concepto = conceptoDeSuscripcion(s.nombre, periodo);
    if (yaEstan.has(concepto.trim().toLowerCase())) continue;
    yaEstan.add(concepto.trim().toLowerCase());

    out.push({
      categoria: CATEGORIAS.has(s.categoria ?? "") ? (s.categoria as string) : "otros",
      proveedor: s.nombre.trim().slice(0, 120),
      concepto,
      monto,
      moneda: s.moneda || "ARS",
      periodo,
      recurrente: true,
    });
  }

  return out;
}

export interface GeneratedExpenses {
  creados: number;
  yaExistian: number;
}

/**
 * Crea en la base los gastos fijos que falten del período. Los deja PENDIENTES
 * (sin fecha de pago): la idea es que estén listos para marcar "pagué", no dar
 * por hecho que ya se pagaron.
 */
export async function generateFixedExpensesForPeriod(
  admin: SupabaseClient,
  periodo: string,
  creadoPorId: string | null
): Promise<GeneratedExpenses> {
  const [{ data: subsRaw }, { data: existingRaw }] = await Promise.all([
    admin.from("subscriptions").select("id, nombre, categoria, costo, moneda, ciclo, activa"),
    admin.from("expenses").select("concepto").eq("periodo", periodo),
  ]);

  const subs = ((subsRaw ?? []) as SubscriptionRow[]).filter((s) => s.activa !== false);
  const existentes = ((existingRaw ?? []) as { concepto: string }[]).map((e) => e.concepto);
  const aCrear = subsToExpenses(subs, periodo, existentes);

  if (aCrear.length === 0) return { creados: 0, yaExistian: existentes.length };

  const { error } = await admin.from("expenses").insert(
    aCrear.map((e) => ({ ...e, creado_por_id: creadoPorId }))
  );
  if (error) throw new Error(error.message);

  return { creados: aCrear.length, yaExistian: existentes.length };
}
