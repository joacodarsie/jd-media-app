import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIMEZONE } from "@/lib/constants";
import { dueState } from "@/lib/dates";
import type { AppUser, Task } from "@/lib/types";
import { formatInTimeZone } from "date-fns-tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function GlobalPage() {
  await requireFeature("global");
  const supabase = createClient();

  const [{ data: tasksRaw }, { data: usersRaw }] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase
      .from("users")
      .select("*")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const tasks = (tasksRaw ?? []) as Task[];
  const users = (usersRaw ?? []) as AppUser[];

  const hace7 = formatInTimeZone(
    new Date(Date.now() - 7 * 86400000),
    TIMEZONE,
    "yyyy-MM-dd"
  );

  const completadas = tasks.filter((t) => t.estado === "completada");
  const completadasSemana = completadas.filter(
    (t) =>
      t.fecha_completada &&
      formatInTimeZone(
        new Date(t.fecha_completada),
        TIMEZONE,
        "yyyy-MM-dd"
      ) >= hace7
  ).length;

  const conLimite = completadas.filter((t) => t.fecha_limite);
  const aTiempo = conLimite.filter(
    (t) =>
      formatInTimeZone(
        new Date(t.fecha_completada as string),
        TIMEZONE,
        "yyyy-MM-dd"
      ) <= (t.fecha_limite as string).slice(0, 10)
  ).length;
  const pctATiempo =
    conLimite.length === 0
      ? null
      : Math.round((aTiempo / conLimite.length) * 100);

  const activas = tasks.filter((t) => t.estado !== "completada");
  const vencidasTotal = activas.filter(
    (t) => dueState(t.fecha_limite, t.estado) === "vencida"
  ).length;

  const porPersona = users
    .map((u) => {
      const suyas = activas.filter((t) => t.asignado_a_id === u.id);
      const venc = suyas.filter(
        (t) => dueState(t.fecha_limite, t.estado) === "vencida"
      ).length;
      return { user: u, activas: suyas.length, vencidas: venc };
    })
    .sort((a, b) => b.activas - a.activas);

  const maxCarga = Math.max(1, ...porPersona.map((p) => p.activas));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Productividad</h1>
        <p className="text-muted-foreground">
          Métricas operativas del equipo: tareas completadas, cumplimiento de
          plazos y carga por persona.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Completadas (7 días)" value={completadasSemana} />
        <Kpi
          label="% a tiempo"
          value={pctATiempo === null ? "—" : `${pctATiempo}%`}
        />
        <Kpi label="Tareas activas" value={activas.length} />
        <Kpi
          label="Vencidas"
          value={vencidasTotal}
          danger={vencidasTotal > 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Carga de trabajo por persona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {porPersona.map((p) => (
              <div key={p.user.id} className="flex items-center gap-3">
                <div className="w-40 shrink-0 truncate text-sm">
                  {p.user.nombre}
                </div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary"
                    style={{
                      width: `${(p.activas / maxCarga) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-28 shrink-0 text-right text-sm">
                  <span className="font-medium">{p.activas}</span> activas
                  {p.vencidas > 0 && (
                    <span className="ml-1 font-semibold text-red-600">
                      ({p.vencidas} venc.)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  danger,
}: {
  label: string;
  value: number | string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-3xl font-bold ${danger ? "text-red-600" : ""}`}>
          {value}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
