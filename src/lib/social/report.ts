/**
 * Agregación de resultados de Instagram para el REPORTE MENSUAL del cliente.
 * Toma los snapshots diarios del mes y devuelve los números que el cliente quiere
 * ver: seguidores totales, cuántos sumó en el mes, y el alcance / visitas al
 * perfil / interacciones de los últimos 28 días (el rollup que guarda el sync).
 *
 * Devuelve null en cada campo si no hay datos, para que el reporte caiga al valor
 * cargado a mano (la sección orgánica sigue editable para clientes sin IG conectado).
 */
import { createAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdmin>;

export interface IgMonthly {
  connected: boolean; // el cliente tiene cuenta de IG conectada
  hasData: boolean; // hay al menos un snapshot en el mes
  followersEnd: number | null; // seguidores al cierre del mes
  seguidoresNuevos: number | null; // delta de seguidores dentro del mes
  reach: number | null; // alcance (28 días) al cierre del mes
  profileViews: number | null; // visitas al perfil (28 días)
  interactions: number | null; // interacciones (28 días)
}

interface SnapRow {
  fecha: string;
  followers: number;
  detalle: {
    month?: { reach?: number; profile_views?: number; interactions?: number };
  } | null;
}

const EMPTY: IgMonthly = {
  connected: false,
  hasData: false,
  followersEnd: null,
  seguidoresNuevos: null,
  reach: null,
  profileViews: null,
  interactions: null,
};

/** `mes` en formato YYYY-MM. */
export async function igMonthlyForReport(
  admin: Admin,
  clienteId: string,
  mes: string
): Promise<IgMonthly> {
  const { data: client } = await admin
    .from("clients")
    .select("ig_user_id")
    .eq("id", clienteId)
    .maybeSingle();
  const connected = !!(client as { ig_user_id?: string | null } | null)?.ig_user_id;

  const { data } = await admin
    .from("ig_snapshots")
    .select("fecha, followers, detalle")
    .eq("cliente_id", clienteId)
    .gte("fecha", `${mes}-01`)
    .lte("fecha", `${mes}-31`)
    .order("fecha", { ascending: true });

  const rows = (data ?? []) as SnapRow[];
  if (rows.length === 0) return { ...EMPTY, connected };

  const first = rows[0];
  const last = rows[rows.length - 1];
  const month = last.detalle?.month ?? null;

  return {
    connected,
    hasData: true,
    followersEnd: last.followers,
    seguidoresNuevos: rows.length >= 2 ? last.followers - first.followers : null,
    reach: month?.reach ?? null,
    profileViews: month?.profile_views ?? null,
    interactions: month?.interactions ?? null,
  };
}
