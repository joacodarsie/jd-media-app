"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AIFeedbackInput {
  feature: string;
  rating: 1 | -1;
  refId?: string | null;
  clienteId?: string | null;
  model?: string | null;
  comentario?: string | null;
}

export async function submitAIFeedback(input: AIFeedbackInput) {
  const me = await requireUser();
  if (input.rating !== 1 && input.rating !== -1) {
    return { error: "Rating inválido" };
  }
  if (!input.feature || input.feature.length > 60) {
    return { error: "Feature inválido" };
  }
  const supabase = createClient();
  const { error } = await supabase.from("ai_generations_feedback").insert({
    feature: input.feature,
    ref_id: input.refId ?? null,
    cliente_id: input.clienteId ?? null,
    model: input.model ?? null,
    rating: input.rating,
    comentario: input.comentario?.trim() || null,
    user_id: me.id,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
