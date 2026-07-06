import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdmin } from "@/lib/supabase/admin";
import { computeAccountHealth } from "@/lib/director/health";

type Admin = ReturnType<typeof createAdmin>;

/** Destinatarios del aviso: owner (JDMEDIA_LIVE_OWNER_EMAIL) + DIRECTOR_DIGEST_EMAILS. */
async function digestUserIds(admin: SupabaseClient): Promise<string[]> {
  const emails = new Set<string>();
  if (process.env.JDMEDIA_LIVE_OWNER_EMAIL)
    emails.add(process.env.JDMEDIA_LIVE_OWNER_EMAIL.trim().toLowerCase());
  (process.env.DIRECTOR_DIGEST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .forEach((e) => emails.add(e));
  if (emails.size === 0) return [];
  const { data } = await admin.from("users").select("id, email").eq("activo", true);
  return ((data ?? []) as { id: string; email: string }[])
    .filter((u) => emails.has((u.email ?? "").trim().toLowerCase()))
    .map((u) => u.id);
}

/**
 * Aviso quincenal del Director: calcula la salud de las cuentas (semáforo
 * bien/regular/mal en vivo) y notifica al owner + digest para que hagan el
 * seguimiento en /director. No guarda nada: el tablero es siempre en vivo.
 * Dedupe por día para no repetir el mismo mensaje.
 */
export async function runHealthDigest(admin: Admin, now: Date) {
  const { cuentas, resumen } = await computeAccountHealth(admin);
  if (resumen.total === 0) return { ok: true, notified: 0, total: 0 };

  const atender = cuentas
    .filter((c) => c.semaforo === "mal" || c.semaforo === "regular")
    .slice(0, 6)
    .map((c) => c.nombre);

  const prefix = "🚦 Director";
  let mensaje = `${prefix}: seguimiento quincenal — ${resumen.bien} bien, ${resumen.regular} regular, ${resumen.mal} mal (de ${resumen.total} cuentas)`;
  if (atender.length > 0) {
    mensaje += `. Atender: ${atender.join(", ")}${
      resumen.mal + resumen.regular > atender.length ? "…" : ""
    }`;
  } else {
    mensaje += ". Todo en verde ✔";
  }
  mensaje += ". Ver tablero →";

  const uids = await digestUserIds(admin);
  if (uids.length === 0) return { ok: true, notified: 0, total: resumen.total };

  // Dedupe: no repetir el mismo mensaje ya insertado hoy con este prefijo.
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const { data: existing } = await admin
    .from("notifications")
    .select("user_id, mensaje")
    .gte("created_at", startOfDay)
    .like("mensaje", `${prefix}%`);
  const already = new Set(
    ((existing ?? []) as { user_id: string; mensaje: string }[]).map(
      (n) => `${n.user_id}::${n.mensaje}`
    )
  );

  const rows = uids
    .filter((uid) => !already.has(`${uid}::${mensaje}`))
    .map((uid) => ({
      user_id: uid,
      tipo: "recordatorio" as const,
      mensaje,
      leida: false,
      link: "/director",
    }));

  let notified = 0;
  if (rows.length > 0) {
    const { error } = await admin.from("notifications").insert(rows);
    if (!error) notified = rows.length;
  }
  return { ok: true, notified, total: resumen.total };
}
