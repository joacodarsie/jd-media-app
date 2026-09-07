import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser, userInRoles } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { createAdmin } from "@/lib/supabase/admin";
import { rubroPorSlug } from "@/lib/propuestas/rubros";
import { cargarCatalogoServicios } from "@/lib/prospecting/catalogo";
import { leerSitio, bloqueDeContextoWeb } from "@/lib/propuestas/leer-sitio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const client = new Anthropic();
const MODEL = AI_MODEL_SMART;
const PUEDEN = ["admin", "coordinador", "comercial", "prospecting"];

interface ImageInput {
  media_type: string;
  /** base64 SIN el prefijo `data:` */
  data: string;
}

const ALLOWED_IMG = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function imageBlocks(images?: ImageInput[]): Anthropic.ImageBlockParam[] {
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

/**
 * Afina la propuesta para UN prospecto puntual.
 *
 * El caso que lo motivó: a un hotel se le mandó el mensaje en frío y contestó
 * "lo más importante para mí es la segmentación: el 85% de mis huéspedes son
 * extranjeros y no repiten". Una propuesta de rubro no responde eso. Acá se
 * pega ese texto (o directamente la CAPTURA del chat) y la IA reescribe el
 * diagnóstico y agrega cómo lo resolvemos en su caso.
 *
 * Es la única parte de la propuesta que gasta tokens, y solo cuando se aprieta
 * el botón: el resto sale de la base.
 */
function systemPrompt(servicios: string) {
  return `Sos el director comercial de JD MEDIA, una agencia de marketing digital de Córdoba, Argentina.

Te paso el contexto de un prospecto —lo que dijo por WhatsApp, la captura del chat, las notas o la TRANSCRIPCIÓN COMPLETA de la reunión comercial— y tenés que escribir el bloque personalizado de la propuesta que le vamos a mandar.

# Lo que devolvés (JSON, sin nada más alrededor)
{
  "titular": "Una frase de 6 a 12 palabras que le demuestre que lo escuchamos. Va como título de la propuesta. Sin signos de admiración.",
  "diagnostico": "2 o 3 oraciones que reformulan SU situación puntual con nuestras palabras: qué nos dijo que le importa y por qué tiene razón en que eso es lo que hay que resolver. Nada de halagos vacíos.",
  "puntos": ["3 o 4 acciones CONCRETAS con las que lo resolvemos, una por elemento. Cada una de 1 o 2 oraciones."],
  "ideas": ["3 o 4 ideas de contenido para ESTE negocio en particular, no para su rubro en general. Si el contexto menciona sus productos, su local, su equipo o algo que lo distingue, usalo. Una idea por elemento, en una línea."]
}

# Si te paso el contenido del sitio del prospecto
Es texto REAL bajado de su web. Usalo para saber qué vende, cómo se presenta y con qué palabras habla de lo suyo — y nombrá algo concreto de ahí en el diagnóstico o en las ideas, para que se note que lo miramos. No inventes nada que no esté en ese texto. Si te paso un Instagram, es solo el nombre de usuario: **no lo vimos**, así que no describas su feed ni cuánto publica.

# Si te paso una transcripción de reunión
Es una conversación real, con desvíos y charla suelta. Sacá de ahí: qué le duele, qué probó antes, qué le preocupa del precio o del compromiso, qué palabras usa él para describir su negocio, y cualquier dato concreto que haya dado (cuántos locales, de dónde le vienen los clientes, qué temporada le sirve). Ignorá el saludo, la charla social y lo que dijimos nosotros. Si dijo algo que contradice lo que suele pasar en su rubro, **gana lo que dijo él**.

# Reglas que no se rompen
1. **Solo servicios que existen.** Esto es lo único que vende JD MEDIA:
${servicios}
No inventes SEO, LinkedIn, email marketing, influencers, prensa ni nada que no esté en esa lista.
2. **Cero números inventados.** Prohibido prometer porcentajes, cantidad de clientes, retorno o plazos de resultado. Si el prospecto da un número (ej. "85% son extranjeros"), podés usarlo porque lo dijo él.
3. **Respondé lo que preguntó, no lo que nos gustaría que preguntara.** Si le preocupa la segmentación, los puntos tienen que ser de segmentación. Si le preocupa el precio, hablá de eso.
4. **Nada de promesas de entregables gratis** (ni auditorías, ni pruebas gratis, ni "te preparo un plan sin cargo").
5. **Tono argentino, de vos, directo y profesional.** Sin jerga de agencia: prohibido "potenciar", "llevar al siguiente nivel", "sinergia", "ecosistema digital", "espero que estés muy bien". Sin emojis. Sin guiones largos.
6. Si en la captura hay varios mensajes, quedate con lo que dijo EL PROSPECTO, no con lo que escribimos nosotros.
7. Si lo que te pasan no alcanza para personalizar, devolvé igual el JSON con lo mejor que puedas del rubro, sin inventar datos del negocio.`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 500 });
  }
  const me = await requireUser();
  if (!userInRoles(me, PUEDEN)) {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }

  const body = (await req.json()) as {
    propuestaId?: string;
    notas?: string;
    images?: ImageInput[];
  };
  if (!body.propuestaId) {
    return NextResponse.json({ error: "Falta la propuesta." }, { status: 400 });
  }

  const admin = createAdmin();
  const { data: prop } = await admin
    .from("proposals")
    .select("id, empresa, contacto_nombre, rubro_slug, rubro_texto, sitio_web, instagram")
    .eq("id", body.propuestaId)
    .maybeSingle();
  if (!prop) return NextResponse.json({ error: "No existe esa propuesta." }, { status: 404 });

  const p = prop as {
    id: string;
    empresa: string;
    contacto_nombre: string | null;
    rubro_slug: string | null;
    rubro_texto: string | null;
    sitio_web: string | null;
    instagram: string | null;
  };

  const imgs = imageBlocks(body.images);
  const notas = (body.notas ?? "").trim().slice(0, 40000);

  // El sitio se BAJA y se mete su contenido en el prompt: pasarle la URL
  // pelada no sirve de nada porque el modelo no puede abrirla.
  const web = await leerSitio(p.sitio_web);

  // Con el sitio solo ya alcanza para escribir algo propio del negocio, así que
  // no se exige que además haya notas o capturas.
  if (!notas && imgs.length === 0 && !web) {
    return NextResponse.json(
      {
        error: p.sitio_web
          ? "No pudimos leer ese sitio. Pegá lo que te dijo el prospecto o subí la captura del chat."
          : "Pegá lo que te dijo el prospecto, subí la captura del chat o cargá su sitio web.",
      },
      { status: 400 },
    );
  }

  const ficha = rubroPorSlug(p.rubro_slug);
  const catalogo = await cargarCatalogoServicios();
  const serviciosTxt = catalogo
    .map((s) => `- ${s.nombre}: ${s.descripcion ?? ""}`)
    .join("\n");

  const contexto = [
    `Empresa: ${p.empresa}`,
    p.contacto_nombre ? `Persona: ${p.contacto_nombre}` : null,
    `Rubro: ${p.rubro_texto || ficha.nombre}`,
    bloqueDeContextoWeb(web, p.instagram) || null,
    `Lo que solemos ver en el rubro (contexto nuestro, no lo repitas textual): ${ficha.diagnostico}`,
    notas
      ? `\nContexto de la conversación (lo que dijo, notas de la reunión o la transcripción):\n"""\n${notas}\n"""`
      : null,
    imgs.length ? `\n(Se adjuntan ${imgs.length} captura/s de la conversación.)` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let res: Anthropic.Message;
  try {
    res = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt(serviciosTxt),
      messages: [{ role: "user", content: [...imgs, { type: "text", text: contexto }] }],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo generar." },
      { status: 502 },
    );
  }

  void trackAiUsage({ ruta: "propuestas/afinar", modelo: MODEL, usage: res.usage, userId: me.id });

  const texto = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  // El modelo a veces envuelve el JSON en ```json … ```.
  const json = texto.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let parsed: { titular?: string; diagnostico?: string; puntos?: string[]; ideas?: string[] };
  try {
    parsed = JSON.parse(json);
  } catch {
    const m = json.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "La IA no devolvió un formato usable." }, { status: 502 });
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return NextResponse.json({ error: "La IA no devolvió un formato usable." }, { status: 502 });
    }
  }

  const ia = {
    titular: typeof parsed.titular === "string" ? parsed.titular.trim().slice(0, 160) : null,
    diagnostico: typeof parsed.diagnostico === "string" ? parsed.diagnostico.trim().slice(0, 1200) : null,
    ideas: Array.isArray(parsed.ideas)
      ? parsed.ideas.filter((x) => typeof x === "string" && x.trim()).slice(0, 6).map((x) => x.trim().slice(0, 400))
      : [],
    puntos: Array.isArray(parsed.puntos)
      ? parsed.puntos.filter((x) => typeof x === "string" && x.trim()).slice(0, 5).map((x) => x.trim().slice(0, 400))
      : [],
    generado_at: new Date().toISOString(),
  };

  await admin
    .from("proposals")
    .update({ ia, notas: notas || null, updated_at: new Date().toISOString() })
    .eq("id", p.id);

  return NextResponse.json({ ok: true, ia });
}
