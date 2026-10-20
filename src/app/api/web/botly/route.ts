import { NextResponse } from "next/server";
import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { AI_MODEL_FAST } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { charlaParaModelo, POR_PERSONA_DIA, RUTA_USO, SISTEMA_BOTLY, TOTAL_DIA } from "@/lib/web/botly-demo";

export const dynamic = "force-dynamic";

/**
 * «Probá Botly» de jdmedia.com.ar (20/10/2026). Pública: el visitante charla
 * con Botly. Topes: 20 mensajes por persona por día (en memoria de la
 * instancia: alcanza para frenar a uno que se entusiasma) y 300 por día entre
 * todos, contados en ai_usage, que es el techo real del gasto.
 */
const porPersona = new Map<string, { dia: string; n: number }>();

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const responder = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
  const ocupado = "Botly se tomó un respiro. Escribinos por WhatsApp y te responde el equipo.";

  let cuerpo: unknown;
  try {
    // La web manda texto plano para evitar el preflight.
    cuerpo = JSON.parse(await req.text());
  } catch {
    return responder({ ok: false, motivo: "formato" }, 400);
  }
  const mensajes = charlaParaModelo((cuerpo as { mensajes?: unknown } | null)?.mensajes);
  if (!mensajes) return responder({ ok: false, motivo: "formato", mensaje: "Escribí tu pregunta y probá de nuevo." }, 400);
  if (!process.env.ANTHROPIC_API_KEY) return responder({ ok: false, motivo: "ocupado", mensaje: ocupado }, 503);

  const dia = new Date().toISOString().slice(0, 10);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  const clave = createHash("sha256").update(`jdm-botly:${ip}`).digest("hex").slice(0, 24);
  const mio = porPersona.get(clave);
  const usados = mio?.dia === dia ? mio.n : 0;
  if (usados >= POR_PERSONA_DIA)
    return responder({ ok: false, motivo: "limite", mensaje: "Ya charlaste un montón con Botly hoy 🙌 Seguimos por WhatsApp con el equipo." }, 429);

  try {
    const { count } = await createAdmin()
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("ruta", RUTA_USO)
      .gte("created_at", `${dia}T00:00:00Z`);
    if ((count ?? 0) >= TOTAL_DIA) return responder({ ok: false, motivo: "ocupado", mensaje: ocupado }, 503);
  } catch {
    // Si no se puede contar, se sigue: el tope por persona sigue andando.
  }

  try {
    const res = await new Anthropic().messages.create({
      model: AI_MODEL_FAST,
      max_tokens: 250,
      system: SISTEMA_BOTLY,
      messages: mensajes,
    });
    porPersona.set(clave, { dia, n: usados + 1 });
    await trackAiUsage({ ruta: RUTA_USO, modelo: AI_MODEL_FAST, usage: res.usage });
    const texto = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (res.stop_reason === "refusal" || !texto)
      return responder({ ok: true, texto: "De eso no te puedo ayudar, pero sí con el marketing de tu negocio. ¿Qué tipo de negocio tenés?" });
    return responder({ ok: true, texto });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return responder({ ok: false, motivo: "ocupado", mensaje: ocupado }, 503);
    console.warn("web/botly:", (e as Error).message);
    return responder({ ok: false, motivo: "error", mensaje: ocupado }, 502);
  }
}
