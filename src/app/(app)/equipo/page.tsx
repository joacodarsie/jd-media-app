import Link from "next/link";
import { ArrowRight, Plus, Users as UsersIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Position } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PositionFormDialog } from "@/components/position-form-dialog";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [{ data: positions }, { data: users }] = await Promise.all([
    supabase.from("positions").select("*").order("area").order("nombre"),
    supabase.from("users").select("id, nombre, avatar_url, position_id, area").eq("activo", true).order("nombre"),
  ]);

  const usersByPosition = new Map<string, AppUser[]>();
  for (const u of (users ?? []) as AppUser[]) {
    if (!u.position_id) continue;
    if (!usersByPosition.has(u.position_id)) usersByPosition.set(u.position_id, []);
    usersByPosition.get(u.position_id)!.push(u);
  }

  const positionsByArea = new Map<string, Position[]>();
  for (const p of (positions ?? []) as Position[]) {
    if (!positionsByArea.has(p.area)) positionsByArea.set(p.area, []);
    positionsByArea.get(p.area)!.push(p);
  }

  const isAdmin = me.rol === "admin";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-muted-foreground">
            Puestos, alcance, procesos y personas de la agencia.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href="/equipo/personas"
              className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <UsersIcon className="mr-2 h-4 w-4" /> Personas
            </Link>
            <PositionFormDialog
              mode="create"
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo puesto
                </Button>
              }
            />
          </div>
        )}
      </div>

      <div className="space-y-6">
        {Array.from(positionsByArea.entries()).map(([area, pos]) => (
          <section key={area}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {area}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pos.map((p) => {
                const integrantes = usersByPosition.get(p.id) ?? [];
                return (
                  <Link
                    key={p.id}
                    href={`/equipo/${p.id}`}
                    className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{p.nombre}</h3>
                        {p.descripcion && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {p.descripcion}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <UsersIcon className="h-3 w-3" />
                      {integrantes.length} integrante{integrantes.length === 1 ? "" : "s"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
