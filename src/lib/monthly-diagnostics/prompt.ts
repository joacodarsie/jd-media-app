/**
 * Prompt para generar el diagnóstico MENSUAL a partir de la transcripción de la
 * reunión de fin de mes con el cliente.
 *
 * Diferencias con el diagnóstico inicial (src/lib/diagnostics/generate-prompt):
 *   - Es interno: puede decir "riesgo de que se vaya" y "acá hay upsell".
 *   - Compara contra el mes anterior (métricas y diagnóstico previo) para poder
 *     marcar lo que se repite: un reclamo que vuelve vale el doble.
 *   - Es corto. Se lee antes de arrancar el mes siguiente, no se imprime.
 */

import { AI_MODEL_SMART } from "@/lib/ai/models";
import type { MonthlyDiagnosticContent } from "./schema";

export const MONTHLY_DIAGNOSTIC_MODEL = AI_MODEL_SMART;

export const MONTHLY_DIAGNOSTIC_SYSTEM_PROMPT = `Sos el **analista de cuentas** de JD Media, agencia de marketing digital de Córdoba, Argentina. Acaba de terminar la reunión mensual con un cliente y tenés la transcripción. Tu trabajo es producir el **diagnóstico del mes** de esa marca.

# Para qué sirve este documento
Es INTERNO — el cliente NO lo ve. Lo lee el equipo antes de planificar el mes siguiente. Sirve para tres cosas:
1. Ver cómo está la marca ESTE mes (no cómo estaba cuando la firmamos).
2. Registrar frustraciones y necesidades del cliente para no volver a tropezar.
3. Aprender: qué formatos/temas funcionan en esta cuenta y qué no.

Como es interno, podés y debés ser franco: si el cliente está caliente, decilo. Si hay riesgo de que se vaya, marcalo. Si hay oportunidad de venderle más servicio, marcala.

# Reglas duras
- **Solo lo que salió de la reunión y de los datos que te paso.** Si el cliente no habló de ventas, \`como_le_fue\` va vacío. NUNCA inventes números, ventas ni frases.
- **Las citas del cliente son textuales.** Copiá la frase como la dijo (limpiando muletillas). Si no hay frase potente, dejá el array vacío. Prohibido parafrasear y presentarlo como cita.
- **Distinguí lo que dice el cliente de lo que interpretás vos.** En \`frustraciones\` va lo que él siente; en \`no_funciono\` va la lectura tuya con los números.
- **Un reclamo repetido es la señal más importante.** Si te paso el diagnóstico del mes anterior y algo vuelve a aparecer, marcá \`ya_venia_del_mes_pasado: true\` y subile la gravedad.
- **Cero relleno.** Si una sección no tiene material real, dejala vacía. Un diagnóstico corto y verdadero vale más que uno largo e inventado.
- **Español rioplatense (vos), directo, sin formalidad acartonada y sin emojis.**

# Cómo llenar cada campo

**semaforo** — la foto de la cuenta ESTE mes:
- "bien": el cliente está conforme y los números acompañan.
- "atencion": hay reclamos concretos, o los números no acompañan, o el cliente está tibio.
- "riesgo": el cliente puso en duda la continuidad, se quejó fuerte, o hay varias señales de churn.

**resumen** — 3-4 bullets. Si el dueño de la agencia lee SOLO esto, tiene que saber cómo viene la cuenta y qué hacer. Cada bullet una oración.

**negocio_del_cliente** — cómo le fue AL NEGOCIO, no a nuestras métricas. Ventas, consultas, temporada, si abrió un local, si lanzó un producto. \`lo_que_se_viene\` es lo que tenemos que acompañar el mes que viene (un lanzamiento, una fecha comercial, un viaje).

**funciono / no_funciono** — tu lectura, cruzando lo que dijo el cliente con las métricas. El campo \`por_que\` es una hipótesis explicativa, no una repetición del \`que\`.
❌ MAL: que "Los reels anduvieron bien" / por_que "Tuvieron buen alcance".
✅ BIEN: que "Los reels con la dueña hablando a cámara" / por_que "Son los únicos con cara humana; la cuenta venía siendo puro producto y la gente responde a la persona detrás".

**frustraciones** — lo que le molesta al cliente, dicho o entre líneas. Un "no, está bien igual" después de un silencio es una frustración. Gravedad alta si condiciona la relación.

**necesidades** — lo que pidió o lo que claramente necesita aunque no lo pida. \`oportunidad_venta: true\` solo cuando la necesidad se resuelve con más servicio del que hoy tiene contratado (más pauta, producción, diseño, web).

**publico_objetivo** — pregunta clave: ¿la marca sigue apuntándole a la misma gente? Si el cliente dijo que ahora le venden a otro segmento, que abrió un canal nuevo o que el que compra no es el que él creía, \`hubo_cambio: true\` y explicalo. Si no se tocó el tema, \`hubo_cambio: false\` y repetí en \`publico_actual\` el que ya teníamos.

**aprendizajes** — qué aprendimos NOSOTROS de esta cuenta. Sirve para el equipo y para otras cuentas del mismo rubro. Ej: "En gastronomía de esta zona, los posteos de menú del día rinden más que los de ambiente".

**ajustes_estrategia** — qué cambiamos concretamente a partir de todo lo anterior. \`que\` = el cambio, \`por_que\` = qué lo justifica.

**riesgo** — nivel de riesgo de perder la cuenta y las señales concretas que lo sostienen (frases, reclamos repetidos, cortes de pago, silencios). Si el nivel no es "bajo", las señales no pueden estar vacías.

**acciones_proximo_mes** — 4-8 acciones ejecutables por una persona en una semana, en imperativo, con el área correcta. Estas se convierten en tareas reales con un botón, así que tienen que ser concretas.
Áreas válidas: "diseno" | "community" | "produccion" | "paid" | "estrategia" | "desarrollo" | "otro"

**citas_del_cliente** — 2-5 frases textuales. Las que más información tienen sobre lo que valora, lo que le duele o hacia dónde va el negocio.

# Tu output
Llamás a la tool \`save_monthly_diagnostic\` con el JSON estructurado. NO escribas texto fuera de la tool call.
Los campos anidados (\`negocio_del_cliente\`, \`publico_objetivo\`, \`riesgo\`) son OBJETOS, no strings con JSON adentro. Los arrays son arrays nativos. Nunca serialices a string.`;

/**
 * Tool schema — espejo de MonthlyDiagnosticContent.
 */
export const SAVE_MONTHLY_DIAGNOSTIC_TOOL = {
  name: "save_monthly_diagnostic",
  description:
    "Guarda el diagnóstico mensual interno del cliente a partir de la reunión de fin de mes.",
  input_schema: {
    type: "object" as const,
    properties: {
      semaforo: {
        type: "string",
        enum: ["bien", "atencion", "riesgo"],
        description: "Estado general de la cuenta este mes.",
      },
      resumen: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 4,
        description: "3-4 bullets con lo esencial del mes.",
      },
      negocio_del_cliente: {
        type: "object",
        properties: {
          como_le_fue: {
            type: "string",
            description:
              "Cómo le fue al NEGOCIO del cliente (ventas, consultas, facturación). Vacío si no lo mencionó.",
          },
          hitos: {
            type: "array",
            items: { type: "string" },
            description: "Hechos del mes: lanzamientos, aperturas, temporada, problemas.",
          },
          lo_que_se_viene: {
            type: "array",
            items: { type: "string" },
            description: "Lo que viene el mes próximo y tenemos que acompañar.",
          },
        },
        required: ["como_le_fue", "hitos", "lo_que_se_viene"],
      },
      funciono: {
        type: "array",
        items: {
          type: "object",
          properties: {
            que: { type: "string" },
            por_que: { type: "string", description: "Hipótesis de por qué funcionó." },
          },
          required: ["que", "por_que"],
        },
      },
      no_funciono: {
        type: "array",
        items: {
          type: "object",
          properties: {
            que: { type: "string" },
            por_que: { type: "string", description: "Hipótesis de por qué no funcionó." },
          },
          required: ["que", "por_que"],
        },
      },
      frustraciones: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            detalle: { type: "string" },
            gravedad: { type: "string", enum: ["alta", "media", "baja"] },
            ya_venia_del_mes_pasado: {
              type: "boolean",
              description:
                "true si esto ya aparecía en el diagnóstico del mes anterior que te pasé.",
            },
          },
          required: ["titulo", "detalle", "gravedad"],
        },
      },
      necesidades: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            detalle: { type: "string" },
            area_sugerida: {
              type: "string",
              enum: [
                "diseno",
                "community",
                "produccion",
                "paid",
                "estrategia",
                "desarrollo",
                "otro",
              ],
            },
            oportunidad_venta: {
              type: "boolean",
              description: "true si se resuelve con más servicio del que hoy tiene.",
            },
          },
          required: ["titulo", "detalle", "area_sugerida"],
        },
      },
      publico_objetivo: {
        type: "object",
        properties: {
          hubo_cambio: { type: "boolean" },
          detalle: { type: "string", description: "Qué cambió y por qué. Vacío si no hubo cambio." },
          publico_actual: {
            type: "string",
            description: "A quién le habla la marca de acá en adelante.",
          },
        },
        required: ["hubo_cambio", "detalle", "publico_actual"],
      },
      aprendizajes: {
        type: "array",
        items: { type: "string" },
        description: "Qué aprendimos nosotros de esta cuenta este mes.",
      },
      ajustes_estrategia: {
        type: "array",
        items: {
          type: "object",
          properties: {
            que: { type: "string", description: "El cambio concreto." },
            por_que: { type: "string", description: "Qué lo justifica." },
          },
          required: ["que", "por_que"],
        },
      },
      riesgo: {
        type: "object",
        properties: {
          nivel: { type: "string", enum: ["alto", "medio", "bajo"] },
          señales: {
            type: "array",
            items: { type: "string" },
            description: "Señales concretas. Obligatorio si el nivel no es bajo.",
          },
        },
        required: ["nivel", "señales"],
      },
      acciones_proximo_mes: {
        type: "array",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Imperativo, corto." },
            descripcion: { type: "string" },
            area_sugerida: {
              type: "string",
              enum: [
                "diseno",
                "community",
                "produccion",
                "paid",
                "estrategia",
                "desarrollo",
                "otro",
              ],
            },
            prioridad: { type: "string", enum: ["alta", "media", "baja"] },
          },
          required: ["titulo", "descripcion", "area_sugerida", "prioridad"],
        },
      },
      citas_del_cliente: {
        type: "array",
        items: { type: "string" },
        maxItems: 5,
        description: "Frases TEXTUALES del cliente. Vacío si no hay ninguna potente.",
      },
    },
    required: [
      "semaforo",
      "resumen",
      "negocio_del_cliente",
      "funciono",
      "no_funciono",
      "frustraciones",
      "necesidades",
      "publico_objetivo",
      "aprendizajes",
      "ajustes_estrategia",
      "riesgo",
      "acciones_proximo_mes",
      "citas_del_cliente",
    ],
  },
};

/** Contexto que la sección arma antes de llamar al modelo. */
export interface MonthlyDiagnosticContext {
  clienteNombre: string;
  rubro?: string | null;
  pack?: string | null;
  serviciosContratados?: string[];
  mesLabel: string;
  /** Bloque de texto con las métricas del mes (ya formateado). */
  metricas?: string | null;
  /** Marca / público según el diagnóstico inicial aprobado. */
  contextoMarca?: string | null;
  /** Diagnóstico del mes anterior, resumido a texto. */
  mesAnterior?: string | null;
  /** Transcripción de la reunión. */
  transcript: string;
  /** Notas sueltas que cargó el equipo además de la transcripción. */
  notas?: string | null;
}

export function buildMonthlyDiagnosticUserMessage(ctx: MonthlyDiagnosticContext): string {
  const lines: string[] = [];

  lines.push(`# Cliente`);
  lines.push(`Nombre: ${ctx.clienteNombre}`);
  if (ctx.rubro) lines.push(`Rubro: ${ctx.rubro}`);
  if (ctx.pack) lines.push(`Pack: ${ctx.pack}`);
  if (ctx.serviciosContratados?.length) {
    lines.push(`Servicios contratados: ${ctx.serviciosContratados.join(", ")}`);
  }
  lines.push(`Mes que se está cerrando: ${ctx.mesLabel}`);
  lines.push("");

  if (ctx.contextoMarca) {
    lines.push(`# Lo que ya sabemos de la marca (diagnóstico inicial)`);
    lines.push(ctx.contextoMarca);
    lines.push("");
  }

  if (ctx.mesAnterior) {
    lines.push(`# Diagnóstico del MES ANTERIOR`);
    lines.push(
      `Usalo para detectar lo que se repite. Si una frustración o necesidad vuelve a aparecer, marcala como \`ya_venia_del_mes_pasado\` y subile la gravedad.`
    );
    lines.push("");
    lines.push(ctx.mesAnterior);
    lines.push("");
  }

  if (ctx.metricas) {
    lines.push(`# Números reales del mes`);
    lines.push(
      `Cruzá esto con lo que dijo el cliente. Si él percibe algo distinto a lo que dicen los números, eso es material para el diagnóstico.`
    );
    lines.push("");
    lines.push(ctx.metricas);
    lines.push("");
  }

  lines.push(`# Transcripción de la reunión mensual`);
  lines.push("");
  lines.push(ctx.transcript);
  lines.push("");

  if (ctx.notas?.trim()) {
    lines.push(`# Notas del equipo (lo que no quedó en la transcripción)`);
    lines.push(ctx.notas.trim());
    lines.push("");
  }

  lines.push(
    `# Tu tarea
Generá el diagnóstico de ${ctx.mesLabel} para ${ctx.clienteNombre} llamando a la tool save_monthly_diagnostic. Nada de texto fuera de la tool call.`
  );

  return lines.join("\n");
}

/**
 * Resume un diagnóstico mensual a texto plano, para pasárselo al modelo como
 * "mes anterior" (y para que el guión de la reunión sepa qué quedó pendiente).
 */
export function monthlyDiagnosticToText(
  periodoLabel: string,
  c: MonthlyDiagnosticContent
): string {
  const lines: string[] = [`## ${periodoLabel}`, `Estado: ${c.semaforo}`];

  if (c.resumen.length) {
    lines.push("Resumen:");
    for (const b of c.resumen) lines.push(`- ${b}`);
  }
  if (c.frustraciones.length) {
    lines.push("Frustraciones que planteó:");
    for (const f of c.frustraciones) lines.push(`- [${f.gravedad}] ${f.titulo}: ${f.detalle}`);
  }
  if (c.necesidades.length) {
    lines.push("Necesidades:");
    for (const n of c.necesidades) lines.push(`- ${n.titulo}: ${n.detalle}`);
  }
  if (c.funciono.length) {
    lines.push("Funcionó:");
    for (const p of c.funciono) lines.push(`- ${p.que} (${p.por_que})`);
  }
  if (c.no_funciono.length) {
    lines.push("No funcionó:");
    for (const p of c.no_funciono) lines.push(`- ${p.que} (${p.por_que})`);
  }
  if (c.publico_objetivo.hubo_cambio) {
    lines.push(`Cambio de público: ${c.publico_objetivo.detalle}`);
  }
  if (c.publico_objetivo.publico_actual) {
    lines.push(`Público al que apuntamos: ${c.publico_objetivo.publico_actual}`);
  }
  if (c.acciones_proximo_mes.length) {
    lines.push("Acciones que nos comprometimos a hacer este mes:");
    for (const a of c.acciones_proximo_mes) lines.push(`- [${a.prioridad}] ${a.titulo}`);
  }
  if (c.riesgo.nivel !== "bajo") {
    lines.push(`Riesgo de perder la cuenta: ${c.riesgo.nivel}`);
    for (const s of c.riesgo.señales) lines.push(`- ${s}`);
  }
  return lines.join("\n");
}
