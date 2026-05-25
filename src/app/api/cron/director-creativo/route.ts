import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { PACK_QUOTAS, type PackId } from "@/lib/content-plans/packs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Director Creativo Autónomo — corre semanalmente (lunes).
 *
 * Para cada cliente activo con plan de contenido activo:
 *  1. Calcula cuota mensual esperada según pack
 *  2. Cuenta pubs ya creadas/programadas para este mes
 *  3. Mira pubs próximas 2 semanas (pipeline)
 *  4. Detecta brechas:
 *     - Faltan piezas para llegar a la cuota (cumplimiento del plan)
 *     - Próximas 2 semanas con calendario flojo (<3 pubs)
 *  5. Notifica al CM + creativa asignada + admins con CTA al plan/calendario
 *
 * Idempotente dentro del mismo día.
 *
 * Auth: header Authorization: Bearer <CRON_SECRET>
 */

interface ClientLite {
  id: string;
  nombre: string;
  pack: string | null;
  cm_id: string | null;
  creativa_asignada_id: string | null;
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret");
  return x === secret;
}

function startOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function endOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdmin();
  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 86400000);
  const monthStart = startOfMonthISO(now);
  const monthEnd = endOfMonthISO(now);

  // 1) Clientes activos con plan activo
  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, pack, cm_id, creativa_asignada_id")
    .eq("estado", "activo");
  const clients = (clientsRaw ?? []) as ClientLite[];
  if (clients.length === 0) {
    return NextResponse.json({ ok: true, analyzed: 0, notified: 0 });
  }
  const clientIds = clients.map((c) => c.id);

  // 2) Pubs del mes vigente + pubs próximas 14 días por cliente
  const [{ data: monthPubsRaw }, { data: nextPubsRaw }] = await Promise.all([
    admin
      .from("publications")
      .select("id, cliente_id, tipo, estado, fecha_publicacion")
      .in("cliente_id", clientIds)
      .gte("fecha_publicacion", monthStart)
      .lte("fecha_publicacion", monthEnd),
    admin
      .from("publications")
      .select("id, cliente_id, fecha_publicacion, estado")
      .in("cliente_id", clientIds)
      .gte("fecha_publicacion", now.toISOString())
      .lte("fecha_publicacion", in14d.toISOString())
      .not("estado", "in", "(rechazado)"),
  ]);
  const monthPubs = (monthPubsRaw ?? []) as {
    cliente_id: string;
    tipo: string;
    estado: string;
  }[];
  const nextPubs = (nextPubsRaw ?? []) as {
    cliente_id: string;
  }[];

  // 3) Admins para fallback de notificación
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .eq("rol", "admin")
    .eq("activo", true);
  const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);

  // 4) Idempotencia: notifs ya enviadas hoy con prefijo del director
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const prefix = "🎬 Director:";
  const { data: existing } = await admin
    .from("notifications")
    .select("user_id, mensaje")
    .gte("created_at", startOfDay)
    .like("mensaje", `${prefix}%`);
  const alreadyKey = new Set<string>(
    ((existing ?? []) as { user_id: string; mensaje: string }[]).map(
      (n) => `${n.user_id}::${n.mensaje}`
    )
  );

  // 5) Para cada cliente, calcular brechas
  const insights: {
    cliente: string;
    mensaje: string;
    recipients: string[];
  }[] = [];

  for (const c of clients) {
    const pack = (c.pack as PackId | null) ?? null;
    if (!pack || pack === "Personalizado") continue;
    const quota = PACK_QUOTAS[pack as Exclude<PackId, "Personalizado">];
    if (!quota) continue;

    const mine = monthPubs.filter((p) => p.cliente_id === c.id);
    const reelsMes = mine.filter(
      (p) => p.tipo === "reel" || p.tipo === "video"
    ).length;
    const postsMes = mine.filter(
      (p) => p.tipo === "post" || p.tipo === "carrusel"
    ).length;
    const faltanReels = Math.max(0, quota.reels - reelsMes);
    const faltanPosts = Math.max(0, quota.posts - postsMes);
    const totalFaltan = faltanReels + faltanPosts;

    const pipelineNext = nextPubs.filter((p) => p.cliente_id === c.id).length;
    const calendarioFlojo = pipelineNext < 3;

    if (totalFaltan === 0 && !calendarioFlojo) continue;

    const partes: string[] = [];
    if (totalFaltan > 0) {
      const lista: string[] = [];
      if (faltanReels > 0)
        lista.push(`${faltanReels} reel${faltanReels === 1 ? "" : "s"}`);
      if (faltanPosts > 0)
        lista.push(`${faltanPosts} post${faltanPosts === 1 ? "" : "s"}`);
      partes.push(`faltan ${lista.join(" y ")} este mes`);
    }
    if (calendarioFlojo) {
      partes.push(
        `próximas 2 semanas con ${pipelineNext} pub${pipelineNext === 1 ? "" : "s"} programada${pipelineNext === 1 ? "" : "s"}`
      );
    }

    const mensaje = `${prefix} ${c.nombre} — ${partes.join(", ")}.`;

    const recipients = new Set<string>();
    if (c.cm_id) recipients.add(c.cm_id);
    if (c.creativa_asignada_id) recipients.add(c.creativa_asignada_id);
    if (recipients.size === 0) {
      for (const a of adminIds) recipients.add(a);
    }

    insights.push({
      cliente: c.nombre,
      mensaje,
      recipients: Array.from(recipients),
    });
  }

  if (insights.length === 0) {
    return NextResponse.json({
      ok: true,
      analyzed: clients.length,
      notified: 0,
      note: "todos al día",
    });
  }

  // 6) Insertar notificaciones (filtrando duplicados del día)
  const rows: { user_id: string; tipo: "recordatorio"; mensaje: string; leida: boolean }[] = [];
  for (const i of insights) {
    for (const uid of i.recipients) {
      const key = `${uid}::${i.mensaje}`;
      if (alreadyKey.has(key)) continue;
      rows.push({
        user_id: uid,
        tipo: "recordatorio",
        mensaje: i.mensaje,
        leida: false,
      });
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      analyzed: clients.length,
      insights: insights.length,
      notified: 0,
      note: "ya estaban notificados hoy",
    });
  }

  const { error: insErr } = await admin.from("notifications").insert(rows);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    analyzed: clients.length,
    insights: insights.length,
    notified: rows.length,
    detalle: insights.map((i) => ({ cliente: i.cliente, mensaje: i.mensaje })),
  });
}
