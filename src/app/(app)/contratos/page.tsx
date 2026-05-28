import Link from "next/link";
import { FileText, Plus, User as UserIcon } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ContractNewDialog } from "@/components/contract-new-dialog";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
};

const ESTADO_COLOR: Record<string, string> = {
  borrador: "bg-muted text-muted-foreground",
  activo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  pausado: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  finalizado: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

const COMP_LABEL: Record<string, string> = {
  comision: "Comisión",
  fee_fijo: "Fee fijo",
  por_entrega: "Por entrega",
  por_cliente: "Por cliente asignado",
  mixto: "Mixto",
};

export default async function ContratosPage() {
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();

  const [{ data: contractsRaw }, { data: users }, { data: positions }] =
    await Promise.all([
      supabase
        .from("freelance_contracts")
        .select(
          "id, user_id, position_id, rol_descripcion, compensation_type, compensation_detail, monto_referencia, moneda, fecha_inicio, fecha_fin, estado, created_at, persona:users!freelance_contracts_user_id_fkey(id,nombre,avatar_url), puesto:positions(id,nombre)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase.from("positions").select("id, nombre").order("nombre"),
    ]);

  type ContractRow = {
    id: string;
    user_id: string;
    position_id: string | null;
    rol_descripcion: string | null;
    compensation_type: string;
    compensation_detail: string | null;
    monto_referencia: number | null;
    moneda: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    estado: string;
    created_at: string;
    persona: { id: string; nombre: string; avatar_url: string | null } | null;
    puesto: { id: string; nombre: string } | null;
  };
  const contracts = (contractsRaw ?? []) as unknown as ContractRow[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 text-primary" />
            Contratos del equipo
          </h1>
          <p className="text-muted-foreground">
            Contratos de prestación de servicios para freelancers y
            colaboradores. Cada uno con su esquema de compensación.
          </p>
        </div>
        <ContractNewDialog
          users={users ?? []}
          positions={positions ?? []}
          trigger={
            <Button>
              <Plus className="mr-1 h-4 w-4" /> Nuevo contrato
            </Button>
          }
        />
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">Sin contratos cargados</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Generá el primer contrato para alguien del equipo. La IA arma el
            cuerpo del contrato a partir del esquema de compensación.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {contracts.map((c) => (
            <Link
              key={c.id}
              href={`/contratos/${c.id}`}
              className="group rounded-lg border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">
                      {c.persona?.nombre ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.puesto?.nombre ?? c.rol_descripcion ?? "Sin rol"}
                    </div>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ESTADO_COLOR[c.estado]}`}
                >
                  {ESTADO_LABEL[c.estado]}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">
                    {COMP_LABEL[c.compensation_type]}
                  </span>
                  {c.compensation_detail && (
                    <span> · {c.compensation_detail.slice(0, 60)}
                      {c.compensation_detail.length > 60 ? "…" : ""}
                    </span>
                  )}
                </div>
                <div>
                  Desde {new Date(c.fecha_inicio).toLocaleDateString("es-AR")}
                  {c.fecha_fin
                    ? ` · Hasta ${new Date(c.fecha_fin).toLocaleDateString("es-AR")}`
                    : " · Indefinido"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
