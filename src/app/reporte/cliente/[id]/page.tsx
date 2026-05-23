import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_TYPE_LABEL,
  PUBLICATION_STATUS_LABEL,
} from "@/lib/constants";
import type { Client, PublicationStatus } from "@/lib/types";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

interface RawPub {
  id: string;
  titulo: string;
  fecha_publicacion: string | null;
  red: string;
  tipo: string;
  estado: PublicationStatus;
}

interface RawTask {
  id: string;
  titulo: string;
  estado: string;
  fecha_completada: string | null;
  area: string;
  asignado: { nombre: string } | null;
}

function monthBounds(ym: string): { start: string; end: string; label: string } {
  // ym = YYYY-MM
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m || m < 1 || m > 12) {
    const now = new Date();
    return monthBounds(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );
  }
  const start = new Date(y, m - 1, 1, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0); // primer día del mes siguiente
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label,
  };
}

export default async function ReporteClientePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { mes?: string };
}) {
  await requireUser();
  const supabase = createClient();

  // Default: mes actual
  const today = new Date();
  const defaultMes = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const mes = searchParams.mes || defaultMes;
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    redirect(`/reporte/cliente/${params.id}?mes=${defaultMes}`);
  }

  const { start, end, label } = monthBounds(mes);

  const [{ data: client }, { data: pubs }, { data: tasks }] = await Promise.all([
    supabase
      .from("clients")
      .select("*, cm:users!clients_cm_id_fkey(id,nombre), disenador:users!clients_disenador_id_fkey(id,nombre), audiovisual:users!clients_audiovisual_id_fkey(id,nombre), creativa:users!clients_creativa_asignada_id_fkey(id,nombre)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("publications")
      .select("id, titulo, fecha_publicacion, red, tipo, estado")
      .eq("cliente_id", params.id)
      .gte("fecha_publicacion", start)
      .lt("fecha_publicacion", end)
      .order("fecha_publicacion", { ascending: true }),
    supabase
      .from("tasks")
      .select(
        "id, titulo, estado, fecha_completada, area, asignado:users!tasks_asignado_a_id_fkey(nombre)"
      )
      .eq("cliente_id", params.id)
      .eq("estado", "completada")
      .gte("fecha_completada", start)
      .lt("fecha_completada", end)
      .order("fecha_completada", { ascending: true }),
  ]);

  if (!client) notFound();
  const c = client as Client & {
    cm?: { id: string; nombre: string } | null;
    disenador?: { id: string; nombre: string } | null;
    audiovisual?: { id: string; nombre: string } | null;
    creativa?: { id: string; nombre: string } | null;
  };
  const pubList = (pubs ?? []) as RawPub[];
  const taskList = (tasks ?? []) as unknown as RawTask[];

  // Métricas
  const publicadas = pubList.filter((p) => p.estado === "publicado").length;
  const enProceso = pubList.filter(
    (p) => p.estado !== "publicado" && p.estado !== "rechazado"
  ).length;
  const tareasCompletadas = taskList.length;

  // Días con actividad: fechas únicas de publicación o completada
  const dias = new Set<string>();
  for (const p of pubList) if (p.fecha_publicacion) dias.add(p.fecha_publicacion.slice(0, 10));
  for (const t of taskList) if (t.fecha_completada) dias.add(t.fecha_completada.slice(0, 10));

  // Breakdown por red
  const porRed = new Map<string, number>();
  const porTipo = new Map<string, number>();
  for (const p of pubList) {
    if (p.estado === "publicado") {
      porRed.set(p.red, (porRed.get(p.red) ?? 0) + 1);
      porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1);
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Toolbar (no se imprime) */}
      <div className="border-b bg-zinc-50 print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <Link
            href={`/clientes/${params.id}`}
            className="inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver al cliente
          </Link>
          <div className="flex items-center gap-2">
            <MonthPickerForm currentMes={mes} clientId={params.id} />
            <PrintButton />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-10 print:px-0 print:py-0">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-zinc-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFD400]">
                <span className="text-sm font-extrabold text-black">JD</span>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  JD Media · Reporte mensual
                </div>
                <h1 className="text-2xl font-bold leading-tight">{c.nombre}</h1>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Período
            </div>
            <div className="text-lg font-semibold capitalize">{label}</div>
          </div>
        </header>

        {/* Métricas */}
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Publicadas" value={publicadas} accent="bg-emerald-50 border-emerald-200 text-emerald-700" />
          <Stat label="En proceso" value={enProceso} accent="bg-blue-50 border-blue-200 text-blue-700" />
          <Stat label="Tareas completadas" value={tareasCompletadas} accent="bg-amber-50 border-amber-200 text-amber-800" />
          <Stat label="Días con actividad" value={dias.size} accent="bg-zinc-50 border-zinc-200 text-zinc-700" />
        </section>

        {/* Equipo asignado */}
        <section className="mt-8">
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Equipo asignado
          </h2>
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 md:grid-cols-4">
            <Field label="Coordinación" value={c.creativa?.nombre ?? "—"} />
            <Field label="Community Manager" value={c.cm?.nombre ?? "—"} />
            <Field label="Diseño" value={c.disenador?.nombre ?? "—"} />
            <Field label="Audiovisual" value={c.audiovisual?.nombre ?? "—"} />
          </div>
        </section>

        {/* Breakdown publicado por red y tipo */}
        {publicadas > 0 && (
          <section className="mt-8 grid gap-4 md:grid-cols-2 break-inside-avoid">
            <Breakdown
              title="Por red"
              data={porRed}
              labelMap={PUBLICATION_NETWORK_LABEL as Record<string, string>}
            />
            <Breakdown
              title="Por tipo"
              data={porTipo}
              labelMap={PUBLICATION_TYPE_LABEL as Record<string, string>}
            />
          </section>
        )}

        {/* Listado publicaciones */}
        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            Publicaciones del mes ({pubList.length})
          </h2>
          {pubList.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
              Sin publicaciones programadas o publicadas en este período.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Título</th>
                  <th className="py-2">Red · Tipo</th>
                  <th className="py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pubList.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100">
                    <td className="py-2 tabular-nums text-zinc-600">
                      {p.fecha_publicacion
                        ? new Date(p.fecha_publicacion).toLocaleDateString(
                            "es-AR",
                            { day: "2-digit", month: "short" }
                          )
                        : "—"}
                    </td>
                    <td className="py-2 font-medium">{p.titulo}</td>
                    <td className="py-2 text-zinc-600">
                      {(PUBLICATION_NETWORK_LABEL as Record<string, string>)[p.red] ?? p.red}
                      {" · "}
                      {(PUBLICATION_TYPE_LABEL as Record<string, string>)[p.tipo] ?? p.tipo}
                    </td>
                    <td className="py-2 text-right text-xs">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 ${
                          p.estado === "publicado"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.estado === "rechazado"
                            ? "bg-red-50 text-red-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {(PUBLICATION_STATUS_LABEL as Record<string, string>)[p.estado] ?? p.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Tareas */}
        {taskList.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-2 text-base font-semibold text-zinc-900">
              Tareas completadas ({taskList.length})
            </h2>
            <ul className="space-y-1.5 text-sm">
              {taskList.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 border-b border-zinc-100 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.titulo}</div>
                    <div className="text-xs text-zinc-500">
                      {t.area}
                      {t.asignado?.nombre ? ` · ${t.asignado.nombre}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {t.fecha_completada
                      ? new Date(t.fecha_completada).toLocaleDateString(
                          "es-AR",
                          { day: "2-digit", month: "short" }
                        )
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 border-t border-zinc-200 pt-4 text-center text-[10px] uppercase tracking-wider text-zinc-400">
          JD Media · jdmedia.com.ar · Generado el{" "}
          {new Date().toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </footer>
      </div>

      {/* CSS de impresión */}
      <style>{`
        @media print {
          body { background: white !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${accent}`}>
      <div className="text-3xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="text-sm font-medium text-zinc-900">{value}</div>
    </div>
  );
}

function Breakdown({
  title,
  data,
  labelMap,
}: {
  title: string;
  data: Map<string, number>;
  labelMap: Record<string, string>;
}) {
  const entries = Array.from(data.entries()).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin datos.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {entries.map(([k, n]) => (
            <li key={k} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span>{labelMap[k] ?? k}</span>
                <span className="tabular-nums text-zinc-500">{n}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full bg-[#FFD400]"
                  style={{ width: `${Math.round((n / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MonthPickerForm({
  currentMes,
  clientId,
}: {
  currentMes: string;
  clientId: string;
}) {
  return (
    <form action={`/reporte/cliente/${clientId}`} method="get" className="flex items-center gap-2">
      <label htmlFor="mes" className="text-xs text-zinc-600">
        Mes:
      </label>
      <input
        id="mes"
        type="month"
        name="mes"
        defaultValue={currentMes}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50"
      >
        Cambiar
      </button>
    </form>
  );
}

