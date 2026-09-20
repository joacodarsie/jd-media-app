/**
 * El ejecutor de la red de seguridad del onboarding.
 *
 * La decisión de A QUIÉN le falta vive en `onboarding-pendiente.ts` (puro y
 * testeado); acá solo se habla con la base y se llama al armador de siempre,
 * que es idempotente por el título del ticket madre.
 *
 * Corre en el cron diario: si una cuenta nueva aparece por cualquier camino
 * —el alta directa como activa, el pase desde propuesta, un cambio de estado a
 * mano— al día siguiente tiene su arranque armado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { tituloMadre } from "./onboarding-15";
import { runOnboarding15 } from "./onboarding-15-run";
import {
  cuentasSinOnboarding,
  type CuentaParaOnboarding,
} from "./onboarding-pendiente";

export interface ResultadoOnboardingPendiente {
  /** Cuántos arranques se armaron. */
  creados: number;
  /** Nombre de cada cuenta y su número de ticket. */
  detalle: string[];
  /** Cuentas que se intentaron y fallaron, con el motivo. */
  fallidas: string[];
}

export async function runOnboardingPendiente(
  admin: SupabaseClient,
  hoy: string
): Promise<ResultadoOnboardingPendiente> {
  const { data: cRaw } = await admin
    .from("clients")
    .select("id, nombre, estado, es_interno, fecha_inicio")
    .eq("estado", "activo");
  const cuentas = ((cRaw ?? []) as CuentaParaOnboarding[]).map((c) => ({
    ...c,
    fecha_inicio: c.fecha_inicio ? String(c.fecha_inicio).slice(0, 10) : null,
  }));
  if (cuentas.length === 0) return { creados: 0, detalle: [], fallidas: [] };

  // Los títulos que ya existen, de una sola consulta. Incluye archivados a
  // propósito: si alguien archivó el arranque, no se lo volvemos a crear.
  const { data: tRaw } = await admin
    .from("tasks")
    .select("titulo")
    .like("titulo", "Onboarding 15 días — %");
  const titulosExistentes = ((tRaw ?? []) as { titulo: string }[]).map((t) => t.titulo);

  const faltan = cuentasSinOnboarding({ cuentas, titulosExistentes, tituloDe: tituloMadre, hoy });

  const detalle: string[] = [];
  const fallidas: string[] = [];
  for (const c of faltan) {
    try {
      const r = await runOnboarding15(admin, c.id, { fechaInicio: c.fecha_inicio ?? undefined });
      if (r.creado) detalle.push(`${c.nombre} (JD-${r.numero}, ${r.subtareas} pasos)`);
      else if (r.motivo !== "ya_existe") fallidas.push(`${c.nombre}: ${r.motivo ?? "sin motivo"}`);
    } catch (e) {
      fallidas.push(`${c.nombre}: ${e instanceof Error ? e.message : "falló"}`);
    }
  }

  return { creados: detalle.length, detalle, fallidas };
}
