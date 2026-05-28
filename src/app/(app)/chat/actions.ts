"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

const MAX_MESSAGE = 4000;

/**
 * Extrae menciones tipo @nombre del texto. Devuelve array de user_ids.
 * Hace match parcial sobre el nombre completo o el primer nombre.
 */
async function parseMentions(
  supabase: ReturnType<typeof createClient>,
  text: string,
  _channelId: string
): Promise<string[]> {
  const matches = Array.from(text.matchAll(/@([\p{L}][\p{L}\p{N}_.-]{1,30})/giu));
  if (matches.length === 0) return [];
  const handles = Array.from(new Set(matches.map((m) => m[1].toLowerCase())));
  // Aceptamos mencionar a cualquier usuario activo del equipo, sin restringir
  // a miembros del canal — la notificacion se envia via admin client.
  const { data: usersRaw } = await supabase
    .from("users")
    .select("id, nombre, activo")
    .eq("activo", true);
  const list = ((usersRaw ?? []) as { id: string; nombre: string; activo: boolean }[]);
  if (list.length === 0) return [];
  const out: string[] = [];
  for (const h of handles) {
    const match = list.find((u) => {
      const n = u.nombre.toLowerCase();
      return (
        n === h ||
        n.startsWith(h + " ") ||
        n.split(" ").some((part: string) => part === h)
      );
    });
    if (match && !out.includes(match.id)) out.push(match.id);
  }
  return out;
}

interface ChatAttachmentInput {
  storage_path: string;
  name: string;
  mime_type: string;
  size?: number;
}

export async function sendMessage(
  channelId: string,
  content: string,
  attachments: ChatAttachmentInput[] = []
) {
  const { supabase, userId } = await ctx();
  const text = (content ?? "").toString().trim().slice(0, MAX_MESSAGE);
  if (!text && attachments.length === 0) return { error: "Mensaje vacío." };

  // Resolver menciones (sólo entre miembros del canal)
  const mentions = text
    ? await parseMentions(supabase, text, channelId)
    : [];

  // Insertar mensaje
  const { data: msg, error } = await supabase
    .from("team_messages")
    .insert({
      channel_id: channelId,
      user_id: userId,
      content: text || "",
      mentions,
    })
    .select("id")
    .single();
  if (error || !msg) return { error: error?.message ?? "Error" };

  // Registrar adjuntos
  if (attachments.length > 0) {
    const rows = attachments.map((a) => ({
      message_id: msg.id,
      name: a.name,
      mime_type: a.mime_type,
      storage_path: a.storage_path,
      size: a.size ?? null,
    }));
    const { error: attErr } = await supabase
      .from("chat_attachments")
      .insert(rows);
    if (attErr) {
      // Mensaje queda creado igual, pero avisamos
      return { error: "Adjuntando archivos: " + attErr.message, id: msg.id };
    }
  }

  // Bump updated_at del canal para ordenar por reciente
  await supabase
    .from("team_channels")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", channelId);

  // Notificaciones:
  //  - DM (1-a-1): siempre al destinatario, aunque no haya @mencion
  //  - Canal publico: solo a los @mencionados
  const [{ data: me }, { data: channel }] = await Promise.all([
    supabase.from("users").select("nombre").eq("id", userId).maybeSingle(),
    supabase
      .from("team_channels")
      .select("kind, name")
      .eq("id", channelId)
      .maybeSingle(),
  ]);

  const nombreEmisor = me?.nombre ?? "Alguien";
  const targets = new Set<string>();

  // DM: el otro miembro recibe siempre.
  if (channel?.kind === "dm") {
    const { data: members } = await supabase
      .from("team_channel_members")
      .select("user_id")
      .eq("channel_id", channelId);
    for (const m of (members ?? []) as { user_id: string }[]) {
      if (m.user_id !== userId) targets.add(m.user_id);
    }
  }

  // Menciones @ explicitas (en cualquier tipo de canal).
  for (const m of mentions) {
    if (m !== userId) targets.add(m);
  }

  if (targets.size > 0) {
    const mensaje =
      channel?.kind === "dm"
        ? `${nombreEmisor} te escribió`
        : `${nombreEmisor} te mencionó en #${channel?.name ?? "un canal"}`;
    const notifs = Array.from(targets).map((uid) => ({
      user_id: uid,
      tipo: "mencion" as const,
      mensaje,
    }));
    // Usar admin client: RLS de notifications restringe INSERT a auth.uid(),
    // entonces el cliente normal del sender no puede crear notifs para
    // otros usuarios. Service role bypassa esa restriccion.
    const admin = createAdmin();
    await admin.from("notifications").insert(notifs);
  }

  revalidatePath("/chat");
  return { ok: true, id: msg.id };
}

export async function markChannelRead(channelId: string) {
  const { supabase, userId } = await ctx();
  await supabase
    .from("team_channel_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .eq("user_id", userId);
  revalidatePath("/chat");
  return { ok: true };
}

export async function createChannel(
  name: string,
  description: string | null,
  memberIds: string[]
) {
  const { supabase, userId } = await ctx();
  const slug = (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  if (!slug) return { error: "Nombre inválido." };

  const { data: created, error } = await supabase
    .from("team_channels")
    .insert({
      kind: "public",
      name: slug,
      description: description?.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Error" };

  // Siempre incluir al creador. Después los miembros seleccionados.
  const all = Array.from(new Set([userId, ...(memberIds ?? []).filter(Boolean)]));
  if (all.length > 0) {
    await supabase
      .from("team_channel_members")
      .insert(all.map((uid) => ({ channel_id: created.id, user_id: uid })));
  }

  revalidatePath("/chat");
  return { ok: true, id: created.id };
}

export async function setChannelMembers(channelId: string, memberIds: string[]) {
  const { supabase, userId } = await ctx();
  // Asegurar que el creador (current) siempre quede como miembro
  const target = Array.from(new Set([userId, ...(memberIds ?? []).filter(Boolean)]));

  const { data: existingRows } = await supabase
    .from("team_channel_members")
    .select("user_id")
    .eq("channel_id", channelId);
  const existing = ((existingRows ?? []) as { user_id: string }[]).map(
    (r) => r.user_id
  );

  const toAdd = target.filter((u) => !existing.includes(u));
  const toRemove = existing.filter((u) => !target.includes(u));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("team_channel_members")
      .insert(toAdd.map((uid) => ({ channel_id: channelId, user_id: uid })));
    if (error) return { error: "Sumando: " + error.message };
  }
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("team_channel_members")
      .delete()
      .eq("channel_id", channelId)
      .in("user_id", toRemove);
    if (error) return { error: "Quitando: " + error.message };
  }
  revalidatePath("/chat");
  return { ok: true, added: toAdd.length, removed: toRemove.length };
}

/**
 * Devuelve el canal DM entre el usuario actual y `otherUserId`.
 * Si no existe, lo crea con ambos miembros.
 */
export async function getOrCreateDM(otherUserId: string) {
  const { supabase, userId } = await ctx();
  if (!otherUserId || otherUserId === userId) {
    return { error: "Usuario inválido." };
  }

  // Buscar DM existente: canal kind=dm con exactamente estos 2 miembros.
  const { data: existing } = await supabase
    .from("team_channels")
    .select(
      "id, kind, members:team_channel_members(user_id)"
    )
    .eq("kind", "dm");
  type RawCh = {
    id: string;
    kind: string;
    members: { user_id: string }[];
  };
  for (const ch of (existing ?? []) as RawCh[]) {
    const ids = ch.members.map((m) => m.user_id);
    if (
      ids.length === 2 &&
      ids.includes(userId) &&
      ids.includes(otherUserId)
    ) {
      return { ok: true, id: ch.id };
    }
  }

  // Crear nuevo canal DM. Nombre canónico para debug; la UI no lo muestra.
  const canon = [userId, otherUserId].sort().join(":");
  const { data: created, error } = await supabase
    .from("team_channels")
    .insert({
      kind: "dm",
      name: `dm:${canon}`.slice(0, 60),
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { error: error?.message ?? "No se pudo crear el DM." };
  }

  const { error: memErr } = await supabase
    .from("team_channel_members")
    .insert([
      { channel_id: created.id, user_id: userId },
      { channel_id: created.id, user_id: otherUserId },
    ]);
  if (memErr) return { error: memErr.message };

  revalidatePath("/chat");
  return { ok: true, id: created.id };
}

export async function deleteMessage(messageId: string, channelId: string) {
  const { supabase } = await ctx();
  const { error } = await supabase
    .from("team_messages")
    .delete()
    .eq("id", messageId);
  if (error) return { error: error.message };
  revalidatePath(`/chat?c=${channelId}`);
  return { ok: true };
}
