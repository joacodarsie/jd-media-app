"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { friendlyAiError } from "@/lib/ai/errors";
import { computeAccountHealth } from "@/lib/director/health";
import { periodLabel } from "@/lib/finanzas";

const aiClient = new Anthropic();

const HEALTH_SYSTEM = `Sos el Director de JD Media (agencia de Córdoba, Argentina: gestión de redes, paid media, diseño y web para PyMEs).

Preparás un parte de seguimiento para la reunión quincenal de coordinación (Joaquín con Luz y Brisa). Te paso el estado de salud de CADA cuenta activa, con datos reales: cumplimiento del plan de contenido (piezas publicadas vs la cuota del pack), crecimiento de seguidores en Instagram, y tareas vencidas. Cada cuenta trae un semáforo (bien / regular / mal) y señales concretas.

Escribí un informe claro y accionable en MARKDOWN, para compartir pantalla en la reunión:
1. Un párrafo de arranque: cómo venimos a nivel general (cuántas bien/regular/mal).
2. **Cuentas para atender YA** (las "mal" y las "regular" más flojas): por cada una, en una o dos líneas, qué pasa y la acción concreta para prevenir o solucionar.
3. **Cuentas que van bien**: mencionalas brevemente; si ves una oportunidad de crecimiento o upsell, decila.
4. Cierre con 1-3 focos para las próximas 2 semanas.

NO inventes datos, usá solo lo que te paso. Conciso y concreto, tono profesional y directo, criollo argentino. Sin emojis raros.`;

/**
 * Resumen del Director con IA sobre la SALUD de las cuentas (del 1° a hoy).
 * Texto listo para la reunión quincenal. Efímero (no se guarda). Degrada con un
 * mensaje amable si la IA no está disponible.
 */
export async function generateDirectorSummary() {
  await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const { periodo, cuentas, resumen } = await computeAccountHealth(admin);
  if (cuentas.length === 0) return { ok: true, texto: "No hay cuentas activas para analizar." };

  const lineas = cuentas.map((c) => {
    const partes = [
      `semáforo ${c.semaforo}`,
      c.planMeta > 0 ? `plan ${c.planHechas}/${c.planMeta}` : "sin cuota fija",
      c.igConectado && c.igDelta != null
        ? `IG ${c.igDelta >= 0 ? "+" : ""}${c.igDelta} seguidores`
        : "IG sin datos",
      `${c.tareasVencidas} tareas vencidas`,
    ];
    const señales = [...c.alertas, ...c.buenas];
    return `- ${c.nombre} (${c.pack ?? "s/pack"}): ${partes.join(" · ")}${señales.length ? ` — ${señales.join("; ")}` : ""}`;
  });

  const userMsg = `Período: ${periodLabel(periodo)} (del 1° a hoy).
Resumen: ${resumen.bien} bien, ${resumen.regular} regular, ${resumen.mal} mal (de ${resumen.total} cuentas).

Estado por cuenta (peor primero):
${lineas.join("\n")}

Armá el parte de seguimiento para la reunión.`;

  try {
    const res = await aiClient.messages.create({
      model: AI_MODEL_SMART,
      max_tokens: 2000,
      system: HEALTH_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    const texto = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { ok: true, texto };
  } catch (e) {
    console.error("generateDirectorSummary error:", e);
    return { error: friendlyAiError(e) };
  }
}
