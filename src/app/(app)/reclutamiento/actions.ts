"use server";

import { revalidatePath } from "next/cache";
import { requireUser, isStaffUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

async function ctx() {
  const me = await requireUser();
  if (!isStaffUser(me)) throw new Error("Sin acceso.");
  return { me, admin: createAdmin() };
}

export interface SearchInput {
  titulo: string;
  area: string | null;
  perfil: string | null;
  ubicacion_pref: string | null;
}

export async function createSearch(
  input: SearchInput
): Promise<{ ok: true; id: string } | { error: string }> {
  const { me, admin } = await ctx();
  if (!input.titulo.trim()) return { error: "Poné un título para la búsqueda." };
  const { data, error } = await admin
    .from("recruitment_searches")
    .insert({
      titulo: input.titulo.trim(),
      area: input.area,
      perfil: input.perfil?.trim() || null,
      ubicacion_pref: input.ubicacion_pref?.trim() || "Córdoba Capital",
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  return { ok: true, id: data.id as string };
}

export async function updateSearch(
  id: string,
  input: SearchInput
): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin
    .from("recruitment_searches")
    .update({
      titulo: input.titulo.trim(),
      area: input.area,
      perfil: input.perfil?.trim() || null,
      ubicacion_pref: input.ubicacion_pref?.trim() || "Córdoba Capital",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  revalidatePath(`/reclutamiento/${id}`);
  return { ok: true };
}

export async function setSearchEstado(
  id: string,
  estado: "abierta" | "cerrada"
): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin
    .from("recruitment_searches")
    .update({ estado })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  revalidatePath(`/reclutamiento/${id}`);
  return { ok: true };
}

export async function deleteSearch(id: string): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin.from("recruitment_searches").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  return { ok: true };
}

export async function deleteCandidate(
  id: string,
  searchId: string
): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin.from("recruitment_candidates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/reclutamiento/${searchId}`);
  return { ok: true };
}

// ── Pipeline de selección (fases + entrevistas) ─────────────────────

export type CandidateFase =
  | "pool"
  | "entrevista"
  | "segunda"
  | "prueba"
  | "contratado"
  | "descartado";

/** Mueve un candidato a otra fase del proceso. */
export async function setCandidateFase(
  candidateId: string,
  fase: CandidateFase
): Promise<{ ok: true } | { error: string }> {
  const { admin } = await ctx();
  const { error } = await admin
    .from("recruitment_candidates")
    .update({ fase, fase_updated_at: new Date().toISOString() })
    .eq("id", candidateId);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  return { ok: true };
}

/**
 * Guarda la transcripción/notas de la entrevista de un candidato y genera un
 * análisis corto con IA (fortalezas, dudas, recomendación) que queda guardado.
 */
export async function saveInterview(input: {
  candidateId: string;
  transcript?: string;
  notas?: string;
}): Promise<{ ok: true; analisis?: string } | { error: string }> {
  const { admin } = await ctx();
  const patch: Record<string, unknown> = {};
  if (input.transcript !== undefined) patch.entrevista_transcript = input.transcript.trim() || null;
  if (input.notas !== undefined) patch.entrevista_notas = input.notas.trim() || null;

  let analisis: string | undefined;
  const transcript = (input.transcript ?? "").trim();
  if (transcript.length > 200 && process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const { AI_MODEL_FAST } = await import("@/lib/ai/models");
      const { data: cand } = await admin
        .from("recruitment_candidates")
        .select("nombre, area, resumen, fit_score, search:recruitment_searches(titulo, perfil)")
        .eq("id", input.candidateId)
        .single();
      const c = cand as {
        nombre: string | null;
        area: string | null;
        resumen: string | null;
        search: { titulo: string; perfil: string | null } | null;
      } | null;
      const client = new Anthropic();
      const res = await client.messages.create({
        model: AI_MODEL_FAST,
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: `Sos el analista de RR.HH. de JD Media (agencia de marketing de Córdoba). Analizá esta entrevista para el puesto "${c?.search?.titulo ?? c?.area ?? "?"}"${c?.search?.perfil ? ` (perfil buscado: ${c.search.perfil})` : ""}.\n\nCandidato: ${c?.nombre ?? "?"}${c?.resumen ? `\nResumen del CV: ${c.resumen}` : ""}\n\nTranscripción:\n${transcript.slice(0, 45000)}\n\nDevolvé en español rioplatense, conciso:\n✅ Fortalezas (3-4 bullets)\n⚠️ Dudas / a validar (2-3 bullets)\n💵 Expectativa económica y disponibilidad (si se habló)\n🎯 Veredicto: AVANZAR / AVANZAR CON DUDAS / NO AVANZAR + 1 línea de por qué.\nSin introducción ni cierre.`,
          },
        ],
      });
      analisis = res.content
        .filter((b) => b.type === "text")
        .map((b) => ("text" in b ? b.text : ""))
        .join("\n")
        .trim();
      if (analisis) patch.entrevista_analisis = analisis;
    } catch (e) {
      console.error("[reclutamiento] analisis entrevista", e);
    }
  }

  const { error } = await admin
    .from("recruitment_candidates")
    .update(patch)
    .eq("id", input.candidateId);
  if (error) return { error: error.message };
  revalidatePath("/reclutamiento");
  return { ok: true, analisis };
}

/**
 * Miniguía de entrevista para una búsqueda: qué contar, qué preguntar, tarifas
 * a mencionar y red flags del puesto. Se genera con IA y NO se guarda (es un
 * machete para leer antes de entrar al meet).
 */
export async function generateInterviewGuide(
  searchId: string
): Promise<{ ok: true; guide: string } | { error: string }> {
  const { admin } = await ctx();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "Falta ANTHROPIC_API_KEY." };
  const { data: search } = await admin
    .from("recruitment_searches")
    .select("titulo, area, perfil")
    .eq("id", searchId)
    .single();
  const s = search as { titulo: string; area: string | null; perfil: string | null } | null;
  if (!s) return { error: "Búsqueda no encontrada." };

  const { data: settingsRow } = await admin
    .from("agency_settings")
    .select("rates, packs")
    .eq("id", 1)
    .maybeSingle();
  const { mergeSettings } = await import("@/lib/coordinacion");
  const st = mergeSettings(settingsRow);

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const { AI_MODEL_FAST } = await import("@/lib/ai/models");
  const client = new Anthropic();
  const res = await client.messages.create({
    model: AI_MODEL_FAST,
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `Armá una MINIGUÍA de entrevista (para leer en 2 minutos antes del meet) para el dueño de JD Media, agencia de marketing de Córdoba (~15 cuentas activas, equipos por cuenta: CM + diseñador + editor + paid media, plataforma propia con calendario y tareas, trabajo 100% remoto freelance, se paga por producción cargada en la plataforma).\n\nPuesto buscado: ${s.titulo}${s.area ? ` (área ${s.area})` : ""}${s.perfil ? `\nPerfil: ${s.perfil}` : ""}\n\nTarifas vigentes para mencionar si aplican: diseño $${st.rates.diseno_pieza}/pieza + portada $${st.rates.portada_reel}; edición $${st.rates.edicion_reel}/reel; CM por pack $${st.rates.cm.Presencia}/$${st.rates.cm.Crecimiento}/$${st.rates.cm.Escala}; paid media ídem CM; manual de marca $${st.rates.manual_marca}.\n\nFormato (español rioplatense, bullets cortos):\n🧩 Estructura del meet (4 pasos, 1 línea c/u)\n💬 5 preguntas CLAVE para este puesto\n💰 Qué decir de pago y modalidad\n🚩 3 red flags específicas del puesto\n✅ Cierre recomendado\nSin introducción ni despedida.`,
      },
    ],
  });
  const guide = res.content
    .filter((b) => b.type === "text")
    .map((b) => ("text" in b ? b.text : ""))
    .join("\n")
    .trim();
  if (!guide) return { error: "No se pudo generar la guía." };
  return { ok: true, guide };
}
