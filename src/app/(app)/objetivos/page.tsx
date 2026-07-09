import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { AREAS } from "@/lib/constants";
import { Target } from "lucide-react";
import { ObjectivesBoard, type ObjectiveRow } from "@/components/objectives-board";

export const dynamic = "force-dynamic";

// Áreas que mostramos como grupos (en orden). "Prospecting" queda fuera: se
// cubre con Comercial.
const AREA_ORDER = AREAS.filter((a) => a !== "Prospecting");

export default async function ObjetivosPage() {
  const me = await requireUser();
  const canEdit = userInRoles(me, ["admin", "coordinador"]);

  const admin = createAdmin();
  // Resiliente: si todavía no se aplicó la migración 0122, no rompemos la página.
  let rows: ObjectiveRow[] = [];
  let tablaLista = true;
  try {
    const { data, error } = await admin
      .from("agency_objectives")
      .select("id, area, titulo, detalle, ideas, estado, orden")
      .order("orden", { ascending: true });
    if (error) tablaLista = false;
    else rows = (data ?? []) as ObjectiveRow[];
  } catch {
    tablaLista = false;
  }

  const byArea = new Map<string, ObjectiveRow[]>();
  const general: ObjectiveRow[] = [];
  for (const r of rows) {
    if (r.area === null) general.push(r);
    else {
      if (!byArea.has(r.area)) byArea.set(r.area, []);
      byArea.get(r.area)!.push(r);
    }
  }

  const groups = [
    { area: null as string | null, label: "Objetivo general de la agencia", objetivos: general },
    ...AREA_ORDER.map((area) => ({
      area: area as string | null,
      label: area,
      objetivos: byArea.get(area) ?? [],
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Target className="h-6 w-6 text-primary" /> Objetivos
        </h1>
        <p className="text-muted-foreground">
          El norte de la agencia y de cada área. Cada objetivo lleva adentro las
          ideas/iniciativas para llegar. {canEdit ? "Editá los que quieras." : "Solo lectura."}
        </p>
      </div>

      {!tablaLista ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Falta aplicar la migración <code>0122_agency_objectives.sql</code> en
          Supabase para activar esta sección. Una vez aplicada, recargá.
        </div>
      ) : (
        <ObjectivesBoard groups={groups} canEdit={canEdit} />
      )}
    </div>
  );
}
