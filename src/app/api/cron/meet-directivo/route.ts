import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Recordatorio de la REUNIÓN DIRECTIVA QUINCENAL (Bri + Luz + Dirección) —
 * lunes 18hs Argentina (cron a las 21:00 UTC de cada lunes). Como Vercel Cron no
 * hace "un lunes sí y otro no", corre TODOS los lunes y el route deja pasar solo
 * las semanas pares desde un lunes ancla (ciclo quincenal).
 *
 * Manda notificación in-app + push a la coordinación general (Luz), la
 * coordinación de diseño (Bri) y los admin, con la agenda fija: revisar la
 * identidad visual de las cuentas y que se respete. Idempotente por día.
 */

// Lunes ancla del ciclo quincenal (semana 0). Los recordatorios caen en las
// semanas pares desde acá: 2026-07-06, 07-20, 08-03, ...
const ANCHOR_MONDAY_UTC = Date.UTC(2026, 6, 6);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // El cron corre 21:00 UTC (= 18:00 ART) del lunes: la fecha UTC ya es lunes.
  const mondayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const weeks = Math.round((mondayUtc - ANCHOR_MONDAY_UTC) / WEEK_MS);
  if (weeks % 2 !== 0) {
    return NextResponse.json({ ok: true, skipped: "semana impar (quincenal)" });
  }

  const admin = createAdmin();

  // Destinatarios: coordinación general (Luz), coordinación de diseño (Bri) y admin.
  const { data: usersRaw, error } = await admin
    .from("users")
    .select("id, rol, rol_secundario")
    .eq("activo", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roles = new Set(["admin", "coordinador", "coordinador_diseno"]);
  const recipients = ((usersRaw ?? []) as { id: string; rol: string; rol_secundario: string | null }[])
    .filter((u) => roles.has(u.rol) || (u.rol_secundario ? roles.has(u.rol_secundario) : false))
    .map((u) => u.id);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, notified: 0, note: "sin destinatarios" });
  }

  const mensaje =
    "Reunión directiva quincenal — hoy 18hs. Con Bri y Luz: revisar la identidad visual de las cuentas y que se respete en cada una.";

  // Idempotencia: si ya se notificó hoy, no duplicar.
  const startOfDay = new Date(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ).toISOString();
  const { data: already } = await admin
    .from("notifications")
    .select("id")
    .gte("created_at", startOfDay)
    .like("mensaje", "Reunión directiva quincenal%")
    .limit(1);
  if (already && already.length > 0) {
    return NextResponse.json({ ok: true, skipped: "ya notificado hoy" });
  }

  const rows = recipients.map((uid) => ({
    user_id: uid,
    tipo: "recordatorio" as const,
    mensaje,
    leida: false,
  }));
  const { error: insErr } = await admin.from("notifications").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await sendPushToUsers(recipients, {
    title: "Reunión directiva quincenal · 18hs",
    body: "Con Bri y Luz: revisar la identidad visual de las cuentas.",
    url: "/dashboard",
    tag: "meet-directivo",
  }).catch(() => {});

  return NextResponse.json({ ok: true, notified: recipients.length });
}
