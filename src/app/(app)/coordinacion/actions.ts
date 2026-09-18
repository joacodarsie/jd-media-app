"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import type { AgencySettings, PrecioReferencia } from "@/lib/coordinacion";

export async function saveAgencySettings(
  // La lista de precios de referencia se guarda aparte (`savePreciosReferencia`):
  // el panel de Coordinación no la toca y mandarla vacía la borraría.
  settings: Omit<AgencySettings, "preciosReferencia"> & { preciosReferencia?: PrecioReferencia[] }
) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin
    .from("agency_settings")
    .upsert(
      {
        id: 1,
        packs: settings.packs,
        rates: settings.rates,
        ...(settings.preciosReferencia ? { precios_referencia: settings.preciosReferencia } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) return { error: error.message };
  revalidatePath("/coordinacion");
  revalidatePath("/coordinacion/cotizador");
  return { ok: true };
}

/**
 * Guarda solo la lista de precios de referencia. Existe aparte de
 * `saveAgencySettings` para que editar un precio desde el Cotizador no tenga
 * que mandar de vuelta packs y tarifas enteras (y pisarlas sin querer).
 */
export async function savePreciosReferencia(precios: PrecioReferencia[]) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin
    .from("agency_settings")
    .upsert(
      { id: 1, precios_referencia: precios, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) return { error: error.message };
  revalidatePath("/coordinacion/cotizador");
  revalidatePath("/coordinacion");
  return { ok: true };
}
