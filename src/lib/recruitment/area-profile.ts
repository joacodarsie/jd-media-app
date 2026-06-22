/**
 * Arma, para cada área de reclutamiento, un "perfil del puesto" automático a
 * partir de la tabla `positions` (los procesos/alcance que ya tiene cargada la
 * agencia). Eso se usa para precargar el perfil de una búsqueda y para que la IA
 * puntúe la aptitud sabiendo qué hace el rol y qué NO (editor ≠ diseñador).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// Valor del área en reclutamiento → `positions.area`.
const AREA_TO_POSITION: Record<string, string> = {
  cm: "Community Manager",
  diseno: "Diseño",
  edicion: "Edición Audiovisual",
  pauta: "Paid Media",
  desarrollo: "Desarrollo Web",
  comercial: "Comercial",
};

function asText(v: unknown): string {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join("\n");
  return typeof v === "string" ? v : "";
}

interface PositionRow {
  area: string;
  nombre: string | null;
  descripcion: string | null;
  alcance_incluye: string | null;
  alcance_excluye: string | null;
  kpis: string | null;
}

function compose(p: PositionRow): string {
  const parts: string[] = [];
  if (p.nombre) parts.push(`Puesto: ${p.nombre}.`);
  if (p.descripcion) parts.push(`Qué hace: ${p.descripcion}`);
  const inc = asText(p.alcance_incluye);
  if (inc) parts.push(`Incluye:\n${inc}`);
  const exc = asText(p.alcance_excluye);
  if (exc) parts.push(`NO incluye (es de otro rol):\n${exc}`);
  const k = asText(p.kpis);
  if (k) parts.push(`Se mide por (KPIs):\n${k}`);
  return parts.join("\n\n").slice(0, 2500);
}

/** Mapa { areaValue → texto de perfil } derivado de los puestos de la agencia. */
export async function buildAreaProfiles(
  admin: SupabaseClient
): Promise<Record<string, string>> {
  const { data } = await admin
    .from("positions")
    .select("area, nombre, descripcion, alcance_incluye, alcance_excluye, kpis");
  const byArea = new Map<string, PositionRow>();
  for (const p of (data ?? []) as PositionRow[]) {
    if (!byArea.has(p.area)) byArea.set(p.area, p);
  }
  const out: Record<string, string> = {};
  for (const [areaVal, posArea] of Object.entries(AREA_TO_POSITION)) {
    const p = byArea.get(posArea);
    if (p) out[areaVal] = compose(p);
  }
  return out;
}
