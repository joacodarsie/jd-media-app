/**
 * Auto-publicación: recorre las publicaciones de Instagram APROBADAS con
 * auto_publicar activado, archivos finales subidos y fecha/hora vencida, y
 * las publica en la cuenta del cliente. Corre desde /api/cron/auto-publish
 * (cron diario de Vercel como red de seguridad + scheduler externo frecuente
 * para horario fino).
 *
 * Reglas:
 * - Ventana: fecha_publicacion entre (ahora - 24h) y ahora. Nada viejo sale
 *   solo: si quedó colgada más de un día, se resuelve a mano (Reintentar).
 * - Un error deja publish_error y NO se reintenta solo (para no spamear la
 *   cuenta del cliente); el botón Reintentar lo limpia.
 * - Best-effort por publicación: una que falla no frena a las demás.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { metaConfigured } from "@/lib/meta/instagram";
import { publishToInstagram, type PublishMediaItem } from "@/lib/meta/publish";

const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;

interface DuePublication {
  id: string;
  titulo: string;
  tipo: "post" | "reel" | "carrusel" | "historia" | "video" | "otro";
  copy: string | null;
  hashtags: string | null;
  publish_media: { path: string }[] | null;
  cliente: {
    id: string;
    nombre: string;
    ig_user_id: string | null;
    cm_id: string | null;
  } | null;
}

function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/publish-media/${path}`;
}

async function notify(
  admin: ReturnType<typeof createAdmin>,
  userIds: (string | null | undefined)[],
  mensaje: string,
  link: string
) {
  const rows = [...new Set(userIds.filter((u): u is string => !!u))].map(
    (user_id) => ({ user_id, tipo: "recordatorio", mensaje, link })
  );
  if (rows.length) await admin.from("notifications").insert(rows);
}

export interface AutoPublishSummary {
  procesadas: number;
  publicadas: number;
  errores: number;
  detalle: string[];
  skipped?: string;
}

export async function runAutoPublish(): Promise<AutoPublishSummary> {
  const vacio: AutoPublishSummary = {
    procesadas: 0,
    publicadas: 0,
    errores: 0,
    detalle: [],
  };
  if (!metaConfigured()) return { ...vacio, skipped: "META_NO_TOKEN" };

  const admin = createAdmin();
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 3600 * 1000);

  const { data, error } = await admin
    .from("publications")
    .select(
      "id, titulo, tipo, copy, hashtags, publish_media, cliente:clients(id, nombre, ig_user_id, cm_id)"
    )
    .eq("red", "instagram")
    .eq("estado", "aprobado")
    .eq("auto_publicar", true)
    .is("published_at", null)
    .is("publish_error", null)
    .gte("fecha_publicacion", from.toISOString())
    .lte("fecha_publicacion", now.toISOString())
    .limit(20);

  // Sin la migración 0128 la query falla: la feature simplemente no corre.
  if (error) return { ...vacio, skipped: `query: ${error.message}` };

  const due = (data ?? []) as unknown as DuePublication[];
  const summary: AutoPublishSummary = { ...vacio, procesadas: due.length };

  for (const pub of due) {
    const adminIds = async () => {
      const { data: admins } = await admin
        .from("users")
        .select("id")
        .eq("rol", "admin");
      return ((admins ?? []) as { id: string }[]).map((a) => a.id);
    };
    const link = "/contenidos";

    try {
      // Candado optimista: si otra corrida (cron + scheduler externo a la vez)
      // ya tomó esta pieza, publish_error dejó de ser null y acá no vuelve.
      const { data: claimed } = await admin
        .from("publications")
        .update({ publish_error: "Publicando…" })
        .eq("id", pub.id)
        .is("published_at", null)
        .is("publish_error", null)
        .select("id");
      if (!claimed?.length) {
        summary.detalle.push(`~ ${pub.cliente?.nombre ?? "?"}: ${pub.titulo} — tomada por otra corrida`);
        continue;
      }

      const media: PublishMediaItem[] = ((pub.publish_media ?? []) as {
        path: string;
      }[]).map((m) => ({
        url: publicUrl(m.path),
        isVideo: VIDEO_EXT.test(m.path),
      }));

      if (!pub.cliente?.ig_user_id) {
        throw new Error(
          "El cliente no tiene el Instagram conectado en la app (ig_user_id)."
        );
      }

      const caption = [pub.copy?.trim(), pub.hashtags?.trim()]
        .filter(Boolean)
        .join("\n\n");

      const res = await publishToInstagram({
        igUserId: pub.cliente.ig_user_id,
        tipo: pub.tipo,
        caption,
        media,
      });

      await admin
        .from("publications")
        .update({
          estado: "publicado",
          published_at: new Date().toISOString(),
          ig_media_id: res.mediaId,
          ig_permalink: res.permalink,
          publish_error: null,
        })
        .eq("id", pub.id);

      await notify(
        admin,
        [pub.cliente?.cm_id],
        `✅ Se publicó solo en Instagram: "${pub.titulo}" (${pub.cliente?.nombre}).`,
        res.permalink ?? link
      );
      summary.publicadas++;
      summary.detalle.push(`✓ ${pub.cliente?.nombre}: ${pub.titulo}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      await admin
        .from("publications")
        .update({ publish_error: msg.slice(0, 500) })
        .eq("id", pub.id);
      await notify(
        admin,
        [pub.cliente?.cm_id, ...(await adminIds())],
        `⚠️ Falló la auto-publicación de "${pub.titulo}" (${pub.cliente?.nombre ?? "?"}): ${msg.slice(0, 140)}`,
        link
      );
      summary.errores++;
      summary.detalle.push(`✗ ${pub.cliente?.nombre ?? "?"}: ${pub.titulo} — ${msg}`);
    }
  }

  return summary;
}
