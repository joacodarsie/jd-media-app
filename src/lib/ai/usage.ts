/**
 * Registro del consumo de IA. Cada llamada a Claude deja una fila en `ai_usage`
 * con los tokens y el costo estimado, para poder ver en qué se va la plata de la
 * IA y decidir con datos qué modelo conviene en cada función.
 *
 * Reglas: NUNCA rompe la operación. Si falla el registro (o falta la migración
 * 0134), se loguea y se sigue: es telemetría, no puede tirar abajo una feature.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { AI_MODEL_FAST, AI_MODEL_SMART } from "./models";

/** Precio por MILLÓN de tokens (USD), según la tabla pública de Anthropic. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  [AI_MODEL_SMART]: { input: 3, output: 15, cacheRead: 0.3 },
  [AI_MODEL_FAST]: { input: 1, output: 5, cacheRead: 0.1 },
};
// Si aparece un modelo nuevo sin precio cargado, asumimos el caro para no
// subestimar el gasto.
const FALLBACK = { input: 3, output: 15, cacheRead: 0.3 };

export interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function estimateCostUsd(modelo: string, usage: UsageLike): number {
  const p = PRICES[modelo] ?? FALLBACK;
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  // Los tokens de creación de caché se cobran como input (con recargo ~25%).
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cost =
    (inTok * p.input +
      outTok * p.output +
      cacheRead * p.cacheRead +
      cacheWrite * p.input * 1.25) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Registra el consumo de una llamada. Pensado para llamarse SIN await
 * (`void trackAiUsage(...)`): no debe demorar la respuesta al usuario.
 */
export async function trackAiUsage(opts: {
  ruta: string;
  modelo: string;
  usage: UsageLike | null | undefined;
  userId?: string | null;
}): Promise<void> {
  try {
    if (!opts.usage) return;
    const costo = estimateCostUsd(opts.modelo, opts.usage);
    const admin = createAdmin();
    const { error } = await admin.from("ai_usage").insert({
      ruta: opts.ruta.slice(0, 120),
      modelo: opts.modelo.slice(0, 80),
      user_id: opts.userId ?? null,
      input_tokens: opts.usage.input_tokens ?? 0,
      output_tokens: opts.usage.output_tokens ?? 0,
      cache_read_tokens: opts.usage.cache_read_input_tokens ?? 0,
      costo_usd: costo,
    });
    // 42P01 = falta la migración 0134: no es un problema real, se ignora.
    if (error && (error as { code?: string }).code !== "42P01")
      console.warn("trackAiUsage:", error.message);
  } catch (e) {
    console.warn("trackAiUsage:", (e as Error).message);
  }
}
