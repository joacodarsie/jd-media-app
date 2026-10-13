import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Alguien deja su mail en la web para descargar un recurso gratuito
 * (12/10/2026). Entra como contacto en Comercial (`leads`, origen "web"): cada
 * descarga es una conversación posible. Si el mail ya estaba, se le suma la
 * descarga a las notas en vez de duplicarlo.
 */
export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  let body: { nombre?: string; email?: string; empresa?: string; recurso?: string; web?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400, headers });
  }
  // Campo trampa: los humanos no lo ven, los bots lo completan.
  if (body.web) return NextResponse.json({ ok: true }, { headers });

  const nombre = (body.nombre ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 200);
  const empresa = (body.empresa ?? "").trim().slice(0, 160) || null;
  const recurso = (body.recurso ?? "").trim().slice(0, 160) || "un recurso";
  if (nombre.length < 2) return NextResponse.json({ error: "Poné tu nombre." }, { status: 400, headers });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Revisá el mail." }, { status: 400, headers });

  const admin = createAdmin();
  const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba" });
  const linea = `${hoy}: descargó «${recurso}» desde la web.`;
  const { data: existe } = await admin.from("leads").select("id, notas").eq("email", email).limit(1).maybeSingle();
  if (existe) {
    const notas = [(existe as { notas: string | null }).notas, linea].filter(Boolean).join("\n");
    await admin.from("leads").update({ notas }).eq("id", (existe as { id: string }).id);
  } else {
    const { error } = await admin.from("leads").insert({
      nombre,
      email,
      empresa,
      origen: "web",
      notas: linea,
    });
    if (error) return NextResponse.json({ error: "No se pudo guardar. Probá de nuevo." }, { status: 500, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}
