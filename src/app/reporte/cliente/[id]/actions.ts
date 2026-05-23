"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isStaff } from "@/lib/auth";

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

export async function upsertMonthlyReport(input: MonthlyReportInput) {
  const me = await requireUser();
  if (!isStaff(me.rol)) return { error: "Solo staff edita reportes." };
  if (!/^\d{4}-\d{2}$/.test(input.year_month)) {
    return { error: "Mes inválido." };
  }
  const supabase = createClient();
  const payload = clean(input);
  const { error } = await supabase.from("client_monthly_reports").upsert(
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

/** Actualiza el link público de una publicación. */
export async function setPublicationLink(publicationId: string, link: string | null) {
  const me = await requireUser();
  if (!isStaff(me.rol)) return { error: "Solo staff puede editar." };
  const supabase = createClient();
  const clean = link?.trim() || null;
  const { data, error } = await supabase
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
