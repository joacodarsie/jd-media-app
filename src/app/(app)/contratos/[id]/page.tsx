import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContractEditor } from "@/components/contract-editor";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();

  const [{ data: contractRaw }, { data: users }, { data: positions }] =
    await Promise.all([
      supabase
        .from("freelance_contracts")
        .select(
          "*, persona:users!freelance_contracts_user_id_fkey(id,nombre,dni_cuit,telefono), puesto:positions(id,nombre)"
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("users").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("positions").select("id, nombre").order("nombre"),
    ]);

  if (!contractRaw) notFound();

  // Para tipo 'por_cliente': contamos clientes donde la persona figura como
  // CM, disenador o audiovisual, para mostrar el calculo del monto total.
  const userId = (contractRaw as { user_id: string }).user_id;
  const { data: assignedClientsRaw } = await supabase
    .from("clients")
    .select("id, nombre, cm_id, disenador_id, audiovisual_id")
    .or(
      `cm_id.eq.${userId},disenador_id.eq.${userId},audiovisual_id.eq.${userId}`
    );
  const assignedClients = (assignedClientsRaw ?? []).map((c) => ({
    id: c.id as string,
    nombre: c.nombre as string,
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/contratos"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver a contratos
      </Link>
      <ContractEditor
        contract={contractRaw}
        users={users ?? []}
        positions={positions ?? []}
        assignedClients={assignedClients}
      />
    </div>
  );
}
