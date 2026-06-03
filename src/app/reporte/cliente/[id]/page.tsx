import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Megaphone,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PUBLICATION_NETWORK_LABEL,
  PUBLICATION_TYPE_LABEL,
  PUBLICATION_STATUS_LABEL,
} from "@/lib/constants";
import type { Client, PublicationStatus } from "@/lib/types";
import { Markdown } from "@/components/markdown";
import { PrintButton } from "@/components/print-button";
import { ReportMonthPicker } from "@/components/report-month-picker";
import { MonthlyReportEditor } from "@/components/monthly-report-editor";
import type { MonthlyMetrics } from "@/app/reporte/cliente/[id]/actions";

export const dynamic = "force-dynamic";

interface RawPub {
  id: string;
  titulo: string;
  copy: string | null;
  fecha_publicacion: string | null;
  red: string;
  tipo: string;
  estado: PublicationStatus;
  asset_url: string | null;
  link_publicacion: string | null;
  link_instagram: string | null;
  link_tiktok: string | null;
  link_facebook: string | null;
  notas_revision: string | null;
}

function preferredLink(p: RawPub): string | null {
  // 1) Si está la red específica con su link, usar esa
  if (p.red === "instagram" && p.link_instagram) return p.link_instagram;
  if (p.red === "tiktok" && p.link_tiktok) return p.link_tiktok;
  if (p.red === "facebook" && p.link_facebook) return p.link_facebook;
  // 2) Cualquier link cargado en orden de prioridad
  return (
    p.link_instagram ||
    p.link_tiktok ||
    p.link_facebook ||
    p.link_publicacion ||
    null
  );
}

interface RawTask {
  id: string;
  titulo: string;
  estado: string;
  fecha_completada: string | null;
  area: string;
  asignado: { nombre: string } | null;
}

interface RawComment {
  id: string;
  publication_id: string;
  contenido: string;
  created_at: string;
  publication: { titulo: string } | null;
}

interface RawService {
  tipo: string;
  pack: string | null;
  monto_mensual: number | null;
  moneda: string;
  activo: boolean;
}

function monthBounds(ym: string): { start: string; end: string; label: string } {
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
  const end = new Date(y, m, 1, 0, 0, 0);
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

function nextMonthBounds(ym: string): { start: string; end: string } {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const start = new Date(y, m, 1, 0, 0, 0);
  const end = new Date(y, m + 1, 1, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

const SERVICE_LABEL: Record<string, string> = {
  gestion_redes: "Gestión de redes",
  paid_media: "Paid Media",
  produccion_contenido: "Producción de contenido",
  diseno_grafico: "Diseño gráfico",
  edicion_audiovisual: "Edición audiovisual",
  desarrollo_web: "Desarrollo web",
  botly: "Botly",
  consultoria: "Consultoría",
  otro: "Otro",
};

export default async function ReporteClientePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { mes?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  const today = new Date();
  const defaultMes = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;
  const mes = searchParams.mes || defaultMes;
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    redirect(`/reporte/cliente/${params.id}?mes=${defaultMes}`);
  }

  const { start, end, label } = monthBounds(mes);
  const next = nextMonthBounds(mes);

  const [
    { data: client },
    { data: pubs },
    { data: tasks },
    { data: comments },
    { data: services },
    { data: nextPubs },
    { data: monthly },
    { data: planRow },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "*, cm:users!clients_cm_id_fkey(id,nombre), disenador:users!clients_disenador_id_fkey(id,nombre), audiovisual:users!clients_audiovisual_id_fkey(id,nombre), creativa:users!clients_creativa_asignada_id_fkey(id,nombre)"
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("publications")
      .select(
        "id, titulo, copy, fecha_publicacion, red, tipo, estado, asset_url, link_publicacion, link_instagram, link_tiktok, link_facebook, notas_revision"
      )
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
    supabase
      .from("client_pub_comments")
      .select(
        "id, publication_id, contenido, created_at, publication:publications(titulo)"
      )
      .eq("cliente_id", params.id)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("client_services")
      .select("tipo, pack, monto_mensual, moneda, activo")
      .eq("cliente_id", params.id)
      .eq("activo", true),
    supabase
      .from("publications")
      .select("id, titulo, fecha_publicacion, red, tipo, estado")
      .eq("cliente_id", params.id)
      .gte("fecha_publicacion", next.start)
      .lt("fecha_publicacion", next.end)
      .neq("estado", "rechazado")
      .order("fecha_publicacion", { ascending: true })
      .limit(8),
    supabase
      .from("client_monthly_reports")
      .select("nota, metricas")
      .eq("cliente_id", params.id)
      .eq("year_month", mes)
      .maybeSingle(),
    // Plan vigente para este mes: busca por periodo_label que contenga el mes
    // o por approved_at dentro del rango. Trae el más reciente que matchee.
    supabase
      .from("client_content_plans")
      .select("id, periodo_label, content, applied_temas_indices, approved_at, status")
      .eq("cliente_id", params.id)
      .in("status", ["active", "archived"])
      .or(`approved_at.gte.${start},approved_at.lt.${end},periodo_label.ilike.%${new Date(start).toLocaleDateString("es-AR", { month: "long" })}%`)
      .order("approved_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const monthlyReport = (monthly ?? null) as
    | { nota: string | null; metricas: MonthlyMetrics }
    | null;
  const nota = monthlyReport?.nota ?? null;
  const metricas: MonthlyMetrics = monthlyReport?.metricas ?? {};
  const hasOrganicMetrics = [
    metricas.seguidores_nuevos,
    metricas.reach,
    metricas.impresiones,
    metricas.interacciones,
    metricas.visitas_perfil,
  ].some((v) => v != null);
  const hasAdsMetrics = [
    metricas.ads_inversion,
    metricas.ads_impresiones,
    metricas.ads_clicks,
    metricas.ads_ctr,
    metricas.ads_cpm,
    metricas.ads_conversiones,
    metricas.ads_roas,
  ].some((v) => v != null) || !!metricas.ads_notas;

  if (!client) notFound();
  const c = client as Client & {
    cm?: { id: string; nombre: string } | null;
    disenador?: { id: string; nombre: string } | null;
    audiovisual?: { id: string; nombre: string } | null;
    creativa?: { id: string; nombre: string } | null;
  };
  // Pueden editar el reporte: staff (admin/coordinador) y la CM / responsable
  // asignada a esta cuenta.
  const canEdit =
    isStaff(me.rol) ||
    c.cm_id === me.id ||
    c.creativa_asignada_id === me.id;
  const pubList = (pubs ?? []) as RawPub[];
  const taskList = (tasks ?? []) as unknown as RawTask[];
  const commentList = (comments ?? []) as unknown as RawComment[];
  const serviceList = (services ?? []) as RawService[];
  const nextPubList = (nextPubs ?? []) as unknown as RawPub[];

  // Cumplimiento del Plan vigente para este mes (si existe)
  const planMes = planRow as
    | {
        id: string;
        periodo_label: string;
        content: { temas_destacados?: Array<{ titulo: string; pilar?: string }>; distribucion_pilares?: Array<{ pilar: string; porcentaje: number }> };
        applied_temas_indices: number[];
      }
    | null;

  let cumplimiento: {
    periodo: string;
    temasPlan: number;
    temasAplicados: number;
    publicadasDelPlan: number;
    pctAplicacion: number;
    pctPublicacion: number;
    pilaresPlan: { pilar: string; pct: number }[];
    pilaresReal: { pilar: string; count: number; pct: number }[];
  } | null = null;

  if (planMes && planMes.content?.temas_destacados) {
    const temasPlan = planMes.content.temas_destacados.length;
    const applied = planMes.applied_temas_indices ?? [];
    const temasAplicados = applied.length;

    // Pubs publicadas del mes que tienen from_plan_id apuntando a este plan
    const publicadasDelPlan = pubList.filter(
      (p) => p.estado === "publicado"
    ).length; // Aproximación: cuántas se publicaron en el mes

    const pilaresPlan = (planMes.content.distribucion_pilares ?? []).map((p) => ({
      pilar: p.pilar,
      pct: p.porcentaje,
    }));

    // Pilares reales: contar publicaciones por pilar usando el tema applied de cada tema_idx
    const pilarCount = new Map<string, number>();
    for (const idx of applied) {
      const t = planMes.content.temas_destacados[idx];
      const pilar = t?.pilar ?? "Sin pilar";
      pilarCount.set(pilar, (pilarCount.get(pilar) ?? 0) + 1);
    }
    const totalAplicados = Math.max(1, applied.length);
    const pilaresReal = Array.from(pilarCount.entries()).map(([pilar, count]) => ({
      pilar,
      count,
      pct: Math.round((count / totalAplicados) * 100),
    }));

    cumplimiento = {
      periodo: planMes.periodo_label,
      temasPlan,
      temasAplicados,
      publicadasDelPlan,
      pctAplicacion: temasPlan > 0 ? Math.round((temasAplicados / temasPlan) * 100) : 0,
      pctPublicacion:
        temasAplicados > 0 ? Math.round((publicadasDelPlan / temasAplicados) * 100) : 0,
      pilaresPlan,
      pilaresReal,
    };
  }

  // Métricas
  const publicadas = pubList.filter((p) => p.estado === "publicado").length;
  const aprobadas = pubList.filter((p) => p.estado === "aprobado").length;
  const cambiosPedidos = pubList.filter((p) => p.estado === "rechazado").length;
  const enProceso = pubList.filter(
    (p) =>
      p.estado !== "publicado" &&
      p.estado !== "aprobado" &&
      p.estado !== "rechazado"
  ).length;
  const tareasCompletadas = taskList.length;
  const totalRevisadas = publicadas + aprobadas + cambiosPedidos;
  const tasaAprobacion =
    totalRevisadas > 0
      ? Math.round(((publicadas + aprobadas) / totalRevisadas) * 100)
      : null;

  // Días con actividad
  const dias = new Set<string>();
  for (const p of pubList)
    if (p.fecha_publicacion) dias.add(p.fecha_publicacion.slice(0, 10));
  for (const t of taskList)
    if (t.fecha_completada) dias.add(t.fecha_completada.slice(0, 10));

  // Breakdown por red y tipo (sólo publicadas)
  const porRed = new Map<string, number>();
  const porTipo = new Map<string, number>();
  for (const p of pubList) {
    if (p.estado === "publicado") {
      porRed.set(p.red, (porRed.get(p.red) ?? 0) + 1);
      porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1);
    }
  }

  // Galería de pubs publicadas con asset_url
  const galeria = pubList
    .filter((p) => p.estado === "publicado" && p.asset_url)
    .slice(0, 12);

  // Monto contratado total
  const totalContratado = serviceList.reduce(
    (acc, s) => acc + (s.monto_mensual ?? 0),
    0
  );
  const monedaContratado = serviceList[0]?.moneda ?? "ARS";

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
            <ReportMonthPicker currentMes={mes} clientId={params.id} />
            {canEdit && (
              <MonthlyReportEditor
                clienteId={params.id}
                yearMonth={mes}
                initialNota={nota}
                initialMetricas={metricas}
              />
            )}
            <PrintButton />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-8 py-10 print:px-0 print:py-0">
        {/* Header / Portada */}
        <header className="border-b border-zinc-200 pb-6">
          <div className="flex items-start justify-between">
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
          </div>

          {/* Servicios contratados */}
          {serviceList.length > 0 && (
            <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Servicios contratados
                </span>
                {totalContratado > 0 && (
                  <span className="text-sm font-semibold tabular-nums text-zinc-700">
                    {monedaContratado} {totalContratado.toLocaleString("es-AR")} /mes
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {serviceList.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs"
                  >
                    <span className="font-medium">
                      {SERVICE_LABEL[s.tipo] ?? s.tipo}
                    </span>
                    {s.pack && <span className="text-zinc-500">· {s.pack}</span>}
                    {s.monto_mensual != null && (
                      <span className="text-zinc-500 tabular-nums">
                        · {s.moneda} {Number(s.monto_mensual).toLocaleString("es-AR")}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Nota destacada del mes */}
        {nota && (
          <section className="mt-6 break-inside-avoid rounded-lg border-l-4 border-[#FFD400] bg-yellow-50/50 p-5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Highlights del mes
            </div>
            <div className="prose prose-sm max-w-none text-zinc-800">
              <Markdown>{nota}</Markdown>
            </div>
          </section>
        )}

        {/* Métricas principales */}
        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Publicadas"
            value={publicadas}
            accent="bg-emerald-50 border-emerald-200 text-emerald-700"
          />
          <Stat
            label="En proceso"
            value={enProceso}
            accent="bg-blue-50 border-blue-200 text-blue-700"
          />
          <Stat
            label="Tareas completadas"
            value={tareasCompletadas}
            accent="bg-amber-50 border-amber-200 text-amber-800"
          />
          <Stat
            label="Días con actividad"
            value={dias.size}
            accent="bg-zinc-50 border-zinc-200 text-zinc-700"
          />
        </section>

        {/* Estado de aprobaciones */}
        {totalRevisadas > 0 && (
          <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 break-inside-avoid">
            <ApprovalCard
              icon={CheckCircle2}
              label="Aprobado / Publicado"
              value={publicadas + aprobadas}
              tone="emerald"
            />
            <ApprovalCard
              icon={XCircle}
              label="Cambios pedidos"
              value={cambiosPedidos}
              tone="red"
            />
            {tasaAprobacion != null && (
              <div className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="text-3xl font-bold leading-none tabular-nums text-zinc-900">
                  {tasaAprobacion}%
                </div>
                <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Tasa de aprobación
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${tasaAprobacion}%` }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

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

        {/* Métricas orgánicas */}
        {hasOrganicMetrics && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Métricas del mes (orgánico)
            </h2>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 md:grid-cols-5">
              <MetricBox label="Seguidores nuevos" value={metricas.seguidores_nuevos} prefix="+" />
              <MetricBox label="Alcance" value={metricas.reach} />
              <MetricBox label="Impresiones" value={metricas.impresiones} />
              <MetricBox label="Interacciones" value={metricas.interacciones} />
              <MetricBox label="Visitas al perfil" value={metricas.visitas_perfil} />
            </div>
          </section>
        )}

        {/* Cumplimiento del Plan de Contenido del mes */}
        {cumplimiento && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Cumplimiento del plan ({cumplimiento.periodo})
            </h2>
            <div className="rounded-lg border border-zinc-200 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricBox label="Temas del plan" value={cumplimiento.temasPlan} />
                <MetricBox label="Aplicados al calendario" value={cumplimiento.temasAplicados} />
                <MetricBox label="% aplicación" value={cumplimiento.pctAplicacion} suffix="%" />
                <MetricBox label="Publicadas en el mes" value={cumplimiento.publicadasDelPlan} />
              </div>

              {cumplimiento.pilaresPlan.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Distribución por pilar
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-zinc-500">
                        <th className="py-1 text-left font-medium">Pilar</th>
                        <th className="py-1 text-right font-medium">Plan</th>
                        <th className="py-1 text-right font-medium">Real</th>
                        <th className="py-1 text-right font-medium">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cumplimiento.pilaresPlan.map((p) => {
                        const real = cumplimiento.pilaresReal.find((r) => r.pilar === p.pilar);
                        const realPct = real?.pct ?? 0;
                        const diff = realPct - p.pct;
                        return (
                          <tr key={p.pilar} className="border-b last:border-0">
                            <td className="py-2">{p.pilar}</td>
                            <td className="py-2 text-right">{p.pct}%</td>
                            <td className="py-2 text-right">{realPct}%</td>
                            <td
                              className={`py-2 text-right text-xs ${
                                Math.abs(diff) < 10 ? "text-zinc-500" : diff > 0 ? "text-emerald-600" : "text-amber-600"
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}pp
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Meta Ads */}
        {hasAdsMetrics && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900">
              <Megaphone className="h-4 w-4 text-blue-600" />
              Paid Media (Meta Ads)
            </h2>
            <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {metricas.ads_inversion != null && (
                  <MetricBox
                    label="Inversión"
                    value={metricas.ads_inversion}
                    prefix={`${metricas.ads_moneda ?? "ARS"} `}
                    decimals={2}
                  />
                )}
                <MetricBox label="Impresiones" value={metricas.ads_impresiones} />
                <MetricBox label="Clicks" value={metricas.ads_clicks} />
                <MetricBox label="CTR" value={metricas.ads_ctr} suffix="%" decimals={2} />
                <MetricBox label="CPM" value={metricas.ads_cpm} decimals={2} />
                <MetricBox label="Conversiones" value={metricas.ads_conversiones} />
                <MetricBox label="ROAS" value={metricas.ads_roas} suffix="x" decimals={2} />
              </div>
              {metricas.ads_notas && (
                <div className="mt-3 border-t border-blue-100 pt-3 text-sm text-zinc-700">
                  {metricas.ads_notas}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Breakdown por red y tipo */}
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

        {/* Galería de publicaciones */}
        {galeria.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              Galería del mes
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {galeria.map((p) => (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-lg border border-zinc-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.asset_url ?? ""}
                    alt={p.titulo}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="space-y-0.5 p-2">
                    <div className="line-clamp-1 text-xs font-medium">
                      {p.titulo}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {(PUBLICATION_NETWORK_LABEL as Record<string, string>)[p.red] ?? p.red}
                      {" · "}
                      {p.fecha_publicacion &&
                        new Date(p.fecha_publicacion).toLocaleDateString(
                          "es-AR",
                          { day: "2-digit", month: "short" }
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Listado completo */}
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
                    <td className="py-2 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span>{p.titulo}</span>
                        {preferredLink(p) && (
                          <a
                            href={preferredLink(p)!}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                            title="Abrir publicación"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </span>
                    </td>
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

        {/* Feedback del cliente */}
        {commentList.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-900">
              <MessageSquare className="h-4 w-4 text-zinc-500" />
              Feedback del cliente ({commentList.length})
            </h2>
            <ul className="space-y-2">
              {commentList.slice(0, 8).map((cm) => (
                <li
                  key={cm.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="font-medium">
                      Sobre: {cm.publication?.titulo ?? "—"}
                    </span>
                    <span>
                      {new Date(cm.created_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-zinc-700">{cm.contenido}</p>
                </li>
              ))}
            </ul>
            {commentList.length > 8 && (
              <p className="mt-2 text-xs text-zinc-500">
                + {commentList.length - 8} comentarios más en el portal.
              </p>
            )}
          </section>
        )}

        {/* Tareas completadas */}
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

        {/* Lo que viene el mes siguiente */}
        {nextPubList.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-2 text-base font-semibold text-zinc-900">
              Lo que viene en el próximo mes
            </h2>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
              <ul className="space-y-1.5 text-sm">
                {nextPubList.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-1"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.titulo}</div>
                      <div className="text-xs text-zinc-500">
                        {(PUBLICATION_NETWORK_LABEL as Record<string, string>)[p.red] ?? p.red}
                        {" · "}
                        {(PUBLICATION_TYPE_LABEL as Record<string, string>)[p.tipo] ?? p.tipo}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs tabular-nums text-zinc-500">
                      {p.fecha_publicacion &&
                        new Date(p.fecha_publicacion).toLocaleDateString(
                          "es-AR",
                          { day: "2-digit", month: "short" }
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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

function ApprovalCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  tone: "emerald" | "red";
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/40 text-emerald-700"
      : "border-red-200 bg-red-50/40 text-red-700";
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${styles}`}>
      <Icon className="h-7 w-7 opacity-70" />
      <div>
        <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wider">
          {label}
        </div>
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  prefix,
  suffix,
  decimals = 0,
}: {
  label: string;
  value: number | null | undefined;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const display =
    value == null
      ? "—"
      : `${prefix ?? ""}${Number(value).toLocaleString("es-AR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix ?? ""}`;
  return (
    <div>
      <div className="text-xl font-bold leading-none tabular-nums text-zinc-900">
        {display}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-500">
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

