import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_ORDER } from "@/lib/constants";
import type { TaskWithRels } from "@/lib/types";
import { dueState } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { TaskList } from "@/components/task-list";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createClient();

  const { data } = await supabase
    .from("tasks")
    .select("*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url)")
    .eq("asignado_a_id", user.id)
    .order("fecha_limite", { ascending: true, nullsFirst: false });

  const tasks = (data ?? []) as TaskWithRels[];
  tasks.sort(
    (a, b) => PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad]
  );

  const activas = tasks.filter((t) => t.estado !== "completada");
  const pendientes = activas.filter((t) => t.estado === "pendiente").length;
  const enProgreso = activas.filter((t) => t.estado === "en_progreso").length;
  const vencidas = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "vencida"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {user.nombre} 👋</h1>
        <p className="text-muted-foreground">Esto es lo que tenés para hoy.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pendientes" value={pendientes} />
        <Stat label="En progreso" value={enProgreso} />
        <Stat label="Vencidas" value={vencidas} danger={vencidas > 0} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Mis tareas</h2>
        {activas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tenés tareas activas. 🎉
          </p>
        ) : (
          <TaskList tasks={activas} currentUserId={user.id} />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div
          className={`text-3xl font-bold ${danger ? "text-red-600" : ""}`}
        >
          {value}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
