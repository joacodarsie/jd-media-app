import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ChatLayout,
  type ChatAttachment,
  type ChatMessageRow,
  type ChatChannel,
} from "@/components/team-chat";

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

  // Para DMs, resolvemos quién es el "otro" miembro (no yo)
  const dmChannelIds = channelsRaw
    .filter((m) => m.channel!.kind === "dm")
    .map((m) => m.channel!.id);
  const dmPeers = new Map<
    string,
    { id: string; nombre: string; avatar_url: string | null }
  >();
  if (dmChannelIds.length > 0) {
    const { data: dmMembers } = await supabase
      .from("team_channel_members")
      .select("channel_id, user:users!team_channel_members_user_id_fkey(id, nombre, avatar_url)")
      .in("channel_id", dmChannelIds)
      .neq("user_id", me.id);
    for (const row of (dmMembers ?? []) as unknown as {
      channel_id: string;
      user: { id: string; nombre: string; avatar_url: string | null } | null;
    }[]) {
      if (row.user) dmPeers.set(row.channel_id, row.user);
    }
  }

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
    .map((m) => {
      const ch = m.channel!;
      const peer = ch.kind === "dm" ? dmPeers.get(ch.id) : null;
      return {
        id: ch.id,
        name: ch.name,
        description: ch.description,
        kind: ch.kind,
        updated_at: ch.updated_at,
        unread: unreadByChannel.get(ch.id) ?? 0,
        peer: peer
          ? { id: peer.id, nombre: peer.nombre, avatar_url: peer.avatar_url }
          : null,
      };
    })
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

  // Mensajes del canal activo + miembros + adjuntos
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
    const baseMsgs = ((msgs ?? []) as unknown) as Omit<
      ChatMessageRow,
      "attachments"
    >[];
    activeMembers = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);

    // Adjuntos + signed URLs
    type RawAtt = {
      id: string;
      message_id: string;
      name: string;
      mime_type: string;
      storage_path: string;
      size: number | null;
    };
    const attsByMsg = new Map<string, RawAtt[]>();
    if (baseMsgs.length > 0) {
      const ids = baseMsgs.map((m) => m.id);
      const { data: atts } = await supabase
        .from("chat_attachments")
        .select("id, message_id, name, mime_type, storage_path, size")
        .in("message_id", ids);
      const allPaths: string[] = [];
      for (const a of (atts ?? []) as RawAtt[]) {
        if (!attsByMsg.has(a.message_id)) attsByMsg.set(a.message_id, []);
        attsByMsg.get(a.message_id)!.push(a);
        allPaths.push(a.storage_path);
      }
      const signedUrlMap = new Map<string, string>();
      if (allPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrls(allPaths, 60 * 60);
        for (const s of signed ?? []) {
          if (s?.signedUrl && s.path) signedUrlMap.set(s.path, s.signedUrl);
        }
      }
      messages = baseMsgs.map((m) => ({
        ...m,
        attachments: (attsByMsg.get(m.id) ?? []).map<ChatAttachment>((a) => ({
          name: a.name,
          mime_type: a.mime_type,
          url: signedUrlMap.get(a.storage_path) ?? "",
          size: a.size ?? undefined,
        })),
      }));
    } else {
      messages = [];
    }

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
