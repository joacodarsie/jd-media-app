import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAY_FREQUENCY_LABEL } from "@/lib/constants";
import type { AppUser, Compensation, Position } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssignPositionSelect } from "@/components/assign-position-select";
import { CompensationFormDialog } from "@/components/compensation-form-dialog";

export const dynamic = "force-dynamic";

export default async function EquipoPersonasPage() {
  const me = await requireUser();
  const supabase = createClient();
  const isAdmin = me.rol === "admin";

  const [{ data: users }, { data: positions }, { data: comps }] = await Promise.all([
    supabase
      .from("users")
      .select("id, nombre, email, area, rol, position_id, avatar_url, activo")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("positions").select("*").order("nombre"),
    isAdmin
      ? supabase.from("compensation").select("*")
      : Promise.resolve({ data: [] as Compensation[] }),
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
              const pos = u.position_id ? posMap.get(u.position_id) : null;
              const ov = compMap.get(u.id);
              const eff = ov ?? {
                monto: pos?.pago_default_monto ?? null,
                moneda: pos?.pago_default_moneda ?? "ARS",
                frecuencia: pos?.pago_default_frecuencia ?? null,
              };
              return (
                <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {u.nombre.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{u.nombre}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {pos ? (
                          <Link
                            href={`/equipo/${pos.id}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {pos.nombre}
                          </Link>
                        ) : (
                          <span>Sin puesto</span>
                        )}
                        <span>· {u.area}</span>
                        {u.email && (
                          <a
                            href={`mailto:${u.email}`}
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            <Mail className="h-3 w-3" /> {u.email}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <>
                        <div className="hidden text-right text-xs sm:block">
                          {eff.monto == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              <div className="font-medium tabular-nums">
                                {eff.moneda}{" "}
                                {Number(eff.monto).toLocaleString("es-AR")}
                              </div>
                              <div className="text-muted-foreground">
                                {PAY_FREQUENCY_LABEL[eff.frecuencia ?? "mensual"] ??
                                  eff.frecuencia}
                                {ov && (
                                  <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    override
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="w-44">
                          <AssignPositionSelect
                            userId={u.id}
                            current={u.position_id}
                            positions={(positions ?? []) as Position[]}
                          />
                        </div>
                        <CompensationFormDialog
                          userId={u.id}
                          userName={u.nombre}
                          current={ov ?? null}
                          trigger={
                            <Button variant="ghost" size="icon" title="Editar pago">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </>
                    )}
                    {!isAdmin && pos && (
                      <Link
                        href={`/equipo/${pos.id}`}
                        className="text-muted-foreground hover:text-foreground"
                        title="Ver puesto"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
