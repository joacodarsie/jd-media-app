"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  text: string
): Promise<string[]> {
  const matches = Array.from(text.matchAll(/@([\p{L}][\p{L}\p{N}_.-]{1,30})/giu));
  if (matches.length === 0) return [];
  const handles = Array.from(new Set(matches.map((m) => m[1].toLowerCase())));
  const { data: users } = await supabase
    .from("users")
    .select("id, nombre")
    .eq("activo", true);
  if (!users) return [];
  const out: string[] = [];
  for (const h of handles) {
    const match = users.find((u) => {
      const n = u.nombre.toLowerCase();
      return (
        n === h ||
        n.startsWith(h + " ") ||
        n.split(" ").some((part) => part === h)
      );
    });
    if (match && !out.includes(match.id)) out.push(match.id);
  }
  return out;
}

export async function sendMessage(channelId: string, content: string) {
  const { supabase, userId } = await ctx();
  const text = (content ?? "").toString().trim().slice(0, MAX_MESSAGE);
  if (!text) return { error: "Mensaje vacío." };

  // Resolver menciones
  const mentions = await parseMentions(supabase, text);

  // Insertar mensaje
  const { data: msg, error } = await supabase
    .from("team_messages")
    .insert({
      channel_id: channelId,
      user_id: userId,
      content: text,
      mentions,
    })
    .select("id")
    .single();
  if (error || !msg) return { error: error?.message ?? "Error" };

  // Bump updated_at del canal para ordenar por reciente
  await supabase
    .from("team_channels")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", channelId);

  // Notificaciones para mencionados (no a uno mismo)
  if (mentions.length > 0) {
    const [{ data: me }, { data: channel }] = await Promise.all([
      supabase.from("users").select("nombre").eq("id", userId).maybeSingle(),
      supabase
        .from("team_channels")
        .select("name")
        .eq("id", channelId)
        .maybeSingle(),
    ]);
    const mensaje = `${me?.nombre ?? "Alguien"} te mencionó en #${channel?.name ?? "un canal"}`;
    const notifs = mentions
      .filter((m) => m !== userId)
      .map((m) => ({
        user_id: m,
        tipo: "mencion" as const,
        mensaje,
      }));
    if (notifs.length) {
      await supabase.from("notifications").insert(notifs);
    }
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

export async function createChannel(name: string, description: string | null) {
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

  // Sumar todos los users activos por default
  const { data: users } = await supabase.from("users").select("id").eq("activo", true);
  if (users && users.length > 0) {
    await supabase
      .from("team_channel_members")
      .insert(users.map((u) => ({ channel_id: created.id, user_id: u.id })));
  }

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
