import { redirect } from "next/navigation";
import { requireUser, isStaffUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { armarVencidas, type TareaVencidaInput } from "@/lib/tareas/vencidas";
import { PonerseAlDia } from "@/components/ponerse-al-dia";

export const dynamic = "force-dynamic";

/**
 * "Ponerse al día": las tareas vencidas de todo el equipo, por persona y por
 * tipo, para despejarlas de una. Solo coordinación y dirección: es la
 * herramienta de quien reparte.
 */
export default async function TareasVencidasPage() {
  const me = await requireUser();
  if (!isStaffUser(me)) redirect("/tareas");

  const admin = createAdmin();
  const hoy = hoyYmd();
  const [{ data: raw }, { data: users }, { data: clientes }] = await Promise.all([
    admin
      .from("tasks")
      .select(
        "id, numero, titulo, fecha_limite, estado, asignado_a_id, cliente_id, parent_id, cliente:clients(nombre)"
      )
      .in("estado", ["pendiente", "en_progreso", "en_revision", "bloqueada"])
      .lt("fecha_limite", hoy)
      .limit(1000),
    admin.from("users").select("id, nombre").eq("activo", true).order("nombre"),
    admin.from("clients").select("id, responsable_id"),
  ]);

  const filas = (raw ?? []) as unknown as (Omit<TareaVencidaInput, "madre_titulo"> & {
    parent_id: string | null;
    cliente: { nombre: string } | null;
  })[];

  // El título de la madre dice si es un paso del arranque. PostgREST no
  // embebe la relación de la tabla consigo misma, así que va aparte.
  const madreIds = [...new Set(filas.map((f) => f.parent_id).filter(Boolean))] as string[];
  const { data: madres } = madreIds.length
    ? await admin.from("tasks").select("id, titulo").in("id", madreIds)
    : { data: [] };
  const tituloMadre = new Map(
    ((madres ?? []) as { id: string; titulo: string }[]).map((m) => [m.id, m.titulo])
  );
  const clienteDe = Object.fromEntries(filas.map((f) => [f.id, f.cliente?.nombre ?? null]));
  const personas = ((users ?? []) as { id: string; nombre: string }[]).map((u) => ({
    id: u.id,
    nombre: u.nombre,
  }));

  const grupos = armarVencidas({
    tareas: filas.map((f) => ({ ...f, madre_titulo: f.parent_id ? tituloMadre.get(f.parent_id) ?? null : null })),
    personas,
    responsablePorCliente: Object.fromEntries(
      ((clientes ?? []) as { id: string; responsable_id: string | null }[]).map((c) => [
        c.id,
        c.responsable_id,
      ])
    ),
    hoy,
  }).map((g) => ({
    ...g,
    tareas: g.tareas.map((t) => ({ ...t, cliente: clienteDe[t.id] ?? null })),
  }));

  return <PonerseAlDia grupos={grupos} personas={personas} hoy={hoy} />;
}
