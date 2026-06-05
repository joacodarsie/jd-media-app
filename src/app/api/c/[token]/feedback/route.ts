import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/c/[token]/feedback
 *
 * Endpoint público del Cliente Portal. Sin auth de Supabase: el token
 * es la unica credencial. Permite al cliente:
 *   - Aprobar una publicación
 *   - Pedir cambios (rechazar con motivo)
 *   - Dejar un comentario libre
 *
 * Body JSON:
 *   - publication_id: UUID
 *   - tipo: "aprobar" | "rechazar" | "comentar"
 *   - mensaje: string (obligatorio para rechazar/comentar; opcional para aprobar)
 *
 * Validaciones:
 *   - Token activo y no revocado
 *   - Publication pertenece al mismo cliente del token
 *   - Estado actual permite acción (no se aprueba lo ya publicado)
 *   - Rate limit básico: max 30 actions/minuto por token (memoria del lambda; mejor que nada)
 */

// Rate limit muy simple — solo dentro del lifetime de la lambda.
// Para producción seria: Upstash Redis o Vercel KV.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(token);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(token, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  if (!checkRateLimit(params.token)) {
    return NextResponse.json({ error: "Demasiadas acciones, esperá un minuto." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as {
    publication_id?: string;
    tipo?: "aprobar" | "rechazar" | "comentar";
    mensaje?: string;
  } | null;

  if (!body?.publication_id || !body.tipo) {
    return NextResponse.json({ error: "Faltan publication_id o tipo." }, { status: 400 });
  }
  if ((body.tipo === "rechazar" || body.tipo === "comentar") && !body.mensaje?.trim()) {
    return NextResponse.json({ error: "Necesitamos un mensaje para esta acción." }, { status: 400 });
  }

  const admin = createAdmin();

  // Validar token activo
  const { data: tokenRow } = await admin
    .from("client_portal_tokens")
    .select("id, cliente_id, revoked_at, expires_at")
    .eq("token", params.token)
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked_at) {
    return NextResponse.json({ error: "Link inválido o revocado." }, { status: 403 });
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expirado." }, { status: 403 });
  }

  // Validar que la pub pertenece al mismo cliente del token
  const { data: pub } = await admin
    .from("publications")
    .select("id, cliente_id, estado, titulo, creado_por_id, audiovisual_id")
    .eq("id", body.publication_id)
    .maybeSingle();

  if (!pub || pub.cliente_id !== tokenRow.cliente_id) {
    return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
  }

  // Para aprobar/rechazar, la pub tiene que estar en revisión cliente o aprobada.
  const accionCambiaEstado = body.tipo === "aprobar" || body.tipo === "rechazar";
  if (accionCambiaEstado) {
    if (pub.estado === "publicado") {
      return NextResponse.json(
        { error: "Esta publicación ya fue publicada." },
        { status: 409 }
      );
    }
    if (pub.estado !== "revision_cliente" && pub.estado !== "aprobado" && pub.estado !== "rechazado") {
      return NextResponse.json(
        { error: "Esta pieza todavía no está lista para revisar." },
        { status: 409 }
      );
    }
  }

  // Touch last_seen del token
  await admin
    .from("client_portal_tokens")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  // Guardar comentario si hay mensaje
  if (body.mensaje?.trim()) {
    const prefix =
      body.tipo === "aprobar"
        ? "✓ Aprobado por el cliente"
        : body.tipo === "rechazar"
        ? "⚠ Cliente pide cambios"
        : "💬 Cliente comentó";
    await admin.from("client_pub_comments").insert({
      publication_id: pub.id,
      cliente_id: pub.cliente_id,
      contenido: `${prefix}: ${body.mensaje.trim()}`,
    });
  } else if (body.tipo === "aprobar") {
    // Aprobado sin mensaje, guardamos igual una nota corta
    await admin.from("client_pub_comments").insert({
      publication_id: pub.id,
      cliente_id: pub.cliente_id,
      contenido: "✓ Aprobado por el cliente desde el portal.",
    });
  }

  // Cambiar estado si corresponde
  if (accionCambiaEstado) {
    const nuevoEstado = body.tipo === "aprobar" ? "aprobado" : "rechazado";
    const updateData: Record<string, unknown> = { estado: nuevoEstado };
    if (body.tipo === "rechazar" && body.mensaje?.trim()) {
      updateData.notas_revision = body.mensaje.trim();
    }
    const { error: updErr } = await admin
      .from("publications")
      .update(updateData)
      .eq("id", pub.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  // Notificar al equipo que lleva la cuenta. El endpoint inserta el comentario
  // directo (no vía RPC), así que la notificación la disparamos acá.
  const { data: clientRow } = await admin
    .from("clients")
    .select("nombre, cm_id, disenador_id, audiovisual_id")
    .eq("id", pub.cliente_id)
    .maybeSingle();

  const recipients = new Set<string>(
    [
      pub.creado_por_id,
      pub.audiovisual_id,
      clientRow?.cm_id,
      clientRow?.disenador_id,
      clientRow?.audiovisual_id,
    ].filter((id): id is string => !!id)
  );

  if (recipients.size > 0) {
    const nombreCliente = clientRow?.nombre ?? "El cliente";
    const titulo = pub.titulo ?? "una pieza";
    const mensaje =
      body.tipo === "aprobar"
        ? `✅ ${nombreCliente} aprobó «${titulo}»`
        : body.tipo === "rechazar"
        ? `🔄 ${nombreCliente} pidió cambios en «${titulo}»`
        : `💬 ${nombreCliente} comentó en «${titulo}»`;
    const link = `/contenidos?cliente=${pub.cliente_id}`;
    await admin.from("notifications").insert(
      [...recipients].map((uid) => ({
        user_id: uid,
        tipo: "comentario",
        mensaje,
        link,
        task_id: null,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
