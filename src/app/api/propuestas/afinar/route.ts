import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser, userInRoles } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { createAdmin } from "@/lib/supabase/admin";
import { rubroPorSlug } from "@/lib/propuestas/rubros";
import { cargarCatalogoServicios } from "@/lib/prospecting/catalogo";

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

Te paso lo que un prospecto dijo por WhatsApp (texto o captura de pantalla) y tenés que escribir el bloque personalizado de la propuesta que le vamos a mandar.

# Lo que devolvés (JSON, sin nada más alrededor)
{
  "titular": "Una frase de 6 a 12 palabras que le demuestre que lo escuchamos. Va como título de la propuesta. Sin signos de admiración.",
  "diagnostico": "2 o 3 oraciones que reformulan SU situación puntual con nuestras palabras: qué nos dijo que le importa y por qué tiene razón en que eso es lo que hay que resolver. Nada de halagos vacíos.",
  "puntos": ["3 o 4 acciones CONCRETAS con las que lo resolvemos, una por elemento. Cada una de 1 o 2 oraciones."]
}

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
    .select("id, empresa, contacto_nombre, rubro_slug, rubro_texto")
    .eq("id", body.propuestaId)
    .maybeSingle();
  if (!prop) return NextResponse.json({ error: "No existe esa propuesta." }, { status: 404 });

  const p = prop as {
    id: string;
    empresa: string;
    contacto_nombre: string | null;
    rubro_slug: string | null;
    rubro_texto: string | null;
  };

  const imgs = imageBlocks(body.images);
  const notas = (body.notas ?? "").trim().slice(0, 4000);
  if (!notas && imgs.length === 0) {
    return NextResponse.json(
      { error: "Pegá lo que te dijo el prospecto o subí la captura del chat." },
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
    `Lo que solemos ver en el rubro (contexto nuestro, no lo repitas textual): ${ficha.diagnostico}`,
    notas ? `\nLo que dijo el prospecto:\n"""\n${notas}\n"""` : null,
    imgs.length ? `\n(Se adjuntan ${imgs.length} captura/s de la conversación.)` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let res: Anthropic.Message;
  try {
    res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
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
  let parsed: { titular?: string; diagnostico?: string; puntos?: string[] };
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
