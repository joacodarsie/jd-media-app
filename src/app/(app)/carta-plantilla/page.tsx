import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { EDITABLE_CLAUSES } from "@/lib/contract-clauses";
import { fetchClauseOverrides } from "@/lib/contract-clauses-server";
import { ContractClausesEditor } from "@/components/contract-clauses-editor";

export const dynamic = "force-dynamic";

export default async function CartaPlantillaPage() {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const overrides = (await fetchClauseOverrides(admin)) ?? {};

  return (
    <div className="space-y-5">
      <Link
        href="/documentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6 text-primary" /> Plantilla de la carta acuerdo
        </h1>
        <p className="text-muted-foreground">
          Editá el texto de las cláusulas fijas de la carta acuerdo. Los cambios
          se aplican a <b>todas</b> las cartas (individuales y unificadas). Las
          partes que dependen del cliente —servicios, montos, honorarios, plazos,
          puesta en marcha— se calculan solas y no se editan acá. Solo vos (admin)
          ves y editás esto.
        </p>
      </div>

      <ContractClausesEditor clauses={EDITABLE_CLAUSES} initial={overrides} />
    </div>
  );
}
