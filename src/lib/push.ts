/**
 * Helpers Web Push (servidor).
 *
 * Para que funcione hay que setear en Vercel:
 *  - VAPID_PUBLIC_KEY (tambien expuesta como NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 *  - VAPID_PRIVATE_KEY
 *  - VAPID_SUBJECT  (ej: "mailto:contacto@jdmedia.com.ar")
 *
 * Generar par de claves con: `npx web-push generate-vapid-keys`
 */
import webpush from "web-push";
import { createAdmin } from "./supabase/admin";

let configured = false;
function ensureConfig() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT ?? "mailto:contacto@jdmedia.com.ar";
  if (!pub || !priv) return false;
  try {
    webpush.setVapidDetails(subj, pub, priv);
    configured = true;
    return true;
  } catch (e) {
    console.error("[push] setVapidDetails failed:", e);
    return false;
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Manda push notification a TODOS los devices subscritos de los user IDs dados.
 * Silencioso si no hay claves VAPID o si no hay subscripciones — no rompe la
 * server action que la llamo.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (userIds.length === 0) return;
  if (!ensureConfig()) return;

  const admin = createAdmin();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
    tag: payload.tag,
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint as string,
            keys: {
              p256dh: s.p256dh as string,
              auth: s.auth as string,
            },
          },
          body
        );
      } catch (err: unknown) {
        const e = err as { statusCode?: number; message?: string };
        // 410 Gone / 404 Not Found = suscripcion expirada o invalidada por el browser.
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[push] sendNotification falló:", e?.message ?? err);
        }
      }
    })
  );
}
