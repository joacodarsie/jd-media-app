/**
 * Sugerencia de SECTORES para campañas de prospección. Barato (Haiku, sin
 * búsqueda web): la IA mira los clientes ACTUALES de JD Media para entender qué
 * tipo de negocio le funciona, y propone rubros/nichos nuevos donde salir a
 * buscar — con una zona sugerida y un ángulo. No todo tiene que ser Argentina.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_FAST } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import {
  bloqueServiciosParaPrompt,
  cargarCatalogoServicios,
  type ServicioAgencia,
} from "./catalogo";

const client = new Anthropic();

export interface SectorSuggestion {
  rubro: string;
  ubicacion: string | null;
  angulo: string | null;
  por_que: string | null;
}

export interface SuggestInput {
  /** Clientes actuales, para que la IA entienda el perfil que funciona. */
  clientes: { nombre: string; rubro: string | null; descripcion: string | null }[];
  /** Rubros de campañas ya existentes, para no repetir. */
  rubrosExistentes: string[];
  /** Catálogo real de servicios. Sin esto el ángulo sale con SEO/LinkedIn. */
  catalogo?: ServicioAgencia[];
}

function safeParse(raw: string): SectorSuggestion[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const out: SectorSuggestion[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const rubro = str(o.rubro);
    if (!rubro) continue;
    out.push({
      rubro: rubro.slice(0, 120),
      ubicacion: str(o.ubicacion)?.slice(0, 120) ?? null,
      angulo: str(o.angulo)?.slice(0, 300) ?? null,
      por_que: str(o.por_que)?.slice(0, 300) ?? null,
    });
  }
  return out;
}

export async function suggestSectors(input: SuggestInput): Promise<SectorSuggestion[]> {
  const clientesTxt =
    input.clientes.length > 0
      ? input.clientes
          .slice(0, 60)
          .map((c) => `- ${c.nombre}${c.rubro ? ` (${c.rubro})` : ""}${c.descripcion ? `: ${c.descripcion}` : ""}`)
          .join("\n")
      : "(todavía no hay clientes cargados con rubro)";
  const existentes =
    input.rubrosExistentes.length > 0
      ? `\n\nYA TENEMOS CAMPAÑAS DE ESTOS RUBROS (proponé DISTINTOS):\n${input.rubrosExistentes
          .slice(0, 40)
          .map((r) => `- ${r}`)
          .join("\n")}`
      : "";

  const catalogo = input.catalogo ?? (await cargarCatalogoServicios());

  const system = `Sos el director comercial de JD Media, una agencia de marketing digital de Córdoba, Argentina. Tu tarea: proponer SECTORES/NICHOS concretos donde salir a prospectar clientes nuevos, entendiendo qué perfil de cliente ya le funciona a la agencia.

${bloqueServiciosParaPrompt(catalogo)}

CLIENTES ACTUALES DE JD MEDIA (para entender el perfil que funciona):
${clientesTxt}${existentes}

CÓMO PENSAR
- Detectá el patrón de los clientes actuales (rubros, tamaño, qué necesitan) y proponé nichos PARECIDOS (más de lo que ya funciona) y algunos ADYACENTES con buen potencial.
- Priorizá rubros de PyMEs/negocios con capacidad de pago pero presencia digital floja (nuestro mejor cliente).
- Por defecto la zona es Argentina (Córdoba y grandes ciudades), PERO podés sugerir 1-2 nichos fuera del país (ej: España, LATAM) si el rubro se presta a trabajar a distancia. No fuerces todo a Argentina.
- Sé específico: "gimnasios y boxes de crossfit" es mejor que "salud". Cada sugerencia es un cluster afilado.

SALIDA
Devolvé SOLO un array JSON válido (sin markdown ni texto extra), 6 a 8 sugerencias, cada una:
{"rubro": string, "ubicacion": string|null, "angulo": string|null, "por_que": string|null}
- rubro: el nicho afilado.
- ubicacion: zona sugerida (ej: "Córdoba, Argentina" o "España (remoto)").
- angulo: en 1 frase, qué problema típico de ese rubro resolvemos — **con un servicio del catálogo, nombrado tal cual**. Si el ángulo obvio del rubro fuera algo que no vendemos (SEO, LinkedIn, mailing), buscá otro desde lo que sí hacemos. Este texto termina en los mensajes que se le mandan al prospecto, así que no puede prometer lo que no tenemos.
- por_que: en 1 frase, por qué es buen sector para nosotros (relación con los clientes actuales / potencial).
Solo el array JSON.`;

  const msg = await client.messages.create({
    model: AI_MODEL_FAST,
    max_tokens: 2000,
    system: [{ type: "text", text: system }],
    messages: [
      { role: "user", content: "Proponé los sectores en el array JSON pedido." },
    ],
  });

  void trackAiUsage({ ruta: "prospeccion/sugerir-sectores", modelo: AI_MODEL_FAST, usage: msg.usage });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return safeParse(text).slice(0, 8);
}
