import { imagenChica } from "@/lib/web/imagenes";
import Link from "next/link";
import { ArrowRight, Plus, Users as UsersIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Suspense } from "react";
import { CargaEquipo } from "@/components/carga-equipo";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Position } from "@/lib/types";
import { NOMBRE_ROL, rolDe } from "@/lib/equipo/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PositionFormDialog } from "@/components/position-form-dialog";

// Lista de puestos del equipo. Cambia poco — revalida cada 60s.
export const revalidate = 60;

/**
 * Agrupación de los puestos por servicio que ofrece JD Media
 * (no por área interna). Más cercano a cómo se vende y se entiende afuera.
 */
// Agrupado por lo que hace cada rol en la agencia (21/10/2026).
const SERVICE_GROUPS: { id: string; title: string; subtitle: string; areas: string[] }[] = [
  { id: "direccion", title: "Dirección", subtitle: "El rumbo, los números y las personas", areas: ["Estrategia/Dirección", "Coordinación General"] },
  {
    id: "coordinacion",
    title: "Coordinación",
    subtitle: "Tiempos, calidad y pauta: cada coordinador responde por una parte del resultado",
    areas: ["Coordinación", "Coordinación de Diseño", "Coordinación de Paid Media"],
  },
  { id: "produccion", title: "Producción de contenido", subtitle: "El servicio principal: calendario, piezas, videos y comunidad", areas: ["Community Manager", "Diseño", "Edición Audiovisual"] },
  { id: "crecimiento", title: "Crecimiento", subtitle: "Clientes nuevos y publicidad paga", areas: ["Comercial", "Paid Media", "Prospecting"] },
  { id: "productos", title: "Proyectos", subtitle: "Webs y bots, por proyecto", areas: ["Desarrollo Web", "Botly"] },
];

export default async function EquipoPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [{ data: positions }, { data: users }, { data: servicesData }] =
    await Promise.all([
      supabase
        .from("positions")
        .select("id, nombre, area, descripcion, services")
        .order("area")
        .order("nombre"),
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

  const integrantes = new Map<string, AppUser[]>();
  // Quién hace cada rol sale del área (y la secundaria), no de una asignación a mano.
  const porArea = new Map<string, string>();
  for (const p of (positions ?? []) as Position[]) if (!porArea.has(p.area)) porArea.set(p.area, p.id);
  for (const u of (users ?? []) as (AppUser & { area_secundaria?: string | null })[]) {
    for (const a of [u.area, u.area_secundaria]) {
      const pid = a ? porArea.get(a) : undefined;
      if (!pid) continue;
      if (!integrantes.has(pid)) integrantes.set(pid, []);
      integrantes.get(pid)!.push(u);
    }
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
              services={serviceOptions}
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nuevo puesto
                </Button>
              }
            />
          )}
        </div>
      </div>

      <FlujoDelTrabajo />

      {(isAdmin || me.rol === "coordinador") && (
        <Suspense fallback={null}>
          <CargaEquipo />
        </Suspense>
      )}

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
  const rol = rolDe(position.area);
  return (
    <Link
      href={`/equipo/${position.id}`}
      data-expande
      className="group flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/40"
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl", rol ? "bg-primary/10" : "bg-muted")} aria-hidden="true">
          {rol?.emoji ?? "•"}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-tight">{NOMBRE_ROL[position.area] ?? position.nombre}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{rol?.mision ?? position.descripcion}</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-auto flex items-center justify-between border-t pt-2">
        <div className="flex -space-x-2">
          {integrantes.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">Nadie con esta área</span>
          ) : (
            // Con foto cuando la tiene (18/10/2026); se abren un poco al pasar el mouse.
            integrantes.slice(0, 4).map((u) =>
              u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={u.id}
                  src={imagenChica(u.avatar_url, 96)}
                  alt={u.nombre}
                  title={u.nombre}
                  className="h-7 w-7 rounded-full border-2 border-card object-cover transition-transform group-hover:translate-x-0.5"
                />
              ) : (
                <div
                  key={u.id}
                  title={u.nombre}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/15 text-[11px] font-semibold text-foreground"
                >
                  {u.nombre.split(" ").map((x) => x.charAt(0)).slice(0, 2).join("")}
                </div>
              )
            )
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

/** Cómo pasa el trabajo de un rol a otro, de la venta a la publicación (21/10/2026). */
function FlujoDelTrabajo() {
  const pasos = [
    { emoji: "🤝", rol: "Comercial", que: "Cierra la cuenta" },
    { emoji: "🎯", rol: "Project Manager", que: "Reparte y pone fechas" },
    { emoji: "📱", rol: "Community Manager", que: "Arma el calendario" },
    { emoji: "🎨🎬", rol: "Diseño y Edición", que: "Producen las piezas" },
    { emoji: "✨", rol: "Dirección Creativa", que: "Aprueba todo" },
    { emoji: "✅", rol: "Cliente", que: "Aprueba en su portal" },
    { emoji: "📣", rol: "Community Manager", que: "Programa y publica" },
  ];
  return (
    <section className="rounded-2xl border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold">Cómo fluye el trabajo</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        De la venta a la publicación. La pauta (Paid Media) corre en paralelo desde la segunda quincena de cada cuenta.
      </p>
      <ol className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {pasos.map((p, i) => (
          <li
            key={i}
            className="flex shrink-0 items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
          >
            <div className="w-32 rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-lg leading-none" aria-hidden="true">{p.emoji}</p>
              <p className="mt-1 text-xs font-semibold leading-tight">{p.rol}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">{p.que}</p>
            </div>
            {i < pasos.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          </li>
        ))}
      </ol>
    </section>
  );
}
