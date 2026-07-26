"use server";

import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod } from "@/lib/finanzas";

/**
 * Guarda la respuesta de la encuesta de satisfacción. Es PÚBLICA (el cliente no
 * tiene usuario): la autorización es el token del portal, que se valida acá
 * contra la base antes de escribir nada. Usa service role porque no hay sesión.
 */
export async function submitSatisfaction(input: {
  token: string;
  puntaje: number;
  que_valoran: string;
  que_mejorar: string;
}) {
  const admin = createAdmin();

  const { data: tokenRow } = await admin
    .from("client_portal_tokens")
    .select("cliente_id, revoked_at, expires_at")
    .eq("token", input.token)
    .maybeSingle();
  const t = tokenRow as {
    cliente_id: string;
    revoked_at: string | null;
    expires_at: string | null;
  } | null;
  if (!t || t.revoked_at) return { error: "El link no es válido." };
  if (t.expires_at && new Date(t.expires_at) < new Date())
    return { error: "El link venció. Pedile uno nuevo a tu equipo." };

  const puntaje = Math.round(Number(input.puntaje));
  if (!Number.isFinite(puntaje) || puntaje < 1 || puntaje > 5)
    return { error: "Elegí una puntuación del 1 al 5." };

  const { error } = await admin.from("client_satisfaction").upsert(
    {
      cliente_id: t.cliente_id,
      periodo: currentPeriod(),
      puntaje,
      que_valoran: input.que_valoran.trim().slice(0, 2000) || null,
      que_mejorar: input.que_mejorar.trim().slice(0, 2000) || null,
    },
    { onConflict: "cliente_id,periodo" }
  );
  if (error) {
    if ((error as { code?: string }).code === "42P01")
      return { error: "La encuesta todavía no está habilitada. Avisale a tu equipo." };
    return { error: "No se pudo guardar. Probá de nuevo en un rato." };
  }
  return { ok: true as const };
}
