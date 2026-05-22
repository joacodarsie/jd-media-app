import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DocumentsManager,
  type DocumentRow,
} from "@/components/documents-manager";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const me = await requireUser();
  const supabase = createClient();
  const { data } = await supabase
    .from("documents")
    .select(
      "id, titulo, descripcion, categoria, file_name, file_size, mime_type, created_at, subido_por:users!documents_subido_por_id_fkey(id,nombre)"
    )
    .is("cliente_id", null)
    .order("created_at", { ascending: false });

  const docs = (data ?? []) as unknown as DocumentRow[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="text-muted-foreground">
          Archivos importantes de la agencia. Visibles para todo el equipo. Solo
          admin/coordinación pueden subir o borrar.
        </p>
      </div>
      <DocumentsManager initial={docs} canEdit={isStaff(me.rol)} />
    </div>
  );
}
