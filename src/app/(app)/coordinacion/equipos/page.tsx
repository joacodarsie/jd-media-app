import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getActiveUsers } from "@/lib/cache";
import {
  EquiposManager,
  type TeamClientRow,
  type TeamRow,
} from "@/components/equipos-manager";

export const dynamic = "force-dynamic";

/**
 * Equipos de trabajo: cada equipo tiene su CM, diseñador, editor y paid media,
 * y una cartera de clientes. Luz (coordinación de redes) está en todos.
 */
export default async function EquiposPage() {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();

  const [{ data: teamsRaw, error }, { data: clientsRaw }, users] = await Promise.all([
    admin.from("teams").select("*").order("orden"),
    admin
      .from("clients")
      .select("id, nombre, team_id")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .order("nombre"),
    getActiveUsers(),
  ]);

  if (error && (error.code === "42P01" || error.code === "42703")) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
        Falta aplicar la migración <b>0126</b> en Supabase para usar los equipos.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/coordinacion"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Coordinación
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Equipos de trabajo</h1>
        <p className="text-muted-foreground">
          Cada equipo tiene su CM, diseñador, editor y paid media, y su cartera
          de clientes. La coordinación de redes acompaña a todos los equipos.
        </p>
      </div>
      <EquiposManager
        teams={(teamsRaw ?? []) as TeamRow[]}
        clients={(clientsRaw ?? []) as TeamClientRow[]}
        users={users.map((u) => ({ id: u.id, nombre: u.nombre }))}
      />
    </div>
  );
}
