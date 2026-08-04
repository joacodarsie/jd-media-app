/**
 * Informe mensual PARA EL CLIENTE.
 *
 * Se genera a partir del diagnóstico interno del mes, pero es otro documento:
 * el cliente lo lee, así que no puede tener riesgo de churn, oportunidades de
 * venta ni sus frustraciones catalogadas por gravedad. La regla es que todo lo
 * que diga sea verdad, pero contado desde el trabajo que estamos haciendo.
 */

import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { normalizeClientReport, type ClientMonthlyReport, type MonthlyDiagnosticContent } from "./schema";
import type { MeetingContext } from "./context";

export const CLIENT_REPORT_MODEL = AI_MODEL_SMART;

const anthropic = new Anthropic();

const SYSTEM = `Sos quien escribe los informes mensuales de JD Media, agencia de marketing digital de Córdoba, Argentina. Escribís el informe que le llega AL CLIENTE después de la reunión de cierre de mes.

# Quién lo lee
El dueño o la dueña de una PyME. No es marketinero: no entiende (ni le importa) "engagement rate" o "CTR". Le importa si su negocio está mejor y si nosotros estamos haciendo bien nuestro trabajo.

# Qué tiene que sentir al leerlo
1. Que lo escuchamos de verdad en la reunión.
2. Que entendemos su negocio, no solo su Instagram.
3. Que hay un plan para el mes que viene, no improvisación.

# Reglas duras
- **Todo lo que digas tiene que ser verdad.** Salís del diagnóstico interno que te paso. No inventes logros, números ni promesas.
- **Nada interno.** Está PROHIBIDO mencionar: riesgo de perder la cuenta, oportunidades de venta o upsell, "frustraciones" como categoría, lo que aprendimos nosotros como agencia, o cualquier lectura sobre él como cliente.
- **Los reclamos se devuelven en positivo, no se esconden.** Si se quejó de los tiempos de entrega, en \`te_escuchamos\` va "Nos dijiste que necesitás el contenido con más anticipación" y en \`proximo_mes\` va qué vamos a hacer al respecto. Nunca lo tapes: que vea que lo tomamos.
- **Si el mes fue flojo, se dice.** Sin dramatizar y siempre seguido de qué vamos a cambiar. Un informe que solo felicita no sirve a nadie y se nota.
- **Números en criollo.** "Te vieron 12.400 personas" mejor que "alcance: 12.400". Si no hay números confiables, \`numeros\` va vacío. NUNCA inventes una cifra.
- **Español rioplatense, de vos, cálido y directo.** Como le hablás a un cliente que ya conocés. Sin corporativismo, sin "en JD Media creemos que", sin emojis.
- **Corto.** Se lee en dos minutos. Cada \`detalle\` de dos o tres oraciones como mucho.

# Cómo llenar cada campo
- **titular**: una frase que resuma el mes en lenguaje de marca. No un título genérico tipo "Informe de julio". Ej: "El mes en que empezamos a mostrar la cara detrás del negocio".
- **apertura**: 2-3 frases. Arrancá por lo concreto del mes, no por saludos de relleno.
- **numeros**: hasta 4. \`valor\` es la cifra ("12.400"), \`etiqueta\` qué es en criollo ("personas que vieron tu contenido"), \`detalle\` opcional para la comparación ("2.100 más que el mes pasado"). Solo con datos reales.
- **logros**: 2-4. Qué se logró y por qué importa para su negocio.
- **aprendimos**: 2-3. Qué descubrimos sobre lo que funciona en SU marca. Esto le muestra que hay una estrategia viva atrás.
- **te_escuchamos**: lo que planteó en la reunión, en sus términos, redactado en segunda persona. Es la sección que hace que sienta que la reunión sirvió.
- **proximo_mes**: 3-5. Qué vamos a hacer, en concreto. Si algo responde a un planteo suyo, que se note la conexión.
- **cierre**: 1-2 frases. Cálido, sin promesas que no podemos cumplir.

# Tu output
Llamás a la tool \`save_client_report\`. Nada de texto fuera de la tool call.`;

const TOOL = {
  name: "save_client_report",
  description: "Guarda el informe mensual redactado para el cliente.",
  input_schema: {
    type: "object" as const,
    properties: {
      titular: { type: "string", description: "Frase que resume el mes, en lenguaje de marca." },
      apertura: { type: "string", description: "2-3 frases de apertura." },
      numeros: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            valor: { type: "string", description: "La cifra. Ej: '12.400'" },
            etiqueta: { type: "string", description: "Qué es, en criollo." },
            detalle: { type: "string", description: "Comparación con el mes anterior. Opcional." },
          },
          required: ["valor", "etiqueta"],
        },
      },
      logros: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: { titulo: { type: "string" }, detalle: { type: "string" } },
          required: ["titulo", "detalle"],
        },
      },
      aprendimos: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: { titulo: { type: "string" }, detalle: { type: "string" } },
          required: ["titulo", "detalle"],
        },
      },
      te_escuchamos: {
        type: "array",
        items: { type: "string" },
        description: "Lo que planteó en la reunión, en segunda persona.",
      },
      proximo_mes: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: { titulo: { type: "string" }, detalle: { type: "string" } },
          required: ["titulo", "detalle"],
        },
      },
      cierre: { type: "string", description: "1-2 frases de cierre." },
    },
    required: [
      "titular",
      "apertura",
      "numeros",
      "logros",
      "aprendimos",
      "te_escuchamos",
      "proximo_mes",
      "cierre",
    ],
  },
};

function buildUserMessage(
  ctx: MeetingContext,
  diagnostico: MonthlyDiagnosticContent
): string {
  const d = diagnostico;
  const lines: string[] = [];

  lines.push(`# Cliente`);
  lines.push(`Nombre: ${ctx.clienteNombre}`);
  if (ctx.rubro) lines.push(`Rubro: ${ctx.rubro}`);
  lines.push(`Mes del informe: ${ctx.mesLabel}`);
  lines.push("");

  if (ctx.metricas) {
    lines.push(`# Números reales del mes`);
    lines.push(`Solo de acá pueden salir las cifras del informe. Si algo no está, no existe.`);
    lines.push("");
    lines.push(ctx.metricas);
    lines.push("");
  }

  lines.push(`# Diagnóstico interno del mes (la fuente de verdad)`);
  lines.push(
    `OJO: esto es interno. Usalo como materia prima, pero NO se lo cuentes tal cual. Traducilo.`
  );
  lines.push("");

  if (d.resumen.length) {
    lines.push(`Resumen del mes:`);
    for (const b of d.resumen) lines.push(`- ${b}`);
  }
  if (d.negocio_del_cliente.como_le_fue) {
    lines.push(`Cómo le fue al negocio: ${d.negocio_del_cliente.como_le_fue}`);
  }
  if (d.negocio_del_cliente.hitos.length) {
    lines.push(`Hitos del mes: ${d.negocio_del_cliente.hitos.join(" · ")}`);
  }
  if (d.negocio_del_cliente.lo_que_se_viene.length) {
    lines.push(`Lo que se le viene: ${d.negocio_del_cliente.lo_que_se_viene.join(" · ")}`);
  }
  if (d.funciono.length) {
    lines.push(`Funcionó:`);
    for (const p of d.funciono) lines.push(`- ${p.que} — ${p.por_que}`);
  }
  if (d.no_funciono.length) {
    lines.push(`No funcionó (decilo con honestidad y seguido de qué cambiamos):`);
    for (const p of d.no_funciono) lines.push(`- ${p.que} — ${p.por_que}`);
  }
  if (d.frustraciones.length) {
    lines.push(
      `Lo que planteó y le molestó (va a "te_escuchamos" en SUS términos y en positivo, y la respuesta a "proximo_mes"):`
    );
    for (const f of d.frustraciones) lines.push(`- ${f.titulo}: ${f.detalle}`);
  }
  if (d.necesidades.length) {
    lines.push(`Lo que necesita (sin mencionar nunca que puede ser venta):`);
    for (const n of d.necesidades) lines.push(`- ${n.titulo}: ${n.detalle}`);
  }
  if (d.publico_objetivo.hubo_cambio) {
    lines.push(`Cambió el público al que le hablamos: ${d.publico_objetivo.detalle}`);
  }
  if (d.ajustes_estrategia.length) {
    lines.push(`Ajustes que hicimos a la estrategia:`);
    for (const p of d.ajustes_estrategia) lines.push(`- ${p.que} — ${p.por_que}`);
  }
  if (d.acciones_proximo_mes.length) {
    lines.push(`Acciones comprometidas para el mes que viene:`);
    for (const a of d.acciones_proximo_mes) lines.push(`- ${a.titulo}: ${a.descripcion}`);
  }
  lines.push("");

  lines.push(
    `# Tu tarea
Escribí el informe de ${ctx.mesLabel} para ${ctx.clienteNombre} llamando a save_client_report. Recordá: nada de riesgo de churn, nada de oportunidades de venta, nada de "aprendimos nosotros como agencia". Solo lo que le sirve a él.`
  );

  return lines.join("\n");
}

/**
 * Genera el informe del cliente. Devuelve null si la IA falla — el diagnóstico
 * interno ya se guardó, así que fallar acá no debe romper nada.
 */
export async function generateClientReport(
  ctx: MeetingContext,
  diagnostico: MonthlyDiagnosticContent
): Promise<ClientMonthlyReport | null> {
  try {
    const msg = await anthropic.messages.create({
      model: CLIENT_REPORT_MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "save_client_report" },
      messages: [{ role: "user", content: buildUserMessage(ctx, diagnostico) }],
    });
    void trackAiUsage({
      ruta: "reunion-mensual/informe-cliente",
      modelo: CLIENT_REPORT_MODEL,
      usage: msg.usage,
    });

    const block = msg.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!block) return null;

    const report = normalizeClientReport(block.input);
    // Un informe sin logros ni plan no sirve para mandar.
    if (report.logros.length === 0 && report.proximo_mes.length === 0) return null;
    return report;
  } catch (err) {
    console.error("[reunion-mensual/informe-cliente] error", err);
    return null;
  }
}
