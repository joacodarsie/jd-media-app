import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireUser, userHas } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { LeadFormDialog } from "@/components/lead-form-dialog";
import { LeadsPipeline, type LeadRow } from "@/components/leads-pipeline";

export const dynamic = "force-dynamic";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

export default async function LeadsPipelinePage() {
  const me = await requireUser();
  const rolOk =
    COMERCIAL_ROLES.includes(me.rol) ||
    (!!me.rol_secundario && COMERCIAL_ROLES.includes(me.rol_secundario));
  if (!rolOk && !userHas(me, "comercial")) redirect("/dashboard");

  const supabase = createClient();

  const [{ data: leads }, { data: services }, { data: users }] =
    await Promise.all([
      supabase
        .from("leads")
        .select(
          "*, servicio:services(slug,name), asignado:users!leads_asignado_a_id_fkey(id,nombre)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("slug, name")
        .eq("active", true)
        .order("orden"),
      supabase
        .from("users")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
    ]);

  const serviceRows = (services ?? []) as { slug: string; name: string }[];
  const userRows = (users ?? []) as { id: string; nombre: string }[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/comercial"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Comercial
          </Link>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Consultas antes de la propuesta. Las del formulario de
            jdmedia.com.ar entran solas; las de Instagram o WhatsApp las cargás
            a mano.
          </p>
        </div>
        <LeadFormDialog
          mode="create"
          services={serviceRows}
          users={userRows}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo lead
            </Button>
          }
        />
      </div>

      <LeadsPipeline
        leads={(leads ?? []) as LeadRow[]}
        services={serviceRows}
        users={userRows}
      />
    </div>
  );
}
