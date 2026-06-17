/**
 * Alertas de cuentas: corre en el cron diario y avisa cuando una cuenta da
 * señales malas, para actuar a tiempo. Hoy detecta:
 *   1. Instagram perdiendo seguidores en la semana.
 *   2. Pauta gastando sin conversiones (últimos 3 días).
 * Notifica a los admins + al asignado de la cuenta (CM o media buyer). Deduplica
 * por mensaje en las últimas 20h para no spamear.
 */
import { createAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdmin>;

interface Alert {
  clienteId: string;
  mensaje: string;
  extra: (string | null)[]; // destinatarios además de los admins
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export async function runAccountAlerts(
  admin: Admin
): Promise<{ alerts: number; notified: number }> {
  const alerts: Alert[] = [];

  // ── 1) Instagram: pérdida de seguidores en la semana ──
  const { data: igClientsRaw } = await admin
    .from("clients")
    .select("id, nombre, cm_id")
    .not("ig_user_id", "is", null)
    .eq("estado", "activo");
  const igClients = (igClientsRaw ?? []) as { id: string; nombre: string; cm_id: string | null }[];
  if (igClients.length > 0) {
    const { data: snapsRaw } = await admin
      .from("ig_snapshots")
      .select("cliente_id, fecha, followers")
      .in("cliente_id", igClients.map((c) => c.id))
      .gte("fecha", isoDaysAgo(9))
      .order("fecha", { ascending: true });
    const byC = new Map<string, { fecha: string; followers: number }[]>();
    for (const s of (snapsRaw ?? []) as { cliente_id: string; fecha: string; followers: number }[]) {
      const a = byC.get(s.cliente_id) ?? [];
      a.push({ fecha: s.fecha, followers: s.followers });
      byC.set(s.cliente_id, a);
    }
    for (const c of igClients) {
      const arr = byC.get(c.id) ?? [];
      if (arr.length < 2) continue;
      const prev = arr[0];
      const last = arr[arr.length - 1];
      const loss = prev.followers - last.followers;
      const umbral = Math.max(5, Math.round(prev.followers * 0.01)); // 1% o 5, lo mayor
      if (loss >= umbral) {
        alerts.push({
          clienteId: c.id,
          mensaje: `📉 ${c.nombre}: perdió ${loss} seguidores esta semana (de ${prev.followers} a ${last.followers}). Revisá qué pasó.`,
          extra: [c.cm_id],
        });
      }
    }
  }

  // ── 2) Pauta: gasto sin conversiones (últimos 3 días) ──
  const { data: adsRaw } = await admin
    .from("client_ads_onboarding")
    .select("cliente_id, meta_ad_account_id")
    .not("meta_ad_account_id", "is", null);
  const adIds = ((adsRaw ?? []) as { cliente_id: string }[]).map((a) => a.cliente_id);
  if (adIds.length > 0) {
    const [{ data: pSnapsRaw }, { data: pClientsRaw }] = await Promise.all([
      admin
        .from("paid_media_snapshots")
        .select("cliente_id, spend, conversions, moneda")
        .in("cliente_id", adIds)
        .gte("fecha", isoDaysAgo(3)),
      admin.from("clients").select("id, nombre, media_buyer_id, estado").in("id", adIds),
    ]);
    const info = new Map<string, { nombre: string; media_buyer_id: string | null; estado: string }>();
    for (const c of (pClientsRaw ?? []) as {
      id: string;
      nombre: string;
      media_buyer_id: string | null;
      estado: string;
    }[])
      info.set(c.id, { nombre: c.nombre, media_buyer_id: c.media_buyer_id, estado: c.estado });
    const agg = new Map<string, { spend: number; conv: number; moneda: string }>();
    for (const s of (pSnapsRaw ?? []) as {
      cliente_id: string;
      spend: number;
      conversions: number;
      moneda: string;
    }[]) {
      const a = agg.get(s.cliente_id) ?? { spend: 0, conv: 0, moneda: "ARS" };
      a.spend += Number(s.spend);
      a.conv += Number(s.conversions);
      a.moneda = s.moneda || a.moneda;
      agg.set(s.cliente_id, a);
    }
    for (const [cid, a] of agg) {
      const c = info.get(cid);
      if (!c || c.estado !== "activo") continue;
      if (a.spend > 0 && a.conv === 0) {
        alerts.push({
          clienteId: cid,
          mensaje: `💸 ${c.nombre}: gastó ${a.moneda} ${Math.round(a.spend).toLocaleString(
            "es-AR"
          )} en pauta los últimos 3 días sin conversiones. Revisá las campañas (o confirmá si el objetivo no es conversión).`,
          extra: [c.media_buyer_id],
        });
      }
    }
  }

  if (alerts.length === 0) return { alerts: 0, notified: 0 };

  // Destinatarios: admins + el asignado de cada alerta.
  const { data: adminsRaw } = await admin
    .from("users")
    .select("id")
    .eq("activo", true)
    .eq("rol", "admin");
  const adminIds = ((adminsRaw ?? []) as { id: string }[]).map((a) => a.id);

  // Dedup: mismo mensaje al mismo user en las últimas 20h.
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  const { data: existingRaw } = await admin
    .from("notifications")
    .select("user_id, mensaje")
    .gte("created_at", since);
  const already = new Set(
    ((existingRaw ?? []) as { user_id: string; mensaje: string }[])
      .filter((n) => n.mensaje.startsWith("📉") || n.mensaje.startsWith("💸"))
      .map((n) => `${n.user_id}::${n.mensaje}`)
  );

  const rows: {
    user_id: string;
    tipo: "recordatorio";
    mensaje: string;
    leida: boolean;
    link: string;
  }[] = [];
  for (const al of alerts) {
    const recipients = new Set<string>([
      ...adminIds,
      ...(al.extra.filter(Boolean) as string[]),
    ]);
    for (const uid of recipients) {
      if (already.has(`${uid}::${al.mensaje}`)) continue;
      rows.push({
        user_id: uid,
        tipo: "recordatorio",
        mensaje: al.mensaje,
        leida: false,
        link: `/clientes/${al.clienteId}/resultados`,
      });
    }
  }
  if (rows.length > 0) await admin.from("notifications").insert(rows);
  return { alerts: alerts.length, notified: rows.length };
}
