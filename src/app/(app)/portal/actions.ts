"use server";

import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

const PATH = "/portal";
type Result = { ok: true } | { ok: false; error: string };

/**
 * Crea un aviso del Portal. destinatarios vacío = todo el equipo. Además del
 * aviso (que queda fijo en el Portal y en Mi día hasta marcarlo leído), le
 * genera a cada destinatario una notificación en la campanita.
 */
export async function createPortalNotice(input: {
  titulo: string;
  cuerpo: string;
  destinatarios: string[];
}): Promise<Result> {
  const me = await requireRole(["admin"]);
  const titulo = input.titulo.trim();
  const cuerpo = input.cuerpo.trim();
  if (!titulo || !cuerpo) return { ok: false, error: "Completá título y mensaje." };

  const admin = createAdmin();
  const { error } = await admin.from("portal_notices").insert({
    titulo,
    cuerpo,
    destinatarios: input.destinatarios,
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };

  // Campanita para cada destinatario (o para todos los activos).
  let userIds = input.destinatarios;
  if (userIds.length === 0) {
    const { data: users } = await admin
      .from("users")
      .select("id")
      .eq("activo", true);
    userIds = ((users ?? []) as { id: string }[]).map((u) => u.id);
  }
  const rows = userIds
    .filter((id) => id !== me.id)
    .map((user_id) => ({
      user_id,
      tipo: "aviso",
      mensaje: `📣 Aviso de dirección: ${titulo}`,
      link: "/portal",
      task_id: null,
    }));
  if (rows.length) await admin.from("notifications").insert(rows);

  revalidatePath(PATH);
  return { ok: true };
}

/** Borra un aviso (solo admin). */
export async function deletePortalNotice(id: string): Promise<Result> {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { error } = await admin.from("portal_notices").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

/** Marca un aviso como leído por el usuario actual. */
export async function markNoticeRead(noticeId: string): Promise<Result> {
  const me = await requireUser();
  const admin = createAdmin();
  const { error } = await admin
    .from("portal_notice_reads")
    .upsert(
      { notice_id: noticeId, user_id: me.id },
      { onConflict: "notice_id,user_id" }
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  revalidatePath("/dashboard");
  return { ok: true };
}
