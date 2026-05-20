import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PublicationWithRels } from "@/lib/types";
import { PublicationsMonth } from "@/components/publications-month";

export const dynamic = "force-dynamic";

export default async function ContenidosPage() {
  await requireUser();
  const supabase = createClient();

  const [{ data: pubs }, { data: users }, { data: clients }] = await Promise.all([
    supabase
      .from("publications")
      .select(
        "*, cliente:clients(id,nombre), creador:users!publications_creado_por_id_fkey(id,nombre,avatar_url), audiovisual:users!publications_audiovisual_id_fkey(id,nombre,avatar_url)"
      )
      .order("fecha_publicacion", { ascending: true, nullsFirst: false }),
    supabase.from("users").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("clients").select("id, nombre").order("nombre"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Calendario de contenidos</h1>
        <p className="text-muted-foreground">
          Todo el contenido planificado de la agencia, en un mes.
        </p>
      </div>
      <PublicationsMonth
        publications={(pubs ?? []) as PublicationWithRels[]}
        clients={clients ?? []}
        users={users ?? []}
      />
    </div>
  );
}
