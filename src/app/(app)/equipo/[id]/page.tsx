import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PAY_FREQUENCY_LABEL } from "@/lib/constants";
import type { AppUser, Position } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { PositionFormDialog } from "@/components/position-form-dialog";
import { AssignPositionSelect } from "@/components/assign-position-select";

export const dynamic = "force-dynamic";

export default async function PositionDetail({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  const [
    { data: position },
    { data: integrantes },
    { data: allPositions },
    { data: servicesData },
  ] = await Promise.all([
    supabase.from("positions").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("users")
      .select("id, nombre, avatar_url, position_id, area")
      .eq("position_id", params.id)
      .eq("activo", true)
      .order("nombre"),
    supabase.from("positions").select("id, nombre").order("nombre"),
    supabase
      .from("services")
      .select("slug, name")
      .eq("active", true)
      .order("orden"),
  ]);
  const serviceOptions = (servicesData ?? []) as { slug: string; name: string }[];

  if (!position) notFound();
  const p = position as Position;
  const isAdmin = me.rol === "admin";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/equipo"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver al equipo
        </Link>
        {isAdmin && (
          <PositionFormDialog
            mode="edit"
            position={p}
            services={serviceOptions}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Button>
            }
          />
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h1 className="text-2xl font-bold">{p.nombre}</h1>
        <p className="text-sm text-muted-foreground">{p.area}</p>
        {p.descripcion && (
          <div className="mt-3">
            <Markdown>{p.descripcion}</Markdown>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {p.alcance_incluye && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-emerald-700 dark:text-emerald-300">
                Qué entra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{p.alcance_incluye}</Markdown>
            </CardContent>
          </Card>
        )}
        {p.alcance_excluye && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-red-700 dark:text-red-300">
                Qué no entra
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{p.alcance_excluye}</Markdown>
            </CardContent>
          </Card>
        )}
      </div>

      {p.herramientas && p.herramientas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Herramientas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {p.herramientas.map((t, i) => (
                <a
                  key={i}
                  href={t.url || "#"}
                  target={t.url ? "_blank" : undefined}
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 text-sm hover:bg-muted"
                >
                  {t.nombre}
                  {t.url && <ExternalLink className="h-3 w-3" />}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {p.kpis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KPIs / objetivos</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown>{p.kpis}</Markdown>
          </CardContent>
        </Card>
      )}

      {p.procesos && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procesos / SOPs</CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown>{p.procesos}</Markdown>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Integrantes ({integrantes?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!integrantes?.length ? (
            <p className="text-sm text-muted-foreground">Nadie asignado a este puesto.</p>
          ) : (
            <ul className="divide-y">
              {(integrantes as AppUser[]).map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {u.nombre.charAt(0)}
                    </div>
                    <span className="text-sm">{u.nombre}</span>
                  </div>
                  {isAdmin && (
                    <div className="w-44">
                      <AssignPositionSelect
                        userId={u.id}
                        current={u.position_id}
                        positions={allPositions ?? []}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {p.pago_default_monto != null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pago por defecto del puesto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="font-semibold">
              {p.pago_default_moneda} {Number(p.pago_default_monto).toLocaleString("es-AR")}
              {p.pago_default_frecuencia && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · {PAY_FREQUENCY_LABEL[p.pago_default_frecuencia]}
                </span>
              )}
            </div>
            {p.pago_default_forma && (
              <div className="text-muted-foreground">{p.pago_default_forma}</div>
            )}
            {p.pago_default_notas && (
              <div className="text-xs text-muted-foreground">{p.pago_default_notas}</div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Cada persona puede tener un override individual desde su perfil.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
