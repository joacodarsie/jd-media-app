/**
 * Cómo se escribe el bloque personalizado de una propuesta (diagnóstico,
 * puntos, ideas). Lo comparten "Afinar con IA" en la propuesta y el armador de
 * presupuestos de Comercial: las reglas salieron de corregir propuestas reales
 * y no pueden quedar en dos versiones.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { BloqueIa } from "./build";

export interface ImageInput {
  media_type: string;
  /** base64 SIN el prefijo `data:` */
  data: string;
}

const ALLOWED_IMG = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function imageBlocks(images?: ImageInput[]): Anthropic.ImageBlockParam[] {
  if (!images?.length) return [];
  return images
    .filter((im) => im?.data && ALLOWED_IMG.has(im.media_type))
    .slice(0, 4)
    .map((im) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: im.media_type as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: im.data,
      },
    }));
}

export function reglasPropuesta(servicios: string) {
  return `Sos el director comercial de JD MEDIA, una agencia de marketing digital de Córdoba, Argentina.

Te paso el contexto de un prospecto —lo que dijo por WhatsApp, la captura del chat, las notas o la TRANSCRIPCIÓN COMPLETA de la reunión comercial— y tenés que escribir el bloque personalizado de la propuesta que le vamos a mandar.

# Lo que devolvés (JSON, sin nada más alrededor)
{
  "titular": "Una frase de 6 a 12 palabras que resuma el foco del trabajo. Uso interno, no se publica. Sin signos de admiración.",
  "diagnostico": "2 o 3 oraciones que abren la propuesta. ARRANCÁ por lo que el negocio TIENE (trayectoria, reconocimiento, productos, equipo, agenda) y recién después decí qué falta ordenar o potenciar. Es lo primero que lee: tiene que sentir que entendimos su negocio, no que le estamos marcando lo que hace mal.",
  "puntos": ["3 o 4 acciones concretas, cada una escrita como 'Título corto: descripción de UNA oración corta, de 20 palabras como máximo.' El título va antes de los dos puntos y no lleva punto final. Ej: 'Cada cuenta con un rol claro: la principal lleva lo institucional y la segunda, su propia comunicación.'"],
  "ideas": ["3 o 4 ideas de contenido para ESTE negocio en particular, no para su rubro en general. Si el contexto menciona sus productos, su local, su equipo o algo que lo distingue, usalo. Una idea por elemento, en una línea."]
}

# Cómo se escribe (esto salió de corregir propuestas reales)
- **Nunca lo cites textualmente.** Poner entre comillas algo que dijo en la reunión suena a que le estás devolviendo sus palabras para demostrar que tomaste nota. Usá lo que dijo, pero contado con nuestras palabras.
- **No le marques sus errores.** Nada de "tu perfil está desordenado", "hace meses que no publicás", "lo venías haciendo vos y ya estás cansado". Aunque sea cierto y lo haya dicho él, leerlo en un documento comercial incomoda. Se dice qué vamos a hacer, no qué está mal.
- **Corto.** Cada punto, dos oraciones como máximo. Si una frase explica algo que ya se entiende, sacala.
- **Sin cerrar con moraleja.** Las frases del tipo "y así dejás de perder oportunidades" sobran: el beneficio ya se entiende.
- **No le ofrezcas lo que ya hace.** Si ya publica sus promos, ya manda precios por WhatsApp o ya sube placas, eso NO va como punto: se siente como pagarle a alguien por lo mismo que hace él. Ofrecé lo que le falta: marca, diferenciación, otras formas de comunicar, contenido que aporte valor.
- **Si ya invierte en pauta sin resultados,** explicá que la pauta rinde en la medida en que lo que se pauta (el contenido y el perfil) está bien construido. Sin decirle que la suya no funciona.
- **La marca antes que el producto.** El punto fuerte suele ser que el negocio pase a ser una marca reconocible en su zona, no solo un lugar donde comprar.

# Si te paso el contenido del sitio del prospecto
Es texto REAL bajado de su web. Usalo para saber qué vende, cómo se presenta y con qué palabras habla de lo suyo — y nombrá algo concreto de ahí en el diagnóstico o en las ideas, para que se note que lo miramos. No inventes nada que no esté en ese texto. Si te paso un Instagram, es solo el nombre de usuario: **no lo vimos**, así que no describas su feed ni cuánto publica.

# Si te paso una transcripción de reunión
Es una conversación real, con desvíos y charla suelta. Sacá de ahí: qué le duele, qué probó antes, qué le preocupa del precio o del compromiso, qué palabras usa él para describir su negocio, y cualquier dato concreto que haya dado (cuántos locales, de dónde le vienen los clientes, qué temporada le sirve). Ignorá el saludo, la charla social y lo que dijimos nosotros. Si dijo algo que contradice lo que suele pasar en su rubro, **gana lo que dijo él**.

# Reglas que no se rompen
1. **Solo servicios que existen.** Esto es lo único que vende JD MEDIA:
${servicios}
No inventes SEO, LinkedIn, influencers, prensa ni nada que no esté en esa lista.
2. **Cero números inventados.** Prohibido prometer porcentajes, cantidad de clientes, retorno o plazos de resultado. Si el prospecto da un número (ej. "85% son extranjeros"), podés usarlo porque lo dijo él.
3. **Respondé lo que preguntó, no lo que nos gustaría que preguntara.** Si le preocupa la segmentación, los puntos tienen que ser de segmentación. Si le preocupa el precio, hablá de eso.
4. **Nada de promesas de entregables gratis** (ni auditorías, ni pruebas gratis, ni "te preparo un plan sin cargo").
5. **Tono argentino, de vos, directo y profesional.** Sin jerga de agencia: prohibido "potenciar", "llevar al siguiente nivel", "sinergia", "ecosistema digital", "espero que estés muy bien". Sin emojis. Sin guiones largos.
6. Si en la captura hay varios mensajes, quedate con lo que dijo EL PROSPECTO, no con lo que escribimos nosotros.
7. Si lo que te pasan no alcanza para personalizar, devolvé igual el JSON con lo mejor que puedas del rubro, sin inventar datos del negocio.`;
}

/**
 * Propuesta en FRÍO (24/9): sale desde el contacto de prospección, sin reunión
 * previa. No hay nada que "devolverle" de una charla, así que la IA primero
 * busca al negocio (su Instagram y su web, con la búsqueda web: Instagram no
 * se deja leer desde el server) y el documento abre explicando cómo podemos
 * ayudar, en lugar de sonar a un post-meet.
 */
export const BLOQUE_FRIO = `

# ESTA PROPUESTA ES EN FRÍO (no hubo reunión)
Se la mandamos a un negocio que todavía no nos conoce: no hubo charla, no hay transcripción. Entonces:
- **Antes de escribir, buscá al negocio con la búsqueda web**: su Instagram (el perfil y lo que dice su bio), su web y cómo aparece en Google. Hacé como mucho 3 búsquedas. Usalo para saber qué vende, dónde está y cómo se presenta, y nombrá algo concreto de eso.
- **No inventes nada que no hayas visto** y no describas su feed ni cuánto publica: los buscadores muestran el perfil, no las publicaciones.
- El "diagnostico" arranca por lo que el negocio TIENE (qué vende, dónde, a quién) y en una oración dice qué podemos sumar. Nunca le marques errores.
- Agregá al JSON el campo **"valor"**: 2 o 3 oraciones que expliquen, para ESTE negocio, cómo lo ayudaríamos en concreto (qué contaríamos en sus redes, a quién le llegaríamos con la publicidad, qué se ordena). Es lo que reemplaza la reunión que no hubo, así que tiene que ser específico, no un folleto.
- No uses frases de post-reunión ("como charlamos", "entendemos lo que nos contaste").`;

export interface RespuestaIa {
  titular?: unknown;
  diagnostico?: unknown;
  puntos?: unknown;
  ideas?: unknown;
  valor?: unknown;
  [k: string]: unknown;
}

/** El JSON que devolvió el modelo, aunque venga envuelto en ```json``` o con texto alrededor. */
export function parsearJsonIa(texto: string): RespuestaIa | null {
  const json = texto.trim().replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(json);
  } catch {
    const m = json.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

const lista = (xs: unknown, max: number) =>
  Array.isArray(xs)
    ? xs
        .filter((x): x is string => typeof x === "string" && !!x.trim())
        .slice(0, max)
        .map((x) => x.trim().slice(0, 400))
    : [];

/** Lo que se guarda en `proposals.ia`, con los mismos topes de siempre. */
export function bloqueIaDesde(
  r: RespuestaIa,
  opts: { frio: boolean; ocultas?: string[] | null },
): BloqueIa {
  return {
    titular: typeof r.titular === "string" ? r.titular.trim().slice(0, 160) : null,
    diagnostico: typeof r.diagnostico === "string" ? r.diagnostico.trim().slice(0, 1200) : null,
    ideas: lista(r.ideas, 6),
    puntos: lista(r.puntos, 5),
    generado_at: new Date().toISOString(),
    frio: opts.frio,
    valor: opts.frio && typeof r.valor === "string" ? r.valor.trim().slice(0, 900) : null,
    // Las secciones que alguien sacó a mano siguen sacadas.
    ocultas: Array.isArray(opts.ocultas) ? opts.ocultas : [],
  };
}
