"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { currentPeriod } from "@/lib/finanzas";
import { friendlyAiError } from "@/lib/ai/errors";
import {
  buildFinancialSnapshot,
  generateFinancialAdvice,
} from "@/lib/finanzas/advisor";

/**
 * Genera (o regenera) el análisis financiero del período con IA y lo guarda en
 * financial_advice. Solo admin (información estratégica/privada). Devuelve ok.
 */
export async function analyzeFinances(period?: string) {
  const me = await requireUser();
  if (me.rol !== "admin") return { error: "Solo el admin puede generar el análisis." };

  const p = period && /^\d{4}-\d{2}$/.test(period) ? period : currentPeriod();
  const admin = createAdmin();
  const rates = await getExchangeRates();

  const snapshot = await buildFinancialSnapshot(admin, p, rates);

  let advice;
  try {
    advice = await generateFinancialAdvice(snapshot);
  } catch (e) {
    console.error("generateFinancialAdvice:", e);
    return { error: friendlyAiError(e) };
  }
  if (!advice) return { error: "La IA no devolvió un análisis válido. Probá de nuevo." };

  const { error } = await admin.from("financial_advice").upsert(
    {
      periodo: p,
      score: advice.score,
      estado: advice.estado,
      fortalezas: advice.fortalezas,
      riesgos: advice.riesgos,
      recomendaciones: advice.recomendaciones,
      snapshot,
      generado_por: me.id,
      generado_at: new Date().toISOString(),
    },
    { onConflict: "periodo" }
  );
  if (error) {
    if ((error as { code?: string }).code === "42P01")
      return { error: "Falta aplicar la migración 0102." };
    return { error: error.message };
  }

  revalidatePath("/finanzas");
  return { ok: true as const };
}
