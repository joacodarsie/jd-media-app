"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, isStaff } from "@/lib/auth";
import { igMonthlyForReport, paidMonthlyForReport } from "@/lib/social/report";
import { generateResultsReading as genReading } from "@/lib/social/insight";

export interface MonthlyMetrics {
  // Orgánico
  seguidores_nuevos?: number | null;
  reach?: number | null;
  impresiones?: number | null;
  interacciones?: number | null;
  visitas_perfil?: number | null;
  // Paid Media (manual hasta que integremos Meta Ads)
  ads_inversion?: number | null;
  ads_moneda?: string | null;
  ads_impresiones?: number | null;
  ads_clicks?: number | null;
  ads_ctr?: number | null;
  ads_cpm?: number | null;
  ads_conversiones?: number | null;
  ads_roas?: number | null;
  ads_notas?: string | null;
}

export interface MonthlyReportInput {
  cliente_id: string;
  year_month: string;
  nota: string | null;
  metricas: MonthlyMetrics;
}

function clean(input: MonthlyReportInput): MonthlyReportInput {
  const m = input.metricas ?? {};
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s || null;
  };
  return {
    cliente_id: input.cliente_id,
    year_month: input.year_month,
    nota: input.nota?.trim() || null,
    metricas: {
      seguidores_nuevos: num(m.seguidores_nuevos),
      reach: num(m.reach),
      impresiones: num(m.impresiones),
      interacciones: num(m.interacciones),
      visitas_perfil: num(m.visitas_perfil),
      ads_inversion: num(m.ads_inversion),
      ads_moneda: str(m.ads_moneda) || "ARS",
      ads_impresiones: num(m.ads_impresiones),
      ads_clicks: num(m.ads_clicks),
      ads_ctr: num(m.ads_ctr),
      ads_cpm: num(m.ads_cpm),
      ads_conversiones: num(m.ads_conversiones),
      ads_roas: num(m.ads_roas),
      ads_notas: str(m.ads_notas),
    },
  };
}

/**
 * Puede editar el reporte de un cliente: staff (admin/coordinador) o la CM /
 * responsable asignada a esa cuenta.
 */
async function canEditClientReport(
  supabase: ReturnType<typeof createClient>,
  meId: string,
  meRol: string,
  clienteId: string
): Promise<boolean> {
  if (isStaff(meRol)) return true;
  const { data } = await supabase
    .from("clients")
    .select("cm_id")
    .eq("id", clienteId)
    .maybeSingle();
  return !!data && data.cm_id === meId;
}

export async function upsertMonthlyReport(input: MonthlyReportInput) {
  const me = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(input.year_month)) {
    return { error: "Mes inválido." };
  }
  const supabase = createClient();
  if (!(await canEditClientReport(supabase, me.id, me.rol, input.cliente_id))) {
    return { error: "No tenés permiso para editar este reporte." };
  }
  const payload = clean(input);
  // Autorizado a nivel app; escribimos con admin para sortear el RLS staff-only
  // (la CM/responsable no es staff pero sí puede editar su reporte).
  const { error } = await createAdmin().from("client_monthly_reports").upsert(
    {
      cliente_id: payload.cliente_id,
      year_month: payload.year_month,
      nota: payload.nota,
      metricas: payload.metricas,
      created_by_id: me.id,
    },
    { onConflict: "cliente_id,year_month" }
  );
  if (error) return { error: error.message };
  revalidatePath(`/reporte/cliente/${payload.cliente_id}`);
  return { ok: true };
}

function monthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  if (!y || !m) return mes;
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

/**
 * Genera (on-demand) la lectura con IA de los resultados del mes — interpreta los
 * números reales de Instagram + paid media — y la guarda en el reporte. Se muestra
 * en el reporte y en el portal del cliente.
 */
export async function generateResultsReading(clienteId: string, mes: string) {
  const me = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(mes)) return { error: "Mes inválido." };
  const supabase = createClient();
  if (!(await canEditClientReport(supabase, me.id, me.rol, clienteId))) {
    return { error: "No tenés permiso para este reporte." };
  }
  const admin = createAdmin();

  const [{ data: cli }, ig, paid] = await Promise.all([
    admin.from("clients").select("nombre").eq("id", clienteId).maybeSingle(),
    igMonthlyForReport(admin, clienteId, mes),
    paidMonthlyForReport(admin, clienteId, mes),
  ]);
  if (!ig.hasData && !paid.hasData) {
    return {
      error:
        "Todavía no hay datos automáticos de resultados este mes (conectá Instagram y/o la cuenta de pauta).",
    };
  }

  const texto = await genReading({
    nombre: (cli as { nombre?: string } | null)?.nombre ?? "el cliente",
    mesLabel: monthLabel(mes),
    ig: {
      hasData: ig.hasData,
      followersEnd: ig.followersEnd,
      seguidoresNuevos: ig.seguidoresNuevos,
      reach: ig.reach,
      profileViews: ig.profileViews,
      interactions: ig.interactions,
    },
    paid: {
      hasData: paid.hasData,
      moneda: paid.moneda,
      spend: paid.spend,
      conversions: paid.conversions,
      costPerConv: paid.costPerConv,
      impressions: paid.impressions,
      clicks: paid.clicks,
      ctr: paid.ctr,
    },
  });
  if (!texto) return { error: "No se pudo generar la lectura. Reintentá en un rato." };

  const { error } = await admin.from("client_monthly_reports").upsert(
    {
      cliente_id: clienteId,
      year_month: mes,
      ai_resultados: texto,
      ai_resultados_at: new Date().toISOString(),
      created_by_id: me.id,
    },
    { onConflict: "cliente_id,year_month" }
  );
  if (error) return { error: error.message };
  revalidatePath(`/reporte/cliente/${clienteId}`);
  return { ok: true, texto };
}

/** Actualiza el link público de una publicación. */
export async function setPublicationLink(publicationId: string, link: string | null) {
  const me = await requireUser();
  const supabase = createClient();
  // Resolvemos a qué cliente pertenece la pub para autorizar staff o CM/responsable.
  const { data: pub } = await supabase
    .from("publications")
    .select("cliente_id")
    .eq("id", publicationId)
    .maybeSingle();
  if (!pub?.cliente_id) return { error: "Publicación no encontrada." };
  if (!(await canEditClientReport(supabase, me.id, me.rol, pub.cliente_id))) {
    return { error: "No tenés permiso para editar." };
  }
  const clean = link?.trim() || null;
  const { data, error } = await createAdmin()
    .from("publications")
    .update({ link_publicacion: clean })
    .eq("id", publicationId)
    .select("cliente_id")
    .single();
  if (error) return { error: error.message };
  if (data?.cliente_id) {
    revalidatePath(`/reporte/cliente/${data.cliente_id}`);
    revalidatePath(`/clientes/${data.cliente_id}/calendario`);
  }
  return { ok: true };
}
