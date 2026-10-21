import { CaraPersona } from "@/components/cara-persona";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Position } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { PositionFormDialog } from "@/components/position-form-dialog";
import { RolVista } from "@/components/rol-vista";
import { rolDe } from "@/lib/equipo/roles";
import { hoyYmd } from "@/lib/dates";

// Detalle de puesto. Cambia poco — revalida cada 60s.
export const revalidate = 60;

export default async function PositionDetail({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  const [
    { data: position },
    { data: activos },
    { data: servicesData },
  ] = await Promise.all([
    supabase
      .from("positions")
      .select(
        "id, nombre, area, descripcion, alcance_incluye, alcance_excluye, kpis, procesos, herramientas, services, pago_default_monto, pago_default_moneda, pago_default_frecuencia, pago_default_forma, pago_default_notas"
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, nombre, avatar_url, position_id, area, area_secundaria")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("services")
      .select("slug, name")
      .eq("active", true)
      .order("orden"),
  ]);
  const serviceOptions = (servicesData ?? []) as { slug: string; name: string }[];

  if (!position) notFound();
  const p = position as Position;
  // Quién ocupa el puesto sale del área (uno por área), no de una asignación a mano (21/10/2026).
  const integrantes = ((activos ?? []) as (AppUser & { area_secundaria?: string | null })[]).filter(
    (x) => x.area === p.area || x.area_secundaria === p.area
  );
  const isAdmin = me.rol === "admin";
  const rol = rolDe(p.area);
  const hoyDia = Number(hoyYmd().slice(8, 10));

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

      {rol ? (
        <RolVista rol={rol} puesto={p} gente={integrantes} hoy={hoyDia} />
      ) : (
        <div className="rounded-xl border bg-card p-5">
          <h1 className="text-2xl font-bold">{p.nombre}</h1>
          {p.descripcion && <p className="mt-2 text-sm text-muted-foreground">{p.descripcion}</p>}
          {p.procesos && (
            <div className="mt-3 text-sm">
              <Markdown>{p.procesos}</Markdown>
            </div>
          )}
        </div>
      )}

      <section className="rounded-2xl border bg-card p-4 md:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" /> Quién lo hace hoy ({integrantes.length})
        </h3>
        {!integrantes.length ? (
          <p className="mt-2 text-sm text-muted-foreground">Nadie tiene esta área cargada.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {integrantes.map((u) => {
              const fila = (
                <>
                  <CaraPersona nombre={u.nombre} url={u.avatar_url} className="h-9 w-9 text-xs" />
                  <span className="text-sm font-medium">{u.nombre}</span>
                </>
              );
              return (
                <li key={u.id}>
                  {isAdmin || u.id === me.id ? (
                    <Link href={`/equipo/persona/${u.id}`} className="flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors hover:bg-muted/50">
                      {fila}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border px-3 py-2">{fila}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
