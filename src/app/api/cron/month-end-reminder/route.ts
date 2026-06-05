import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Recordatorio de fin de mes — corre el día 25 de cada mes.
 *
 * Detecta clientes activos que todavía no tienen plan de contenido para el
 * mes siguiente y dispara una notificación in-app a:
 *   - el CM asignado al cliente (si tiene)
 *   - los admins de la agencia
 *
 * Idempotente dentro del mismo día (no duplica notificaciones).
 *
 * Autenticación:
 *   - Header Authorization: Bearer <CRON_SECRET> (Vercel Cron envía este header)
 *   - O header x-cron-secret: <CRON_SECRET>
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret");
  if (x === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdmin();

  // Mes siguiente (en hora local Argentina aproximada — el día del cron es lo que importa)
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthName = MESES[next.getMonth()];
  const nextYear = next.getFullYear();
  const periodHint = `${nextMonthName} ${nextYear}`; // ej "junio 2026"

  // 1) Clientes activos
  const { data: clients, error: clientsErr } = await admin
    .from("clients")
    .select("id, nombre, cm_id")
    .eq("estado", "activo");

  if (clientsErr) {
    return NextResponse.json({ error: clientsErr.message }, { status: 500 });
  }
  const clientList = (clients ?? []) as {
    id: string;
    nombre: string;
    cm_id: string | null;
  }[];

  if (clientList.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, missing: [] });
  }

  // 2) Buscar planes ya creados que matcheen el mes siguiente.
  // El periodo_label es texto libre (ej "Junio 2026", "Q2 2026"). Hacemos
  // un match permisivo por nombre del mes y año.
  const clientIds = clientList.map((c) => c.id);
  const { data: plans } = await admin
    .from("client_content_plans")
    .select("cliente_id, periodo_label, status, created_at")
    .in("cliente_id", clientIds);

  const planByClient = new Map<string, boolean>();
  for (const p of (plans ?? []) as {
    cliente_id: string;
    periodo_label: string;
    status: string;
    created_at: string;
  }[]) {
    if (p.status === "archived") continue;
    const lbl = (p.periodo_label || "").toLowerCase();
    if (lbl.includes(nextMonthName) && lbl.includes(String(nextYear))) {
      planByClient.set(p.cliente_id, true);
    }
  }

  const missing = clientList.filter((c) => !planByClient.get(c.id));

  if (missing.length === 0) {
    return NextResponse.json({
      ok: true,
      checked: clientList.length,
      missing: [],
      period: periodHint,
    });
  }

  // 3) Resolver destinatarios: admins activos + CM asignado de cada cliente faltante
  const { data: admins } = await admin
    .from("users")
    .select("id")
    .eq("rol", "admin")
    .eq("activo", true);
  const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);

  // 4) Idempotencia: chequear notificaciones ya creadas hoy con mismo mensaje base
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).toISOString();
  const messagePrefix = `📅 Faltan planes de ${nextMonthName} ${nextYear}:`;
  const { data: existingToday } = await admin
    .from("notifications")
    .select("user_id, mensaje")
    .gte("created_at", startOfDay)
    .like("mensaje", `${messagePrefix}%`);
  const alreadyNotified = new Set(
    ((existingToday ?? []) as { user_id: string }[]).map((n) => n.user_id)
  );

  // 5) Armar mensaje compacto con los primeros nombres
  const names = missing.map((m) => m.nombre);
  const preview =
    names.length <= 3
      ? names.join(", ")
      : `${names.slice(0, 3).join(", ")} y ${names.length - 3} más`;
  const mensaje = `${messagePrefix} ${preview}`;

  const recipients = new Set<string>();
  for (const a of adminIds) recipients.add(a);
  for (const c of missing) {
    if (c.cm_id) recipients.add(c.cm_id);
  }

  const rows = Array.from(recipients)
    .filter((uid) => !alreadyNotified.has(uid))
    .map((uid) => ({
      user_id: uid,
      tipo: "recordatorio" as const,
      mensaje,
      leida: false,
    }));

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      checked: clientList.length,
      missing: missing.map((m) => m.nombre),
      notified: 0,
      period: periodHint,
      note: "ya estaban notificados hoy",
    });
  }

  const { error: insErr } = await admin.from("notifications").insert(rows);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    checked: clientList.length,
    missing: missing.map((m) => m.nombre),
    notified: rows.length,
    period: periodHint,
  });
}
