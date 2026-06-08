"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import type { AgencySettings } from "@/lib/coordinacion";

export async function saveAgencySettings(settings: AgencySettings) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin
    .from("agency_settings")
    .upsert(
      {
        id: 1,
        packs: settings.packs,
        rates: settings.rates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) return { error: error.message };
  revalidatePath("/coordinacion");
  return { ok: true };
}
