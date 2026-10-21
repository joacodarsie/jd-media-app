import { CaraPersona } from "@/components/cara-persona";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function EquipoPersonasPage() {
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();

  const { data: users } = await supabase
    .from("users")
    .select("id, nombre, email, area, area_secundaria, rol, avatar_url, activo")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/equipo"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Puestos
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Personas</h1>
        <p className="text-muted-foreground">
          Todo el equipo de JD Media. Hacé click en cada uno para ver su puesto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{(users ?? []).length} activos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {((users ?? []) as AppUser[]).map((u) => {
              return (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/equipo/persona/${u.id}`}
                    className="-mx-2 -my-1 flex flex-1 items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/30"
                  >
                    <CaraPersona nombre={u.nombre} url={u.avatar_url} className="h-9 w-9 text-xs" />
                    <div className="min-w-0">
                      <div className="font-medium">{u.nombre}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {/* Lo que hace cada uno = su área (la del organigrama).
                            El «puesto» asignado por persona se sacó (21/10/2026):
                            repetía el área y estaba a medio cargar. */}
                        <span>
                          {[u.area, (u as { area_secundaria?: string | null }).area_secundaria].filter(Boolean).join(" · ")}
                        </span>
                        {u.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {u.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
