import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PublicationWithRels } from "@/lib/types";
import { PublicationsMonth } from "@/components/publications-month";

export const dynamic = "force-dynamic";

export default async function ClientCalendarPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const supabase = createClient();

  const [{ data: client }, { data: pubs }, { data: users }, { data: clients }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, nombre")
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("publications")
        .select(
          "*, cliente:clients(id,nombre), creador:users!publications_creado_por_id_fkey(id,nombre,avatar_url), audiovisual:users!publications_audiovisual_id_fkey(id,nombre,avatar_url)"
        )
        .eq("cliente_id", params.id)
        .order("fecha_publicacion", { ascending: true, nullsFirst: false }),
      supabase
        .from("users")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase.from("clients").select("id, nombre, estado, cm_id, disenador_id, audiovisual_id").order("nombre"),
    ]);

  if (!client) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/clientes/${params.id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver al cliente
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Calendario · {client.nombre}</h1>
        <p className="text-muted-foreground">
          Planificá publicaciones, asigná editor, y movélas por el flujo de aprobación.
        </p>
      </div>

      <PublicationsMonth
        publications={(pubs ?? []) as PublicationWithRels[]}
        clients={clients ?? []}
        users={users ?? []}
        defaultClientId={params.id}
      />
    </div>
  );
}
