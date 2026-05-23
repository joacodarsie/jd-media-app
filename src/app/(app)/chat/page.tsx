import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ChatLayout, type ChatMessageRow, type ChatChannel } from "@/components/team-chat";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  // Canales donde el user es miembro
  const { data: memberships } = await supabase
    .from("team_channel_members")
    .select("channel_id, last_read_at, channel:team_channels(id, name, description, kind, updated_at, archived)")
    .eq("user_id", me.id);

  type MembershipRow = {
    channel_id: string;
    last_read_at: string | null;
    channel: {
      id: string;
      name: string;
      description: string | null;
      kind: "public" | "dm";
      updated_at: string;
      archived: boolean;
    } | null;
  };

  const channelsRaw = ((memberships ?? []) as unknown as MembershipRow[]).filter(
    (m) => m.channel && !m.channel.archived
  );

  // Conteo de mensajes no leídos por canal
  const channelIds = channelsRaw.map((c) => c.channel!.id);
  const unreadByChannel = new Map<string, number>();
  if (channelIds.length > 0) {
    for (const m of channelsRaw) {
      const ch = m.channel!;
      const since = m.last_read_at ?? "1970-01-01";
      const { count } = await supabase
        .from("team_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", ch.id)
        .gt("created_at", since)
        .neq("user_id", me.id);
      unreadByChannel.set(ch.id, count ?? 0);
    }
  }

  const channels: ChatChannel[] = channelsRaw
    .map((m) => ({
      id: m.channel!.id,
      name: m.channel!.name,
      description: m.channel!.description,
      updated_at: m.channel!.updated_at,
      unread: unreadByChannel.get(m.channel!.id) ?? 0,
    }))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  // Default a #general o el más reciente
  const activeId =
    searchParams.c ??
    channels.find((c) => c.name === "general")?.id ??
    channels[0]?.id ??
    null;

  if (searchParams.c && !channels.some((c) => c.id === searchParams.c)) {
    redirect("/chat");
  }

  // Mensajes del canal activo + miembros
  let messages: ChatMessageRow[] = [];
  let activeMembers: string[] = [];
  if (activeId) {
    const [{ data: msgs }, { data: members }] = await Promise.all([
      supabase
        .from("team_messages")
        .select(
          "id, channel_id, user_id, content, mentions, created_at, edited_at, autor:users!team_messages_user_id_fkey(id,nombre,avatar_url)"
        )
        .eq("channel_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("team_channel_members")
        .select("user_id")
        .eq("channel_id", activeId),
    ]);
    messages = (msgs ?? []) as unknown as ChatMessageRow[];
    activeMembers = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);

    // Marcar canal como leído (solo si hay msgs)
    if (messages.length > 0) {
      await supabase
        .from("team_channel_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", activeId)
        .eq("user_id", me.id);
    }
  }

  // Lista de users para el @mention picker
  const { data: users } = await supabase
    .from("users")
    .select("id, nombre, avatar_url")
    .eq("activo", true)
    .order("nombre");

  return (
    <ChatLayout
      currentUserId={me.id}
      channels={channels}
      activeChannelId={activeId}
      initialMessages={messages}
      initialMembers={activeMembers}
      users={(users ?? []) as { id: string; nombre: string; avatar_url: string | null }[]}
    />
  );
}
