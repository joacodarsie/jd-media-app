"use server";

import { requireUser, userHas } from "@/lib/auth";
import { generateMeetingFeedback } from "@/lib/comercial/meeting-feedback";
import { friendlyAiError } from "@/lib/ai/errors";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

export async function getMeetingFeedback(
  transcript: string
): Promise<{ ok: true; feedback: string } | { error: string }> {
  const me = await requireUser();
  if (!COMERCIAL_ROLES.includes(me.rol) && !userHas(me, "comercial")) {
    return { error: "No tenés acceso al área comercial." };
  }
  if ((transcript ?? "").trim().length < 80) {
    return { error: "Pegá una transcripción más completa (mínimo unas líneas)." };
  }
  try {
    const feedback = await generateMeetingFeedback(transcript);
    if (!feedback) {
      return {
        error:
          "No se pudo generar el feedback. Revisá que sea la transcripción de una reunión y reintentá.",
      };
    }
    return { ok: true, feedback };
  } catch (e) {
    return { error: friendlyAiError(e) };
  }
}
