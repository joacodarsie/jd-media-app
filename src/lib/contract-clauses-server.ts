import type { ContractClauseOverrides } from "./contract-clauses";

/** Cliente con el mínimo que usamos. `from` devuelve el query builder de Supabase. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = { from: (table: string) => any };

/**
 * Lee los overrides de cláusulas de la carta acuerdo de forma RESILIENTE: si la
 * columna `contract_clauses` todavía no existe (migración 0121 sin aplicar),
 * devuelve null y la carta usa los textos por defecto. Así el deploy nunca rompe
 * la carta aunque la migración vaya después.
 */
export async function fetchClauseOverrides(
  db: DbLike
): Promise<ContractClauseOverrides | null> {
  try {
    const { data, error } = await db
      .from("agency_settings")
      .select("contract_clauses")
      .eq("id", 1)
      .maybeSingle();
    if (error) return null;
    const row = data as { contract_clauses?: ContractClauseOverrides } | null;
    return row?.contract_clauses ?? null;
  } catch {
    return null;
  }
}
