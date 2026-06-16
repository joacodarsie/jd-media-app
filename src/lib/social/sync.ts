/**
 * Sync de resultados de Instagram: trae las métricas de IG de un cliente y guarda
 * el snapshot del día. Lo usan el botón "Actualizar" (acción) y el cron diario
 * (dentro de due-notifications, para no sumar crons en Hobby).
 *
 * El snapshot diario es barato (solo Graph API, sin IA). El crecimiento de
 * seguidores se reconstruye a partir del histórico de snapshots.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { fetchIgResults, metaConfigured } from "@/lib/meta/instagram";

type Admin = ReturnType<typeof createAdmin>;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sincroniza un cliente: resultados de IG → snapshot del día (upsert).
 * Lanza si Meta/IG falla (la acción lo traduce a mensaje amable).
 */
export async function syncClientInstagram(
  clienteId: string,
  opts?: { admin?: Admin }
): Promise<{ ok: true; followers: number; reach: number } | { error: string }> {
  const admin = opts?.admin ?? createAdmin();

  const { data: client } = await admin
    .from("clients")
    .select("id, nombre, ig_user_id, ig_username")
    .eq("id", clienteId)
    .maybeSingle();

  if (!client) return { error: "Cliente no encontrado." };
  const igUserId = (client as { ig_user_id?: string | null }).ig_user_id;
  if (!igUserId)
    return { error: "El cliente no tiene conectada su cuenta de Instagram." };

  const r = await fetchIgResults(igUserId);
  const fecha = todayISO();

  await admin.from("ig_snapshots").upsert(
    {
      cliente_id: clienteId,
      fecha,
      followers: r.profile.followers,
      follows: r.profile.follows,
      media_count: r.profile.media_count,
      reach: r.day.reach,
      profile_views: r.day.profile_views,
      interactions: r.day.interactions,
      detalle: {
        month: r.month,
        top_media: r.topMedia,
        media: r.monthMedia,
        profile: r.profile,
      },
    },
    { onConflict: "cliente_id,fecha" }
  );

  // Si el @usuario cambió o no estaba guardado, lo cacheamos en la ficha.
  const cachedUser = (client as { ig_username?: string | null }).ig_username ?? null;
  if (r.profile.username && r.profile.username !== cachedUser) {
    await admin.from("clients").update({ ig_username: r.profile.username }).eq("id", clienteId);
  }

  return { ok: true, followers: r.profile.followers, reach: r.day.reach };
}

/**
 * Sync diario de TODOS los clientes con Instagram conectado. Lo llama el cron.
 * No-op si Meta no está configurado.
 */
export async function runInstagramDaily(): Promise<{
  skipped?: boolean;
  total?: number;
  ok?: number;
  failed?: number;
}> {
  if (!metaConfigured()) return { skipped: true };
  const admin = createAdmin();
  const { data } = await admin
    .from("clients")
    .select("id")
    .not("ig_user_id", "is", null);

  const rows = (data ?? []) as { id: string }[];
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await syncClientInstagram(r.id, { admin });
      ok++;
    } catch {
      failed++;
    }
  }
  return { total: rows.length, ok, failed };
}
