import { MessageSquareWarning } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getActiveClients } from "@/lib/cache";
import { ComplaintsBoard, type ComplaintRow } from "@/components/complaints-board";

export const dynamic = "force-dynamic";

/**
 * Quejas de los clientes: el registro de los problemas de cada cuenta, por
 * área. Solo Dirección y Comercial (ver la política de la 0179).
 */
export default async function QuejasPage() {
  await requireRole(["admin", "comercial"]);

  const admin = createAdmin();
  const [{ data }, clients] = await Promise.all([
    admin
      .from("client_complaints")
      .select(
        "id, cliente_id, area, gravedad, estado, detalle, resolucion, fecha, creado_por_id, cliente:clients(id,nombre), autor:users!client_complaints_creado_por_id_fkey(id,nombre)"
      )
      .order("fecha", { ascending: false })
      .limit(500),
    getActiveClients(),
  ]);

  const rows = (data ?? []) as unknown as ComplaintRow[];

  return (
    <div className="space-y-5 pb-16">
      <div className="flex items-start gap-3">
        <MessageSquareWarning className="mt-0.5 h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Quejas de clientes</h1>
          <p className="text-sm text-muted-foreground">
            Todo lo que un cliente reclamó, con su área y cómo terminó. Es la foto de la calidad
            de la gestión de cada cuenta.
          </p>
        </div>
      </div>

      <ComplaintsBoard
        rows={rows}
        clients={clients.map((c) => ({ id: c.id, nombre: c.nombre }))}
      />
    </div>
  );
}
