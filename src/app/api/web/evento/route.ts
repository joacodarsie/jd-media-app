import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { fuenteDe, TIPOS_EVENTO, type TipoEvento } from "@/lib/web/embudo";

export const dynamic = "force-dynamic";

/**
 * La web avisa una visita o un clic importante (13/10/2026). Llega por
 * `navigator.sendBeacon` como texto (así no hay preflight de CORS). Solo
 * conteos: tipo, página y de dónde vino. Nada que identifique a una persona.
 */
export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  let body: { tipo?: string; pagina?: string; utm?: string; ref?: string } = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 204, headers });
  }
  const tipo = body.tipo as TipoEvento;
  if (!TIPOS_EVENTO.includes(tipo)) return new NextResponse(null, { status: 204, headers });
  await createAdmin()
    .from("web_eventos")
    .insert({
      tipo,
      pagina: (body.pagina ?? "").slice(0, 120) || null,
      fuente: fuenteDe(body.utm?.slice(0, 60), body.ref?.slice(0, 300)),
    });
  return new NextResponse(null, { status: 204, headers });
}
