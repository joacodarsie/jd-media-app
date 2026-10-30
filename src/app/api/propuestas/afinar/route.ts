import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser, userInRoles } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { createAdmin } from "@/lib/supabase/admin";
import { rubroPorSlug } from "@/lib/propuestas/rubros";
import { cargarCatalogoServicios } from "@/lib/prospecting/catalogo";
import { leerSitio, bloqueDeContextoWeb } from "@/lib/propuestas/leer-sitio";
import { armarExtras } from "@/lib/propuestas/extras";
import {
  BLOQUE_FRIO,
  bloqueIaDesde,
  imageBlocks,
  parsearJsonIa,
  reglasPropuesta,
  type ImageInput,
} from "@/lib/propuestas/prompt-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const client = new Anthropic();
const MODEL = AI_MODEL_SMART;
const PUEDEN = ["admin", "coordinador", "comercial", "prospecting"];

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
    /** "frio": propuesta sin reunión, desde el contacto de prospección. */
    modo?: string;
  };
  if (!body.propuestaId) {
    return NextResponse.json({ error: "Falta la propuesta." }, { status: 400 });
  }

  const admin = createAdmin();
  const { data: prop } = await admin
    .from("proposals")
    .select("id, empresa, contacto_nombre, rubro_slug, rubro_texto, sitio_web, instagram, extras, contacto_id, ia")
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
    extras?: unknown;
    contacto_id?: string | null;
    ia?: { ocultas?: string[] | null } | null;
  };

  const imgs = imageBlocks(body.images);
  const notas = (body.notas ?? "").trim().slice(0, 40000);

  // El sitio se BAJA y se mete su contenido en el prompt: pasarle la URL
  // pelada no sirve de nada porque el modelo no puede abrirla.
  const web = await leerSitio(p.sitio_web);

  // En frío no hay conversación: se busca al negocio en la web.
  const frio = body.modo === "frio" || (!notas && imgs.length === 0 && !!p.contacto_id);

  // Con el sitio solo ya alcanza para escribir algo propio del negocio, así que
  // no se exige que además haya notas o capturas.
  if (!notas && imgs.length === 0 && !web && !frio) {
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
    (() => {
      const x = armarExtras(p.extras).lineas;
      return x.length
        ? `Además del pack le ofrecemos como opcional: ${x.map((l) => l.nombre).join(", ")}. Podés dedicar un punto a eso si tiene sentido para el negocio.`
        : null;
    })(),
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
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: [...imgs, { type: "text", text: contexto }] },
    ];
    const pedir = () =>
      client.messages.create({
        model: MODEL,
        max_tokens: frio ? 3000 : 2000,
        system: reglasPropuesta(serviciosTxt) + (frio ? BLOQUE_FRIO : ""),
        messages,
        ...(frio
          ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 }] }
          : {}),
      });
    res = await pedir();
    // Con búsqueda web el modelo puede pausar el turno: se le deja seguir.
    for (let i = 0; i < 2 && res.stop_reason === "pause_turn"; i++) {
      messages.push({ role: "assistant", content: res.content });
      res = await pedir();
    }
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

  const parsed = parsearJsonIa(texto);
  if (!parsed) return NextResponse.json({ error: "La IA no devolvió un formato usable." }, { status: 502 });
  const ia = bloqueIaDesde(parsed, { frio, ocultas: p.ia?.ocultas });

  await admin
    .from("proposals")
    .update({ ia, notas: notas || null, updated_at: new Date().toISOString() })
    .eq("id", p.id);

  return NextResponse.json({ ok: true, ia });
}
