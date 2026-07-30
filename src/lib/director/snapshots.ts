/**
 * Registro mensual del semáforo del Director.
 *
 * Por qué: `computeAccountHealth` mira el presente (tareas vencidas HOY, si el
 * cliente entró al portal, Instagram de los últimos 35 días). Cuando termina el
 * mes eso ya no se puede reconstruir, así que si no se guarda, se pierde.
 *
 * El cron diario guarda el mes en curso y lo pisa cada día. Cuando arranca el
 * mes siguiente, la última escritura queda como el cierre del mes anterior.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { computeAccountHealth, type AccountHealthResult } from "./health";

type Admin = ReturnType<typeof createAdmin>;

/** Calcula el estado de hoy y lo guarda como el registro del mes en curso. */
export async function guardarSnapshotDirector(
  admin: Admin
): Promise<{ ok: boolean; periodo?: string; error?: string }> {
  try {
    const data = await computeAccountHealth(admin);
    const { error } = await admin.from("director_snapshots").upsert(
      {
        periodo: data.periodo,
        data: data as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "periodo" }
    );
    if (error) {
      if ((error as { code?: string }).code === "42P01")
        return { ok: false, error: "Falta aplicar la migración 0146." };
      return { ok: false, error: error.message };
    }
    return { ok: true, periodo: data.periodo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

/** El registro guardado de un mes, o null si ese mes no se llegó a guardar. */
export async function leerSnapshotDirector(
  admin: Admin,
  periodo: string
): Promise<AccountHealthResult | null> {
  try {
    const { data } = await admin
      .from("director_snapshots")
      .select("data")
      .eq("periodo", periodo)
      .maybeSingle();
    return ((data as { data?: AccountHealthResult } | null)?.data ?? null) || null;
  } catch {
    return null;
  }
}

/** Meses que tienen registro, del más nuevo al más viejo. */
export async function periodosConSnapshot(admin: Admin): Promise<string[]> {
  try {
    const { data } = await admin
      .from("director_snapshots")
      .select("periodo")
      .order("periodo", { ascending: false });
    return ((data ?? []) as { periodo: string }[]).map((r) => r.periodo);
  } catch {
    return [];
  }
}
