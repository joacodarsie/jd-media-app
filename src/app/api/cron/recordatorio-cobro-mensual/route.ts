import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod, nextPeriod, periodLabel, fmtCurrency } from "@/lib/finanzas";
import { reminderAmount, normalizePhone } from "@/lib/payment-reminder";
import { whatsappApiConfigured, sendPaymentReminderTemplate } from "@/lib/meta/whatsapp";
import { AGENCY } from "@/lib/agency";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Recordatorio de cobro AUTOMÁTICO por WhatsApp (plantilla aprobada por Meta) —
 * corre todos los días, pero solo actúa el ÚLTIMO día del mes (cubre meses de
 * 28 a 31 días sin hardcodear el 28). Cobra el abono del mes SIGUIENTE.
 *
 * Mientras no esté conectada la API de WhatsApp Business (`whatsappApiConfigured`
 * en false: falta el Phone Number ID y/o la plantilla aprobada), no manda nada
 * y no rompe — usá `/finanzas/recordatorios` (el link wa.me manual) hasta que
 * esté todo listo del lado de Meta.
 *
 * Idempotente dentro del mismo día (no duplica notificaciones ni reintenta
 * los envíos exitosos si el cron se disparara dos veces).
 *
 * Autenticación: igual que el resto de los crons (ver due-notifications).
 */

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-cron-secret");
  if (x === secret) return true;
  return false;
}

function isLastDayOfMonth(d: Date): boolean {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() === d.getDate();
}

interface ClientRow {
  id: string;
  nombre: string;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  monto_mensual: number | null;
  contrato_moneda: string | null;
  contrato_descuento_pct: number | null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!isLastDayOfMonth(now)) {
    return NextResponse.json({ ok: true, skipped: "no es el último día del mes" });
  }
  if (!whatsappApiConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "WhatsApp Business API no configurada todavía (WHATSAPP_PHONE_NUMBER_ID / plantilla).",
    });
  }

  const admin = createAdmin();
  const periodo = nextPeriod(currentPeriod()); // se cobra el mes que arranca
  const mes = periodLabel(periodo);
  const messagePrefix = `Recordatorio de cobro automático · ${mes}`;

  // Idempotencia: si ya corrió hoy, no reintenta.
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const { data: already } = await admin
    .from("notifications")
    .select("id")
    .gte("created_at", startOfDay)
    .like("mensaje", `${messagePrefix}%`)
    .limit(1);
  if (already && already.length > 0) {
    return NextResponse.json({ ok: true, skipped: "ya corrió hoy" });
  }

  const { data, error } = await admin
    .from("clients")
    .select(
      "id, nombre, contacto_nombre, contacto_telefono, monto_mensual, contrato_moneda, contrato_descuento_pct"
    )
    .eq("estado", "activo")
    .eq("es_interno", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clients = (data ?? []) as ClientRow[];
  const { alias, nombre: banco, titular } = AGENCY.bank;
  const bancoTitular = `${banco} — ${titular}`;

  let enviados = 0;
  const fallidos: { cliente: string; motivo: string }[] = [];

  for (const c of clients) {
    const telefono = normalizePhone(c.contacto_telefono);
    if (!telefono) {
      fallidos.push({ cliente: c.nombre, motivo: "sin teléfono" });
      continue;
    }
    const { monto, moneda } = reminderAmount(c);
    if (monto <= 0) {
      fallidos.push({ cliente: c.nombre, motivo: "sin monto_mensual cargado" });
      continue;
    }
    const nombreContacto = (c.contacto_nombre ?? "").trim().split(/\s+/)[0] || c.nombre;
    const res = await sendPaymentReminderTemplate({
      telefono,
      nombre: nombreContacto,
      mes,
      montoTxt: fmtCurrency(monto, moneda),
      alias,
      bancoTitular,
    });
    if (res.ok) enviados++;
    else fallidos.push({ cliente: c.nombre, motivo: res.error });
  }

  // Notificación a los admins con el resultado (idempotencia + trazabilidad).
  const { data: admins } = await admin.from("users").select("id").eq("rol", "admin").eq("activo", true);
  const resumen =
    fallidos.length === 0
      ? `${messagePrefix}: ${enviados} enviados, sin fallos.`
      : `${messagePrefix}: ${enviados} enviados, ${fallidos.length} sin enviar (${fallidos
          .slice(0, 5)
          .map((f) => `${f.cliente}: ${f.motivo}`)
          .join("; ")}${fallidos.length > 5 ? "…" : ""}).`;
  const rows = ((admins ?? []) as { id: string }[]).map((a) => ({
    user_id: a.id,
    tipo: "recordatorio" as const,
    mensaje: resumen,
    leida: false,
  }));
  if (rows.length > 0) await admin.from("notifications").insert(rows);

  return NextResponse.json({ ok: true, periodo, enviados, fallidos });
}
