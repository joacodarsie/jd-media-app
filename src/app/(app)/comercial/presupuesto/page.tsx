import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { requireUser, userHas, userInRoles } from "@/lib/auth";
import { PresupuestoIa } from "@/components/presupuesto-ia";
import { MARGEN_MINIMO } from "@/lib/comercial/presupuesto-ia";

export const dynamic = "force-dynamic";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

/**
 * Presupuesto con IA (30/10/2026): el vendedor carga la reunión y el
 * Instagram o la web del cliente, y sale la propuesta lista para mandar, con
 * la misma estética que las que arma el dueño. El pack lo elige la IA; si es a
 * medida, el precio lo pone el servidor para no bajar del margen mínimo.
 */
export default async function PresupuestoIaPage() {
  const me = await requireUser();
  if (!userInRoles(me, COMERCIAL_ROLES) && !userHas(me, "comercial")) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          Presupuesto con IA
        </h1>
        <p className="text-muted-foreground">
          Cargá lo que tengas del cliente —la transcripción de la reunión, su Instagram, su web, lo que te
          contó— y sale la propuesta lista para mandar. Elige el pack que le calza o arma uno a medida si
          el presupuesto no le da; un pack a medida nunca baja del {MARGEN_MINIMO}% de margen.
        </p>
      </div>
      <PresupuestoIa />
    </div>
  );
}
