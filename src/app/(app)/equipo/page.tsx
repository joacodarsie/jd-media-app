import Link from "next/link";
import { ArrowRight, Plus, Users as UsersIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Position } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PositionFormDialog } from "@/components/position-form-dialog";

export const dynamic = "force-dynamic";

/**
 * Agrupación de los puestos por servicio que ofrece JD Media
 * (no por área interna). Más cercano a cómo se vende y se entiende afuera.
 */
const SERVICE_GROUPS: { id: string; title: string; subtitle: string; areas: string[] }[] = [
  {
    id: "direccion",
    title: "Dirección y Operaciones",
    subtitle: "Cabeza del barco — estrategia, coordinación y soporte transversal",
    areas: ["Estrategia/Dirección", "Coordinación"],
  },
  {
    id: "gestion_redes",
    title: "Gestión de redes",
    subtitle: "El servicio principal: contenido + comunidad por cliente",
    areas: ["Creativas", "Community Manager", "Diseño", "Edición Audiovisual"],
  },
  {
    id: "paid_media",
    title: "Paid Media",
    subtitle: "Ads en Meta y Google que llevan tráfico y ventas",
    areas: ["Paid Media"],
  },
  {
    id: "comercial",
    title: "Comercial",
    subtitle: "Prospección de leads, cierre de ventas y atención de cuenta",
    areas: ["Comercial", "Prospecting"],
  },
  {
    id: "productos",
    title: "Productos digitales",
    subtitle: "Sitios web y bots — clientes con necesidades técnicas",
    areas: ["Desarrollo Web", "Botly"],
  },
];

export default async function EquipoPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [{ data: positions }, { data: users }] = await Promise.all([
    supabase.from("positions").select("*").order("area").order("nombre"),
    supabase
      .from("users")
      .select("id, nombre, avatar_url, position_id, area")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const integrantes = new Map<string, AppUser[]>();
  for (const u of (users ?? []) as AppUser[]) {
    if (!u.position_id) continue;
    if (!integrantes.has(u.position_id)) integrantes.set(u.position_id, []);
    integrantes.get(u.position_id)!.push(u);
  }

  const positionsByArea = new Map<string, Position[]>();
  for (const p of (positions ?? []) as Position[]) {
    if (!positionsByArea.has(p.area)) positionsByArea.set(p.area, []);
    positionsByArea.get(p.area)!.push(p);
  }

  const isAdmin = me.rol === "admin";

  // Áreas que no caen en ningún grupo (por si hay áreas custom)
  const claimedAreas = new Set(SERVICE_GROUPS.flatMap((g) => g.areas));
  const otrasAreas = Array.from(positionsByArea.keys()).filter(
    (a) => !claimedAreas.has(a)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Equipo</h1>
          <p className="text-muted-foreground">
            Puestos organizados por el servicio que ofrece la agencia.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/equipo/personas"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <UsersIcon className="mr-2 h-4 w-4" /> Ver personas
          </Link>
          {isAdmin && (
            <PositionFormDialog
              mode="create"
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo puesto
                </Button>
              }
            />
          )}
        </div>
      </div>

      {SERVICE_GROUPS.map((group) => {
        const positionsInGroup = group.areas.flatMap(
          (a) => positionsByArea.get(a) ?? []
        );
        if (positionsInGroup.length === 0) return null;
        return (
          <section key={group.id} className="space-y-3">
            <div className="border-l-4 border-primary/60 pl-3">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <p className="text-xs text-muted-foreground">{group.subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {positionsInGroup.map((p) => (
                <PositionCard
                  key={p.id}
                  position={p}
                  integrantes={integrantes.get(p.id) ?? []}
                />
              ))}
            </div>
          </section>
        );
      })}

      {otrasAreas.length > 0 && (
        <section className="space-y-3">
          <div className="border-l-4 border-muted pl-3">
            <h2 className="text-lg font-semibold">Otros puestos</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otrasAreas
              .flatMap((a) => positionsByArea.get(a) ?? [])
              .map((p) => (
                <PositionCard
                  key={p.id}
                  position={p}
                  integrantes={integrantes.get(p.id) ?? []}
                />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PositionCard({
  position,
  integrantes,
}: {
  position: Position;
  integrantes: AppUser[];
}) {
  return (
    <Link
      href={`/equipo/${position.id}`}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">{position.nombre}</h3>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {position.descripcion && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {position.descripcion}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between border-t pt-2">
        <div className="flex -space-x-2">
          {integrantes.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">Sin asignar</span>
          ) : (
            integrantes.slice(0, 4).map((u) => (
              <div
                key={u.id}
                title={u.nombre}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold"
              >
                {u.nombre.charAt(0)}
              </div>
            ))
          )}
          {integrantes.length > 4 && (
            <div className="flex h-6 items-center px-1 text-[10px] text-muted-foreground">
              +{integrantes.length - 4}
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {integrantes.length} {integrantes.length === 1 ? "persona" : "personas"}
        </span>
      </div>
    </Link>
  );
}
