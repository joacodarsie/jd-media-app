/**
 * Armar una campaña de prospección a partir de una frase.
 *
 * El pedido del dueño (15/9/2026): *"si yo te escribo «tecno por Córdoba», que
 * me rellene los campos solo"*. Llenar el formulario a mano —nombre, rubro,
 * zona, servicio, ángulo, canal, idioma— es un viaje, y el ángulo bien escrito
 * es justo lo que después define la calidad de los mensajes al prospecto.
 *
 * Es distinto de `suggest.ts`: aquel propone QUÉ nicho atacar cuando no sabés;
 * este toma el nicho que ya tenés en la cabeza y lo convierte en una campaña
 * completa.
 *
 * Todo lo que decide qué es válido vive acá y es puro: se prueba sin base.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_FAST } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import {
  bloqueServiciosParaPrompt,
  cargarCatalogoServicios,
  type ServicioAgencia,
} from "./catalogo";
import { PROSPECTING_CHANNELS, PROSPECTING_LANGS } from "./shared";

export interface CampaniaSugerida {
  nombre: string;
  rubro: string;
  ubicacion: string | null;
  /** Slug del catálogo real de servicios, o null. */
  servicio: string | null;
  angulo: string | null;
  canal: string;
  idioma: string;
}

const CANALES = PROSPECTING_CHANNELS.map((c) => c.value) as readonly string[];
const IDIOMAS = PROSPECTING_LANGS.map((l) => l.value) as readonly string[];
/** Lo que se usa cuando el modelo no dice nada o dice algo que no existe. */
export const CANAL_POR_DEFECTO = "whatsapp";
export const IDIOMA_POR_DEFECTO = "es_ar";

function texto(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Convierte lo que devolvió el modelo en una campaña válida, o null si ni
 * siquiera trae rubro (sin rubro no hay campaña: es el único campo que la app
 * exige junto con el nombre).
 *
 * Los valores que no existen en la app —un servicio inventado, un canal raro—
 * se descartan en vez de romper el formulario: es preferible un campo vacío
 * que uno con un valor que el select no puede mostrar.
 */
export function normalizarCampania(
  raw: unknown,
  slugsValidos: readonly string[]
): CampaniaSugerida | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const rubro = texto(o.rubro, 120);
  if (!rubro) return null;

  const ubicacion = texto(o.ubicacion, 120);
  const servicio = texto(o.servicio, 60);
  const canal = texto(o.canal, 30);
  const idioma = texto(o.idioma, 10);
  // Sin nombre se arma uno con lo que hay: "rubro + ciudad" es exactamente lo
  // que el equipo escribe a mano.
  const nombre =
    texto(o.nombre, 80) ??
    `${rubro}${ubicacion ? ` ${ubicacion.split(",")[0].trim()}` : ""}`.slice(0, 80);

  return {
    nombre,
    rubro,
    ubicacion,
    servicio: servicio && slugsValidos.includes(servicio) ? servicio : null,
    angulo: texto(o.angulo, 400),
    canal: canal && CANALES.includes(canal) ? canal : CANAL_POR_DEFECTO,
    idioma: idioma && IDIOMAS.includes(idioma) ? idioma : IDIOMA_POR_DEFECTO,
  };
}

/** El primer objeto JSON del texto del modelo. */
export function primerObjeto(raw: string): unknown {
  const ini = raw.indexOf("{");
  const fin = raw.lastIndexOf("}");
  if (ini === -1 || fin === -1 || fin < ini) return null;
  try {
    return JSON.parse(raw.slice(ini, fin + 1));
  } catch {
    return null;
  }
}

const client = new Anthropic();

export async function campaniaDesdeTexto(input: {
  /** Lo que escribió o dictó la persona. Ej: "tecno por Córdoba". */
  texto: string;
  catalogo?: ServicioAgencia[];
}): Promise<CampaniaSugerida | null> {
  const catalogo = input.catalogo ?? (await cargarCatalogoServicios());
  const slugs = catalogo.map((s) => s.slug);

  const system = `Sos el director comercial de JD Media, una agencia de marketing digital de Córdoba, Argentina. Alguien del equipo te dice en una frase suelta a quién quiere prospectar y vos completás la ficha de la campaña.

${bloqueServiciosParaPrompt(catalogo)}

SLUGS DE SERVICIO VÁLIDOS (usá uno EXACTO o null): ${slugs.join(", ")}

CÓMO COMPLETAR
- Interpretá jerga y abreviaturas argentinas ("tecno" = negocios de tecnología/electrónica, "gastro" = gastronomía, "inmo" = inmobiliarias).
- rubro: afilalo en un cluster concreto. "tecno" solo es demasiado amplio: mejor "casas de electrónica y tecnología".
- ubicacion: si nombra una ciudad o provincia, completala como "Ciudad, País". Si no dice nada, poné "Córdoba, Argentina".
- servicio: el que mejor encaje del catálogo, por su slug exacto. Si la frase no lo deja claro, usá el de gestión de redes.
- angulo: 1 o 2 frases con el problema típico de ese rubro y con qué servicio del catálogo lo resolvemos. Este texto termina en los mensajes al prospecto: no prometas nada que no esté en el catálogo.
- canal: "whatsapp", "instagram" o "email". Por defecto whatsapp; email solo si la frase apunta a empresas grandes o B2B formal.
- idioma: "es_ar" para Argentina, "es" para el resto de habla hispana, "en" para países de habla inglesa.
- nombre: corto, como lo escribiría una persona. Ej: "Casas de tecnología Córdoba".

SALIDA
Solo un objeto JSON válido, sin markdown ni texto alrededor:
{"nombre": string, "rubro": string, "ubicacion": string, "servicio": string|null, "angulo": string, "canal": string, "idioma": string}`;

  const msg = await client.messages.create({
    model: AI_MODEL_FAST,
    max_tokens: 900,
    system: [{ type: "text", text: system }],
    messages: [{ role: "user", content: input.texto.slice(0, 2000) }],
  });

  void trackAiUsage({
    ruta: "prospeccion/campania-desde-texto",
    modelo: AI_MODEL_FAST,
    usage: msg.usage,
  });

  const out = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return normalizarCampania(primerObjeto(out), slugs);
}
