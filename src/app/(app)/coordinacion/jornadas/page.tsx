import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { JornadasPanel, type Jornada } from "@/components/jornadas-panel";

export const dynamic = "force-dynamic";

export default async function JornadasPage() {
  await requireRole(["admin"]);
  const admin = createAdmin();

  const [{ data: sessionsRaw }, { data: usersRaw }, { data: clientsRaw }] =
    await Promise.all([
      admin
        .from("production_sessions")
        .select("id, fecha, periodo, monto, cliente_id, lugar, notas, asistentes")
        .order("fecha", { ascending: false }),
      admin
        .from("users")
        .select("id, nombre, rol")
        .eq("activo", true)
        .order("nombre"),
      admin.from("clients").select("id, nombre").eq("estado", "activo").order("nombre"),
    ]);

  const users = (usersRaw ?? []) as { id: string; nombre: string; rol: string }[];
  const clients = (clientsRaw ?? []) as { id: string; nombre: string }[];
  const clientById = new Map(clients.map((c) => [c.id, c.nombre]));

  const jornadas: Jornada[] = ((sessionsRaw ?? []) as Array<{
    id: string;
    fecha: string;
    periodo: string;
    monto: number;
    cliente_id: string | null;
    lugar: string | null;
    notas: string | null;
    asistentes: string[];
  }>).map((s) => ({
    id: s.id,
    fecha: s.fecha,
    periodo: s.periodo,
    monto: Number(s.monto),
    clienteId: s.cliente_id,
    cliente: s.cliente_id ? clientById.get(s.cliente_id) ?? null : null,
    lugar: s.lugar,
    notas: s.notas,
    asistentes: s.asistentes ?? [],
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Jornadas de producción</h1>
        <p className="text-muted-foreground">
          Filmaciones y producciones presenciales que cobra la agencia. El monto
          de cada jornada se reparte en partes iguales entre quienes asistieron y
          se suma automáticamente a la nómina del mes. Solo vos lo ves.
        </p>
      </div>
      <JornadasPanel
        jornadas={jornadas}
        team={users.map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol }))}
        clientOptions={clients}
      />
    </div>
  );
}
