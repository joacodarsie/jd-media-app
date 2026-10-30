import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser, userHas, userInRoles } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings, type AgencySettings } from "@/lib/coordinacion";
import { cargarCatalogoServicios } from "@/lib/prospecting/catalogo";
import { leerSitio, bloqueDeContextoWeb } from "@/lib/propuestas/leer-sitio";
import { EXTRAS } from "@/lib/propuestas/extras";
import { handleBonito } from "@/lib/propuestas/inversion";
import { urlPropuesta } from "@/lib/propuestas/build";
import { insertarPropuesta } from "@/lib/propuestas/crear";
import {
  BLOQUE_FRIO,
  bloqueIaDesde,
  imageBlocks,
  parsearJsonIa,
  reglasPropuesta,
  type ImageInput,
} from "@/lib/propuestas/prompt-ia";
import {
  MARGEN_MINIMO,
  comisionVendedor,
  cuentaDeArmado,
  ejemplosMedida,
  extrasDeIa,
  resolverArmado,
  type ArmadoCrudo,
} from "@/lib/comercial/presupuesto-ia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcripciones largas + búsqueda web superan los 60s del gateway: SSE.
export const maxDuration = 300;

const client = new Anthropic();
const MODEL = AI_MODEL_SMART;
const PUEDEN = ["admin", "coordinador", "comercial", "prospecting"];

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

/**
 * Lo que se suma al prompt de siempre de la propuesta: además de escribirla,
 * la IA elige el armado. Ve los packs con su precio de lista y precios de
 * referencia de packs a medida, nunca las tarifas del equipo. El precio final
 * de un pack a medida lo pone el servidor (lib/comercial/presupuesto-ia.ts).
 */
function bloqueArmado(packs: AgencySettings["packs"], ejemplos: string) {
  const lista = packs
    .map(
      (p) =>
        `- "${p.id.toLowerCase()}" · Pack ${p.id}: ${pesos(p.precio)}/mes. ${p.reels} reels + ${p.posts} carruseles + ${p.stories} días de historias, con gestión de pauta.`,
    )
    .join("\n");
  const extras = EXTRAS.map((e) => `- "${e.slug}" · ${e.nombre} (${pesos(e.precioSugerido)}/mes): ${e.resumen}`).join("\n");
  return `

# ADEMÁS, ELEGÍS QUÉ LE PROPONEMOS
Esta propuesta la arma un vendedor después de hablar con el cliente. Además del texto, decidís el armado.

## Packs de lista
${lista}

## Pack a medida
Para quien no llega al pack más chico (negocio chico, presupuesto ajustado) o necesita otro volumen. Vos elegís el volumen; el precio lo calcula el sistema para que la cuenta deje al menos el ${MARGEN_MINIMO}% de margen. Precios de referencia:
${ejemplos}

## Cómo elegir
- Por defecto, el pack de lista que mejor le calce. El pack a medida es la excepción, no la regla.
- Si dijo un presupuesto o que no le alcanza, armá lo que entre en ese número: un pack a medida con menos volumen o sin gestión de pauta. Nunca prometas un precio por debajo de los de referencia.
- Si necesita más que un pack, elegí el pack más grande que necesite: el volumen extra se habla aparte.
- Extras opcionales (solo si en la charla apareció la necesidad, si no, ninguno):
${extras}

## Campos que agregás al JSON
"rubro": "Rubro del negocio en 2 a 4 palabras (ej. 'perfumería', 'estudio jurídico').",
"armado": {"tipo": "pack", "pack": "presencia"} o {"tipo": "medida", "reels": 2, "posts": 2, "dias_historias": 8, "con_pauta": true, "precio_sugerido": 300000},
"extras": ["slug", ...],
"por_que": "2 o 3 oraciones PARA EL VENDEDOR (no se publica): por qué este armado y qué decir si objeta el precio.",
"mensaje_whatsapp": "Mensaje corto para mandarle la propuesta por WhatsApp, de vos, cálido y sin emojis de más. Poné [LINK] donde va el link. Sin precios: están en la propuesta."`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 500 });
  }
  const me = await requireUser();
  if (!userInRoles(me, PUEDEN) && !userHas(me, "comercial")) {
    return NextResponse.json({ error: "No tenés permiso." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    empresa?: string;
    contacto?: string;
    ciudad?: string;
    instagram?: string;
    web?: string;
    presupuesto?: string;
    contexto?: string;
    transcripcion?: string;
    images?: ImageInput[];
  };
  const empresa = (body.empresa ?? "").trim().slice(0, 160);
  if (!empresa) return NextResponse.json({ error: "Falta el nombre del negocio." }, { status: 400 });

  const transcripcion = (body.transcripcion ?? "").trim().slice(0, 60000);
  const contexto = (body.contexto ?? "").trim().slice(0, 8000);
  const instagram = (body.instagram ?? "").trim().slice(0, 120);
  const web = (body.web ?? "").trim().slice(0, 300);
  const imgs = imageBlocks(body.images);
  if (!transcripcion && !contexto && !instagram && !web && imgs.length === 0) {
    return NextResponse.json(
      { error: "Pegá la transcripción, contá algo del cliente o cargá su Instagram o su web." },
      { status: 400 },
    );
  }

  // El link se arma con el dominio desde el que se está usando la app.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origen = `${proto}://${host}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* cerrado */
        }
      }, 10_000);

      try {
        const admin = createAdmin();
        send({ type: "paso", texto: web ? "Leyendo su web…" : "Preparando…" });
        const [{ data: raw }, catalogo, sitio] = await Promise.all([
          admin.from("agency_settings").select("packs, rates, precios_referencia").eq("id", 1).maybeSingle(),
          cargarCatalogoServicios(),
          leerSitio(web || null),
        ]);
        const settings = mergeSettings(raw as Partial<AgencySettings> | null);
        const { packs, rates } = settings;

        // Sin reunión, la propuesta se escribe como en frío: buscando al negocio.
        const frio = !transcripcion;
        const buscar = frio || !!(instagram || web);
        const servicios = catalogo.map((s) => `- ${s.nombre}: ${s.descripcion ?? ""}`).join("\n");
        const system =
          reglasPropuesta(servicios) + (frio ? BLOQUE_FRIO : "") + bloqueArmado(packs, ejemplosMedida(rates, packs));

        const datos = [
          `Negocio: ${empresa}`,
          body.contacto?.trim() ? `Persona: ${body.contacto.trim().slice(0, 120)}` : null,
          body.ciudad?.trim() ? `Ciudad: ${body.ciudad.trim().slice(0, 120)}` : null,
          bloqueDeContextoWeb(sitio, instagram || null) || null,
          buscar && !frio
            ? "Podés usar la búsqueda web (como mucho 3 búsquedas) para ver su Instagram y su web."
            : null,
          body.presupuesto?.trim()
            ? `Presupuesto que mencionó el cliente: ${body.presupuesto.trim().slice(0, 200)}`
            : null,
          contexto ? `\nLo que cuenta el vendedor:\n"""\n${contexto}\n"""` : null,
          transcripcion ? `\nTranscripción de la reunión:\n"""\n${transcripcion}\n"""` : null,
          imgs.length ? `\n(Se adjuntan ${imgs.length} captura/s: su perfil, el chat o lo que mandó el vendedor.)` : null,
        ]
          .filter(Boolean)
          .join("\n");

        send({ type: "paso", texto: buscar ? "Mirando su Instagram y pensando la propuesta…" : "Pensando la propuesta…" });
        const messages: Anthropic.MessageParam[] = [{ role: "user", content: [...imgs, { type: "text", text: datos }] }];
        const pedir = () =>
          client.messages.create({
            model: MODEL,
            max_tokens: 4000,
            system,
            messages,
            ...(buscar
              ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 }] }
              : {}),
          });
        let res = await pedir();
        // Con búsqueda web el modelo puede pausar el turno: se le deja seguir.
        for (let i = 0; i < 3 && res.stop_reason === "pause_turn"; i++) {
          messages.push({ role: "assistant", content: res.content });
          res = await pedir();
        }
        void trackAiUsage({ ruta: "comercial/presupuesto", modelo: MODEL, usage: res.usage, userId: me.id });

        const texto = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
        const r = parsearJsonIa(texto);
        if (!r) {
          send({ type: "error", error: "La IA no devolvió un formato usable. Probá de nuevo." });
          return;
        }

        const armado = resolverArmado(r.armado as ArmadoCrudo, rates, packs);
        const extras = extrasDeIa(r.extras);
        const handle = !instagram
          ? empresa
          : instagram.includes("/")
            ? handleBonito(instagram)
            : `@${instagram.replace(/^@/, "")}`;

        send({ type: "paso", texto: "Armando la propuesta…" });
        const creada = await insertarPropuesta(
          {
            empresa,
            contactoNombre: body.contacto,
            rubroTexto: typeof r.rubro === "string" ? r.rubro : null,
            packSugerido: armado.packSlug,
            sitioWeb: web || null,
            instagram: instagram || null,
            ciudad: body.ciudad,
            cuentas: [cuentaDeArmado(armado, handle)],
            contexto: [contexto, transcripcion].filter(Boolean).join("\n\n---\n\n") || null,
            extras,
          },
          me.id,
        );
        if ("error" in creada) {
          send({ type: "error", error: creada.error });
          return;
        }

        const ia = bloqueIaDesde(r, { frio });
        await admin
          .from("proposals")
          .update({ ia, notas: transcripcion || contexto || null, updated_at: new Date().toISOString() })
          .eq("id", creada.id);

        const url = urlPropuesta(origen, creada.token);
        const mensaje =
          typeof r.mensaje_whatsapp === "string" && r.mensaje_whatsapp.trim()
            ? r.mensaje_whatsapp.trim().slice(0, 1500)
            : `Hola! Te paso la propuesta para ${empresa}: [LINK]`;
        const extrasLineas = extras.map((x) => ({
          nombre: EXTRAS.find((e) => e.slug === x.slug)?.nombre ?? x.slug,
          precio: x.precio,
        }));

        send({
          type: "done",
          id: creada.id,
          url,
          mensaje: mensaje.includes("[LINK]") ? mensaje.replace("[LINK]", url) : `${mensaje}\n\n${url}`,
          resumen: {
            tipo: armado.tipo,
            nombre: armado.nombre,
            precio: armado.precio,
            reels: armado.reels,
            posts: armado.posts,
            dias_historias: armado.dias_historias,
            conPauta: armado.conPauta,
            extras: extrasLineas,
            ajustes: armado.ajustes,
            porQue: typeof r.por_que === "string" ? r.por_que.trim().slice(0, 900) : null,
            titular: ia.titular,
            comision: comisionVendedor(armado.precio, rates),
          },
        });
      } catch (e) {
        console.error("[comercial/presupuesto]", e);
        try {
          send({ type: "error", error: e instanceof Error ? e.message : "Error inesperado" });
        } catch {
          /* cerrado */
        }
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* cerrado */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
