/**
 * Contexto de la reunión mensual de un cliente.
 *
 * Junta en un solo lugar todo lo que necesitan tanto el GUIÓN (antes del meet)
 * como el DIAGNÓSTICO (después del meet):
 *   - los números reales del mes y del mes anterior,
 *   - quién es la marca según el diagnóstico inicial aprobado,
 *   - qué salió del diagnóstico del mes pasado (lo que se repite es lo que importa).
 *
 * Todo devuelto como texto ya formateado: es lo que se le pasa al modelo.
 */

import { createAdmin } from "@/lib/supabase/admin";
import {
  igMonthlyForReport,
  paidMonthlyForReport,
  igStoriesForReport,
  contentForReport,
} from "@/lib/social/report";
import { prevPeriod, periodLabel } from "@/lib/finanzas";
import type { DiagnosticContent } from "@/lib/diagnostics/schema";
import {
  monthlyDiagnosticToText,
  type MonthlyDiagnosticContext,
} from "./prompt";
import {
  hasMonthlyContent,
  normalizeMonthlyDiagnostic,
  type MonthlyDiagnosticContent,
} from "./schema";

type Admin = ReturnType<typeof createAdmin>;

export interface MeetingContext {
  clienteNombre: string;
  rubro: string | null;
  pack: string | null;
  serviciosContratados: string[];
  mesLabel: string;
  /** Números del mes, ya formateados. null si no hay ningún dato. */
  metricas: string | null;
  /** Quién es la marca, según el diagnóstico inicial aprobado. */
  contextoMarca: string | null;
  /** Diagnóstico del mes anterior en texto. */
  mesAnterior: string | null;
  /** Nota que dejó el equipo en el reporte del mes. */
  notaDelReporte: string | null;
  /** Última calificación que dejó el cliente en la encuesta del portal. */
  satisfaccion: { puntaje: number; que_valoran: string | null; que_mejorar: string | null } | null;
}

function num(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "s/d";
  return Math.round(n).toLocaleString("es-AR");
}

/** Datos base del cliente + servicios activos. */
async function loadCliente(admin: Admin, clienteId: string) {
  const [{ data: cli }, { data: servicios }] = await Promise.all([
    admin.from("clients").select("id, nombre, rubro, pack").eq("id", clienteId).maybeSingle(),
    admin.from("client_services").select("tipo").eq("cliente_id", clienteId).eq("activo", true),
  ]);
  return {
    nombre: (cli as { nombre?: string } | null)?.nombre ?? "el cliente",
    rubro: (cli as { rubro?: string | null } | null)?.rubro ?? null,
    pack: (cli as { pack?: string | null } | null)?.pack ?? null,
    servicios: ((servicios ?? []) as { tipo: string | null }[])
      .map((s) => s.tipo)
      .filter((t): t is string => !!t),
  };
}

/**
 * Resume el diagnóstico inicial aprobado a las secciones que importan para
 * conducir una reunión: quién es, a quién le habla, qué se prometió.
 */
function brandContextToText(c: DiagnosticContent): string {
  const lines: string[] = [];
  if (c.contexto?.que_es) lines.push(`Qué es: ${c.contexto.que_es}`);
  if (c.publico_objetivo?.insight_clave) {
    lines.push(`Insight del público: ${c.publico_objetivo.insight_clave}`);
  }
  const segs = c.publico_objetivo?.segmentos ?? [];
  if (segs.length) {
    lines.push(
      `Público objetivo definido al arrancar: ${segs.map((s) => s.nombre).join(", ")}`
    );
  }
  const objetivos = c.objetivos_trimestre ?? [];
  if (objetivos.length) {
    lines.push("Objetivos que le prometimos:");
    for (const o of objetivos) lines.push(`- ${o.titulo}: ${o.descripcion}`);
  }
  const problemas = c.problemas ?? [];
  if (problemas.length) {
    lines.push("Problemas detectados al arrancar:");
    for (const p of problemas.slice(0, 5)) lines.push(`- ${p.titulo}`);
  }
  const pilares = c.pilares_contenido ?? [];
  if (pilares.length) {
    lines.push(`Pilares de contenido: ${pilares.map((p) => p.nombre).join(", ")}`);
  }
  return lines.join("\n");
}

/** Números del mes + comparación con el anterior, en texto. */
async function metricsToText(admin: Admin, clienteId: string, mes: string): Promise<string | null> {
  const mesPrev = prevPeriod(mes);
  const [ig, paid, historias, contenido, igPrev, paidPrev] = await Promise.all([
    igMonthlyForReport(admin, clienteId, mes),
    paidMonthlyForReport(admin, clienteId, mes),
    igStoriesForReport(admin, clienteId, mes),
    contentForReport(admin, clienteId, mes),
    igMonthlyForReport(admin, clienteId, mesPrev),
    paidMonthlyForReport(admin, clienteId, mesPrev),
  ]);

  const hayAlgo = ig.hasData || paid.hasData || historias.count > 0 || contenido.total > 0;
  if (!hayAlgo) return null;

  const lines: string[] = [];

  if (contenido.total > 0) {
    lines.push(
      `Contenido publicado: ${contenido.total} piezas (${contenido.posts} posts, ${contenido.reels} reels, ${contenido.carruseles} carruseles, ${contenido.historias} historias).`
    );
    if (contenido.titulos.length) {
      lines.push(`Algunas piezas: ${contenido.titulos.slice(0, 10).join(" · ")}`);
    }
  }

  if (ig.hasData) {
    lines.push(
      `Instagram: ${num(ig.followersEnd)} seguidores al cierre · ${num(ig.seguidoresNuevos)} nuevos · alcance ${num(ig.reach)} · interacciones ${num(ig.interactions)} · visitas al perfil ${num(ig.profileViews)}.`
    );
    if (igPrev.hasData) {
      lines.push(
        `Mes anterior en Instagram: ${num(igPrev.seguidoresNuevos)} seguidores nuevos · alcance ${num(igPrev.reach)} · interacciones ${num(igPrev.interactions)}.`
      );
    }
  }

  if (historias.count > 0) {
    lines.push(
      `Historias: ${historias.count} publicadas · alcance ${num(historias.reach)} · respuestas ${num(historias.replies)}.`
    );
  }

  if (paid.hasData) {
    lines.push(
      `Pauta: ${paid.moneda} ${num(paid.spend)} invertidos · ${num(paid.conversions)} conversiones${paid.costPerConv != null ? ` · costo por conversión ${paid.moneda} ${num(paid.costPerConv)}` : ""} · ${num(paid.impressions)} impresiones · ${num(paid.clicks)} clics${paid.ctr != null ? ` · CTR ${paid.ctr.toFixed(2)}%` : ""}.`
    );
    if (paidPrev.hasData) {
      lines.push(
        `Pauta del mes anterior: ${paidPrev.moneda} ${num(paidPrev.spend)} invertidos · ${num(paidPrev.conversions)} conversiones.`
      );
    }
  }

  return lines.join("\n");
}

/**
 * Arma todo el contexto de la reunión mensual de un cliente para un período.
 */
export async function loadMeetingContext(
  clienteId: string,
  mes: string
): Promise<MeetingContext> {
  const admin = createAdmin();
  const mesPrev = prevPeriod(mes);

  const [cliente, metricas, diagIni, diagPrev, reporte, encuesta] = await Promise.all([
    loadCliente(admin, clienteId),
    metricsToText(admin, clienteId, mes),
    admin
      .from("client_diagnostics")
      .select("content")
      .eq("cliente_id", clienteId)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("client_monthly_diagnostics")
      .select("content")
      .eq("cliente_id", clienteId)
      .eq("periodo", mesPrev)
      .maybeSingle(),
    admin
      .from("client_monthly_reports")
      .select("nota")
      .eq("cliente_id", clienteId)
      .eq("year_month", mes)
      .maybeSingle(),
    admin
      .from("client_satisfaction")
      .select("puntaje, que_valoran, que_mejorar")
      .eq("cliente_id", clienteId)
      .eq("periodo", mes)
      .maybeSingle(),
  ]);

  const iniContent = (diagIni?.data as { content?: DiagnosticContent } | null)?.content ?? null;
  const prevContent = (diagPrev?.data as { content?: unknown } | null)?.content ?? null;

  return {
    clienteNombre: cliente.nombre,
    rubro: cliente.rubro,
    pack: cliente.pack,
    serviciosContratados: cliente.servicios,
    mesLabel: periodLabel(mes),
    metricas,
    contextoMarca: iniContent ? brandContextToText(iniContent) || null : null,
    mesAnterior: hasMonthlyContent(prevContent)
      ? monthlyDiagnosticToText(
          periodLabel(mesPrev),
          normalizeMonthlyDiagnostic(prevContent) as MonthlyDiagnosticContent
        )
      : null,
    notaDelReporte: (reporte?.data as { nota?: string | null } | null)?.nota ?? null,
    satisfaccion:
      (encuesta?.data as {
        puntaje?: number;
        que_valoran?: string | null;
        que_mejorar?: string | null;
      } | null)?.puntaje != null
        ? {
            puntaje: (encuesta!.data as { puntaje: number }).puntaje,
            que_valoran:
              (encuesta!.data as { que_valoran?: string | null }).que_valoran ?? null,
            que_mejorar:
              (encuesta!.data as { que_mejorar?: string | null }).que_mejorar ?? null,
          }
        : null,
  };
}

/** Pasa el contexto al formato que espera el prompt del diagnóstico. */
export function toDiagnosticContext(
  ctx: MeetingContext,
  transcript: string,
  notas?: string | null
): MonthlyDiagnosticContext {
  const notasExtra: string[] = [];
  if (notas?.trim()) notasExtra.push(notas.trim());
  if (ctx.notaDelReporte) notasExtra.push(`Nota del reporte del mes: ${ctx.notaDelReporte}`);
  if (ctx.satisfaccion) {
    const s = ctx.satisfaccion;
    const partes = [`El cliente calificó el mes con ${s.puntaje}/5.`];
    if (s.que_valoran) partes.push(`Valora: ${s.que_valoran}`);
    if (s.que_mejorar) partes.push(`Mejoraría: ${s.que_mejorar}`);
    notasExtra.push(partes.join(" "));
  }

  return {
    clienteNombre: ctx.clienteNombre,
    rubro: ctx.rubro,
    pack: ctx.pack,
    serviciosContratados: ctx.serviciosContratados,
    mesLabel: ctx.mesLabel,
    metricas: ctx.metricas,
    contextoMarca: ctx.contextoMarca,
    mesAnterior: ctx.mesAnterior,
    transcript,
    notas: notasExtra.length ? notasExtra.join("\n") : null,
  };
}
