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
import { SecondaryPositionsEditor } from "@/components/secondary-positions-editor";

export const dynamic = "force-dynamic";

export default async function EquipoPersonasPage() {
  const me = await requireUser();
  const supabase = createClient();
  const isAdmin = me.rol === "admin";

  const [{ data: users }, { data: positions }, { data: comps }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, nombre, email, area, rol, position_id, secondary_position_ids, avatar_url, activo"
      )
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("positions")
      .select(
        "id, nombre, area, pago_default_monto, pago_default_moneda, pago_default_frecuencia"
      )
      .order("nombre"),
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
                <div
                  key={u.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/equipo/persona/${u.id}`}
                    className="-mx-2 -my-1 flex flex-1 items-center gap-3 rounded-md px-2 py-1 hover:bg-muted/30"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {u.nombre.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{u.nombre}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>{pos ? pos.nombre : "Sin puesto"}</span>
                        <span>· {u.area}</span>
                        {u.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {u.email}
                          </span>
                        )}
                      </div>
                      {(u.secondary_position_ids?.length ?? 0) > 0 && (
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                          <span>también:</span>
                          {(u.secondary_position_ids ?? []).map((sid) => {
                            const sp = posMap.get(sid);
                            if (!sp) return null;
                            return (
                              <span
                                key={sid}
                                className="rounded-full bg-muted px-1.5 py-0.5"
                              >
                                {sp.nombre}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
                    {isAdmin && (
                      <>
                        <div className="order-3 w-full text-xs sm:order-none sm:w-auto sm:text-right">
                          {eff.monto == null ? (
                            <span className="text-muted-foreground">— sin pago</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:block">
                              <span className="font-medium tabular-nums">
                                {eff.moneda}{" "}
                                {Number(eff.monto).toLocaleString("es-AR")}
                              </span>
                              <span className="text-muted-foreground">
                                {PAY_FREQUENCY_LABEL[eff.frecuencia ?? "mensual"] ??
                                  eff.frecuencia}
                              </span>
                              {ov && (
                                <span className="rounded bg-amber-100 px-1 text-[9px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  override
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col items-stretch gap-1 sm:flex-initial sm:items-end">
                          <div className="w-full sm:w-44">
                            <AssignPositionSelect
                              userId={u.id}
                              current={u.position_id}
                              positions={(positions ?? []) as Position[]}
                            />
                          </div>
                          <SecondaryPositionsEditor
                            userId={u.id}
                            userName={u.nombre}
                            primaryId={u.position_id}
                            current={u.secondary_position_ids ?? []}
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
