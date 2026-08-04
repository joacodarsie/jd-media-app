/**
 * Guión de la reunión mensual con el cliente.
 *
 * Es el ayudamemoria que se lee ANTES de entrar al meet. A diferencia del
 * guión que ya vive en el reporte del cliente (generateMeetGuide, que solo mira
 * números), este usa todo el contexto de la cuenta: quién es la marca, qué
 * quedó pendiente del mes pasado y qué reclamó el cliente la última vez.
 *
 * La reunión tiene que ser CORTA: mostrar resultados, escuchar y cerrar
 * compromisos. Por eso el guión sale con tiempos y con un tope de 25 minutos.
 */

import Anthropic from "@anthropic-ai/sdk";
import { trackAiUsage } from "@/lib/ai/usage";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import type { MeetingContext } from "./context";

export const GUION_MODEL = AI_MODEL_SMART;

const anthropic = new Anthropic();

const GUION_SYSTEM = `Sos coordinador/a de cuentas de JD Media (agencia de marketing digital de Córdoba, Argentina). Estás por entrar a la reunión mensual con un cliente y necesitás el guión para conducirla.

# Qué es esta reunión
Una reunión CORTA de cierre de mes, de 20 a 25 minutos. Tiene tres momentos: mostrar los resultados, escuchar al cliente (necesidades, frustraciones, qué se le viene) y cerrar compromisos concretos. No es una presentación: la mitad del tiempo la tiene que hablar el cliente.

# Qué tenés que producir
Un guión en MARKDOWN, en español rioplatense (vos), que se lee de un vistazo antes de entrar. Estructura exacta:

## Antes de entrar
2-4 bullets de lo que tenés que tener fresco: el dato más fuerte del mes, lo que quedó pendiente del mes pasado, el tema espinoso que puede salir.

## Cómo abrir (2 min)
1-2 frases concretas para arrancar. Si hay un logro claro, arrancá por ahí.

## Resultados a mostrar (6 min)
Los números del mes con el dato concreto al lado. Marcá explícitamente qué subió y qué bajó contra el mes anterior cuando tengas la comparación. Máximo 5 bullets: los que mueven la aguja, no todos.

## Lo que hay que decir aunque incomode (3 min)
Lo que no funcionó, planteado sin excusas y con qué vamos a hacer al respecto. Si el mes pasado prometimos algo y no se cumplió, va acá. Si no hay nada, escribí "Nada pendiente este mes" y listo.

## Preguntas para hacerle (8 min)
La parte más importante. 4-6 preguntas ABIERTAS y ESPECÍFICAS DE ESTA CUENTA, no genéricas. Tienen que servir para descubrir: cómo le fue al negocio, si cambió a quién le vende, qué se le viene, y qué le está faltando de nosotros. Cada pregunta en una línea, sin explicación alrededor.

## Oportunidades para proponer (3 min)
Ideas concretas para el mes que viene, justificadas por los números o por algo que el cliente dijo. Si corresponde y es honesto, incluí propuesta de más servicio. Máximo 3.

## Para cerrar (3 min)
Los compromisos que tenés que dejar firmes antes de cortar.

# Reglas duras
- USÁ SOLO los datos que te paso. NO inventes métricas, ventas ni frases del cliente.
- Si un bloque no tiene material (no hubo pauta, no hay mes anterior, no hay diagnóstico previo), no lo menciones. Nada de "no contamos con datos de X".
- Bullets cortos. Es un ayudamemoria, no un informe. El guión entero se lee en dos minutos.
- Las preguntas tienen que sonar a como hablás en un meet real, no a formulario.
- Empezá DIRECTO con "# Guión — Reunión mensual · [Cliente] · [Mes]". Sin introducción ni cierre meta.`;

function buildGuionUserText(ctx: MeetingContext): string {
  const lines: string[] = [];

  lines.push(`# Cliente`);
  lines.push(`Nombre: ${ctx.clienteNombre}`);
  if (ctx.rubro) lines.push(`Rubro: ${ctx.rubro}`);
  if (ctx.pack) lines.push(`Pack: ${ctx.pack}`);
  if (ctx.serviciosContratados.length) {
    lines.push(`Servicios contratados: ${ctx.serviciosContratados.join(", ")}`);
  }
  lines.push(`Mes que se cierra: ${ctx.mesLabel}`);
  lines.push("");

  if (ctx.contextoMarca) {
    lines.push(`# Quién es la marca (diagnóstico inicial)`);
    lines.push(ctx.contextoMarca);
    lines.push("");
  }

  if (ctx.metricas) {
    lines.push(`# Números del mes`);
    lines.push(ctx.metricas);
    lines.push("");
  }

  if (ctx.mesAnterior) {
    lines.push(`# Lo que salió de la reunión del mes pasado`);
    lines.push(
      `Revisá si lo que prometimos se cumplió y si las frustraciones siguen abiertas. Eso va en "Antes de entrar" y en "Lo que hay que decir aunque incomode".`
    );
    lines.push("");
    lines.push(ctx.mesAnterior);
    lines.push("");
  }

  if (ctx.notaDelReporte) {
    lines.push(`# Nota que dejó el equipo en el reporte del mes`);
    lines.push(ctx.notaDelReporte);
    lines.push("");
  }

  if (ctx.satisfaccion) {
    lines.push(`# Encuesta del cliente este mes`);
    lines.push(`Puntaje: ${ctx.satisfaccion.puntaje}/5`);
    if (ctx.satisfaccion.que_valoran) lines.push(`Valora: ${ctx.satisfaccion.que_valoran}`);
    if (ctx.satisfaccion.que_mejorar) lines.push(`Mejoraría: ${ctx.satisfaccion.que_mejorar}`);
    lines.push("");
  }

  lines.push(`# Tu tarea`);
  lines.push(
    `Armá el guión de la reunión mensual de ${ctx.clienteNombre} para ${ctx.mesLabel}. Markdown, directo al título.`
  );

  return lines.join("\n");
}

/**
 * Genera el guión. Devuelve null si la IA falla.
 *
 * Funciona aunque no haya métricas: si la cuenta recién arranca o no tiene
 * Instagram conectado, el guión sale igual pero más cargado de preguntas.
 */
export async function generateMeetingGuion(ctx: MeetingContext): Promise<string | null> {
  try {
    const msg = await anthropic.messages.create({
      model: GUION_MODEL,
      max_tokens: 2000,
      system: [{ type: "text", text: GUION_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildGuionUserText(ctx) }],
    });
    void trackAiUsage({ ruta: "reunion-mensual/guion", modelo: GUION_MODEL, usage: msg.usage });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("[reunion-mensual/guion] error", err);
    return null;
  }
}
