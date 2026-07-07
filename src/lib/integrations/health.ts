import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshGmailToken } from "@/lib/gmail";
import { refreshAccessToken } from "@/lib/google-calendar";

/**
 * Semáforo de integraciones de GOOGLE (Gmail de reclutamiento + conexiones de
 * Calendar). Complementa a checkMetaToken (lib/meta/health.ts).
 *
 * Corre en el cron diario: INTENTA refrescar cada token. Dos efectos:
 *  - si el refresh anda, el access_token queda fresco (la próxima vez que
 *    alguien use Reclutamiento/Agenda no espera el refresh);
 *  - si el refresh falla (refresh token vencido/revocado — p.ej. la app OAuth
 *    en modo "Testing" los vence a los 7 días), lo detectamos ESE día y
 *    avisamos, en vez de que el user se entere cuando la sección no anda.
 */

export interface GoogleHealthItem {
  kind: "gmail" | "calendar";
  label: string;
  ok: boolean;
  error?: string;
}

export interface GoogleHealthStatus {
  checked: number;
  broken: GoogleHealthItem[];
  items: GoogleHealthItem[];
}

export async function checkGoogleHealth(
  admin: SupabaseClient
): Promise<GoogleHealthStatus> {
  const items: GoogleHealthItem[] = [];

  // ── Gmail de reclutamiento (singleton) ──
  const { data: gmail } = await admin
    .from("gmail_account")
    .select("id, email, refresh_token")
    .eq("id", 1)
    .maybeSingle();

  if (gmail?.refresh_token) {
    const label = `Gmail (${(gmail as { email?: string }).email ?? "reclutamiento"})`;
    try {
      const t = await refreshGmailToken((gmail as { refresh_token: string }).refresh_token);
      await admin
        .from("gmail_account")
        .update({
          access_token: t.access_token,
          token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
        })
        .eq("id", 1);
      items.push({ kind: "gmail", label, ok: true });
    } catch (e) {
      items.push({
        kind: "gmail",
        label,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // ── Conexiones de Google Calendar ──
  const { data: conns } = await admin
    .from("google_calendar_connections")
    .select("id, google_email, refresh_token");

  for (const conn of (conns ?? []) as {
    id: string;
    google_email: string | null;
    refresh_token: string;
  }[]) {
    const label = `Calendar (${conn.google_email ?? conn.id.slice(0, 8)})`;
    try {
      const t = await refreshAccessToken(conn.refresh_token);
      await admin
        .from("google_calendar_connections")
        .update({
          access_token: t.access_token,
          token_expiry: new Date(Date.now() + t.expires_in * 1000).toISOString(),
        })
        .eq("id", conn.id);
      items.push({ kind: "calendar", label, ok: true });
    } catch (e) {
      items.push({
        kind: "calendar",
        label,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    checked: items.length,
    broken: items.filter((i) => !i.ok),
    items,
  };
}

/**
 * Notifica a los admins las integraciones de Google caídas (una notificación
 * por día, deduplicada 20h — mismo patrón que el aviso del token de Meta).
 */
export async function notifyGoogleHealth(
  admin: SupabaseClient,
  status: GoogleHealthStatus
): Promise<number> {
  if (status.broken.length === 0) return 0;

  const detalle = status.broken.map((b) => b.label).join(", ");
  const dondeReconectar = status.broken.some((b) => b.kind === "gmail")
    ? "/reclutamiento"
    : "/agenda";
  const msg = `⚠️ Google: se desconectó ${detalle}. Entrá y tocá "Reconectar" para que siga trayendo datos.`;

  const { data: adminsRaw } = await admin
    .from("users")
    .select("id")
    .eq("activo", true)
    .eq("rol", "admin");
  const adminIds = ((adminsRaw ?? []) as { id: string }[]).map((a) => a.id);
  if (adminIds.length === 0) return 0;

  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString();
  const { data: existing } = await admin
    .from("notifications")
    .select("user_id")
    .like("mensaje", "⚠️ Google:%")
    .gte("created_at", since);
  const already = new Set(
    ((existing ?? []) as { user_id: string }[]).map((n) => n.user_id)
  );

  const rows = adminIds
    .filter((id) => !already.has(id))
    .map((id) => ({
      user_id: id,
      tipo: "recordatorio" as const,
      mensaje: msg,
      leida: false,
      link: dondeReconectar,
    }));
  if (rows.length > 0) await admin.from("notifications").insert(rows);
  return rows.length;
}
