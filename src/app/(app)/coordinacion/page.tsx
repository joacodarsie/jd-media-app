import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_AGENCY_SETTINGS,
  type AgencySettings,
} from "@/lib/coordinacion";
import { CoordinacionPanel } from "@/components/coordinacion-panel";

export const dynamic = "force-dynamic";

export default async function CoordinacionPage() {
  await requireRole(["admin"]);
  const admin = createAdmin();

  const { data } = await admin
    .from("agency_settings")
    .select("packs, rates")
    .eq("id", 1)
    .maybeSingle();

  const settings: AgencySettings = data
    ? { packs: data.packs, rates: data.rates }
    : DEFAULT_AGENCY_SETTINGS;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Coordinación</h1>
        <p className="text-muted-foreground">
          Parámetros clave de la agencia: packs, tarifas por rol y el margen de
          cada pack. Solo vos podés verlos y modificarlos.
        </p>
      </div>
      <CoordinacionPanel initial={settings} />
    </div>
  );
}
