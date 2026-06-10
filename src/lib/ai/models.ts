/**
 * Modelos de IA centralizados (Anthropic / Claude). Cambiar acá impacta a toda la app.
 *
 * - SMART (Sonnet 4.6): contenido estratégico que ve el cliente —
 *   diagnósticos, plan mensual, contratos, director creativo, guías/mensajes de meet.
 * - FAST (Haiku 4.5): alto volumen y tareas simples — chats internos,
 *   resúmenes de documentos, acciones de contenido. ~3× más barato que Sonnet.
 *
 * Precios (por millón de tokens, in/out): Sonnet 4.6 = $3/$15 · Haiku 4.5 = $1/$5.
 */
export const AI_MODEL_SMART = "claude-sonnet-4-6";
export const AI_MODEL_FAST = "claude-haiku-4-5";
