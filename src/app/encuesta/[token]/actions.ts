"use server";

import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod } from "@/lib/finanzas";
import { AREA_PM } from "@/lib/tareas/puerta";
import { avisoRespuesta } from "@/lib/retencion/encuesta-portal";

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
  await avisarAlEquipo(admin, t.cliente_id, puntaje, input.que_mejorar).catch(() => undefined);
  return { ok: true as const };
}

/**
 * Cuando un cliente contesta, se enteran el dueño y la PM en el momento
 * (19/10/2026): un 3 o menos es la señal más temprana de una baja.
 */
async function avisarAlEquipo(
  admin: ReturnType<typeof createAdmin>,
  clienteId: string,
  puntaje: number,
  queMejorar: string
) {
  const [{ data: cli }, { data: gente }] = await Promise.all([
    admin.from("clients").select("nombre").eq("id", clienteId).maybeSingle(),
    admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true),
  ]);
  const lista = (gente ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const ids = [...new Set(lista.filter((u) => u.rol === "admin" || u.area === AREA_PM || u.area_secundaria === AREA_PM).map((u) => u.id))];
  if (!ids.length) return;
  const mensaje = avisoRespuesta((cli as { nombre?: string } | null)?.nombre ?? "Un cliente", puntaje, queMejorar);
  await admin.from("notifications").insert(
    ids.map((user_id) => ({ user_id, tipo: "recordatorio", mensaje, link: "/clientes/calidad" }))
  );
}
