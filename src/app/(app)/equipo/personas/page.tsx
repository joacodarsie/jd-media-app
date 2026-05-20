import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAY_FREQUENCY_LABEL } from "@/lib/constants";
import type { AppUser, Compensation, Position } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignPositionSelect } from "@/components/assign-position-select";
import { CompensationFormDialog } from "@/components/compensation-form-dialog";

export const dynamic = "force-dynamic";

export default async function EquipoPersonasPage() {
  await requireRole(["admin"]);
  const supabase = createClient();

  const [{ data: users }, { data: positions }, { data: comps }] = await Promise.all([
    supabase
      .from("users")
      .select("id, nombre, email, area, rol, position_id, avatar_url, activo")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("positions").select("*").order("nombre"),
    supabase.from("compensation").select("*"),
  ]);

  const posMap = new Map<string, Position>(
    ((positions ?? []) as Position[]).map((p) => [p.id, p])
  );
  const compMap = new Map<string, Compensation>(
    ((comps ?? []) as Compensation[]).map((c) => [c.user_id, c])
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/equipo"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Equipo
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Personas</h1>
        <p className="text-muted-foreground">
          Asignar puesto y cargar override de compensación.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{(users ?? []).length} activas</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Persona</th>
                <th>Puesto</th>
                <th>Compensación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {((users ?? []) as AppUser[]).map((u) => {
                const pos = u.position_id ? posMap.get(u.position_id) : null;
                const ov = compMap.get(u.id) ?? null;
                const eff = ov ?? {
                  monto: pos?.pago_default_monto ?? null,
                  moneda: pos?.pago_default_moneda ?? "ARS",
                  frecuencia: pos?.pago_default_frecuencia ?? null,
                };
                return (
                  <tr key={u.id} className="border-t">
                    <td className="py-2 align-middle">
                      <div className="font-medium">{u.nombre}</div>
                      <div className="text-xs text-muted-foreground">{u.area}</div>
                    </td>
                    <td className="w-48 align-middle">
                      <AssignPositionSelect
                        userId={u.id}
                        current={u.position_id}
                        positions={(positions ?? []) as Position[]}
                      />
                    </td>
                    <td className="align-middle">
                      {eff.monto == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>
                          {eff.moneda} {Number(eff.monto).toLocaleString("es-AR")}
                          {eff.frecuencia && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              · {PAY_FREQUENCY_LABEL[eff.frecuencia]}
                            </span>
                          )}
                          {ov && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              override
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="text-right align-middle">
                      <CompensationFormDialog
                        userId={u.id}
                        userName={u.nombre}
                        current={ov}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Pencil className="mr-1 h-3 w-3" /> Pago
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
