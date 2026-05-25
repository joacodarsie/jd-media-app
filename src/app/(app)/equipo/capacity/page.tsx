import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

/**
 * Vista de capacidad del equipo: cuanto tiene asignado cada persona ahora
 * (tareas activas, vencidas, proximas 7 dias, pubs en pipeline).
 *
 * Ayuda a:
 *  - detectar quien esta sobrecargado vs disponible
 *  - decidir a quien asignar trabajo nuevo
 *  - prevenir burnout
 */

interface UserLite {
  id: string;
  nombre: string;
  avatar_url: string | null;
  area: string | null;
  position: { nombre: string } | null;
}

interface TaskLite {
  id: string;
  asignado_a_id: string | null;
  estado: string;
  fecha_limite: string | null;
}

interface PubLite {
  id: string;
  audiovisual_id: string | null;
  creado_por_id: string | null;
  estado: string;
  fecha_publicacion: string | null;
}

function initials(nombre: string) {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function CapacityPage() {
  await requireUser();
  const supabase = createClient();

  const todayYmd = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [{ data: usersRaw }, { data: tasksRaw }, { data: pubsRaw }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, nombre, avatar_url, area, position:positions(nombre)")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("tasks")
        .select("id, asignado_a_id, estado, fecha_limite")
        .neq("estado", "completada"),
      supabase
        .from("publications")
        .select("id, audiovisual_id, creado_por_id, estado, fecha_publicacion")
        .not("estado", "in", "(publicado,rechazado)"),
    ]);

  const users = (usersRaw ?? []) as unknown as UserLite[];
  const tasks = (tasksRaw ?? []) as TaskLite[];
  const pubs = (pubsRaw ?? []) as PubLite[];

  type Row = {
    user: UserLite;
    activas: number;
    vencidas: number;
    proximas7: number;
    pubsPipeline: number;
    load: number; // 0-100 heuristica
  };

  const rows: Row[] = users.map((u) => {
    const mias = tasks.filter((t) => t.asignado_a_id === u.id);
    const activas = mias.length;
    const vencidas = mias.filter(
      (t) => t.fecha_limite && t.fecha_limite < todayYmd
    ).length;
    const proximas7 = mias.filter(
      (t) =>
        t.fecha_limite && t.fecha_limite >= todayYmd && t.fecha_limite <= in7
    ).length;
    const pubsPipeline = pubs.filter(
      (p) => p.audiovisual_id === u.id || p.creado_por_id === u.id
    ).length;

    // Heuristica: 10 unidades = 100% (tareas activas + pubs pipeline*0.5 + vencidas*2)
    const score = activas + pubsPipeline * 0.5 + vencidas * 2;
    const load = Math.min(100, Math.round((score / 10) * 100));

    return { user: u, activas, vencidas, proximas7, pubsPipeline, load };
  });

  // Sobrecargados primero, despues disponibles
  rows.sort((a, b) => b.load - a.load);

  const sobrecargados = rows.filter((r) => r.load >= 80 || r.vencidas >= 2);
  const disponibles = rows.filter((r) => r.load <= 30 && r.vencidas === 0);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/equipo">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver a Equipo
          </Link>
        </Button>
        <div className="mt-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            Equipo
            <HelpTrigger slug="capacity" label="Cómo se calcula la carga" />
          </div>
          <h1 className="text-2xl font-bold">Capacidad</h1>
          <p className="text-sm text-muted-foreground">
            Cuánto tiene cada persona en su plato. Sirve para detectar burnout
            y decidir a quién asignar trabajo nuevo.
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          tone="rose"
          icon={AlertTriangle}
          label="Sobrecargadas/os"
          value={sobrecargados.length}
          hint="≥80% de carga o ≥2 tareas vencidas"
        />
        <SummaryCard
          tone="emerald"
          icon={CheckCircle2}
          label="Disponibles"
          value={disponibles.length}
          hint="≤30% de carga y 0 vencidas"
        />
        <SummaryCard
          tone="muted"
          label="Personas activas"
          value={rows.length}
          hint="usuarios con cuenta activa"
        />
      </div>

      {/* Cards en mobile */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <CapacityCard key={r.user.id} row={r} />
        ))}
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
            No hay personas activas para mostrar.
          </p>
        )}
      </div>

      {/* Tabla en desktop */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="w-full">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Persona</th>
              <th className="px-3 py-2 text-right font-semibold">Activas</th>
              <th className="px-3 py-2 text-right font-semibold">Vencidas</th>
              <th className="px-3 py-2 text-right font-semibold">7 días</th>
              <th className="px-3 py-2 text-right font-semibold">Pubs</th>
              <th className="px-4 py-2 text-left font-semibold">Carga</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.user.id}
                className="border-t transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/equipo/persona/${r.user.id}`}
                    className="flex items-center gap-2.5"
                  >
                    <Avatar className="h-7 w-7 ring-1 ring-border/60">
                      {r.user.avatar_url && (
                        <AvatarImage
                          src={r.user.avatar_url}
                          alt={r.user.nombre}
                        />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {initials(r.user.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {r.user.nombre}
                      </div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {r.user.position?.nombre ?? r.user.area ?? "—"}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                  {r.activas}
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                  {r.vencidas > 0 ? (
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {r.vencidas}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                  {r.proximas7}
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums text-muted-foreground">
                  {r.pubsPipeline}
                </td>
                <td className="px-4 py-2.5">
                  <LoadBar load={r.load} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No hay personas activas para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Heurística de carga: <code>activas + pubs×0.5 + vencidas×2</code>,
        normalizado a 10 unidades = 100%. Es una aproximación — un buen punto
        de partida para hablar 1:1, no un reemplazo del juicio.
      </p>
    </div>
  );
}

function SummaryCard({
  tone,
  icon: Icon,
  label,
  value,
  hint,
}: {
  tone: "rose" | "emerald" | "muted";
  icon?: typeof AlertTriangle;
  label: string;
  value: number;
  hint: string;
}) {
  const cls =
    tone === "rose"
      ? "border-rose-300/60 bg-rose-50/40 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300"
      : tone === "emerald"
      ? "border-emerald-300/60 bg-emerald-50/40 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300"
      : "border-border bg-card text-foreground";
  return (
    <div className={cn("rounded-lg border p-4", cls)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] opacity-70">{hint}</div>
    </div>
  );
}

function CapacityCard({
  row,
}: {
  row: {
    user: UserLite;
    activas: number;
    vencidas: number;
    proximas7: number;
    pubsPipeline: number;
    load: number;
  };
}) {
  const r = row;
  const tone =
    r.load >= 80
      ? "border-l-rose-500"
      : r.load >= 50
      ? "border-l-amber-500"
      : r.load > 0
      ? "border-l-emerald-500"
      : "border-l-muted";
  return (
    <Link
      href={`/equipo/persona/${r.user.id}`}
      className={cn(
        "block rounded-lg border border-l-4 bg-card p-3 transition hover:shadow-sm",
        tone
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 ring-1 ring-border/60">
          {r.user.avatar_url && (
            <AvatarImage src={r.user.avatar_url} alt={r.user.nombre} />
          )}
          <AvatarFallback className="text-[11px]">
            {initials(r.user.nombre)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{r.user.nombre}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {r.user.position?.nombre ?? r.user.area ?? "—"}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <LoadBar load={r.load} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[11px]">
        <div>
          <div className="text-sm font-semibold tabular-nums">{r.activas}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Activas
          </div>
        </div>
        <div>
          <div
            className={cn(
              "text-sm font-semibold tabular-nums",
              r.vencidas > 0 && "text-rose-600 dark:text-rose-400"
            )}
          >
            {r.vencidas}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Venc.
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{r.proximas7}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            7 días
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold tabular-nums">{r.pubsPipeline}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
            Pubs
          </div>
        </div>
      </div>
    </Link>
  );
}

function LoadBar({ load }: { load: number }) {
  const color =
    load >= 80
      ? "bg-rose-500"
      : load >= 50
      ? "bg-amber-500"
      : load > 0
      ? "bg-emerald-500"
      : "bg-muted";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${load}%` }}
        />
      </div>
      <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
        {load}%
      </span>
    </div>
  );
}
