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
          "*, persona:users!freelance_contracts_user_id_fkey(id,nombre), puesto:positions(id,nombre)"
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("users").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("positions").select("id, nombre").order("nombre"),
    ]);

  if (!contractRaw) notFound();

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
      />
    </div>
  );
}
