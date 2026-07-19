import Link from "next/link";
import { redirect } from "next/navigation";
import { Radio } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JdmediaChat, type ChatAttachment } from "@/components/jdmedia-chat";
import { ConversationsSidebar } from "@/components/jdmedia-conversations-sidebar";

export const dynamic = "force-dynamic";

export default async function JdmediaPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("user_id", me.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  const convList = (conversations ?? []) as {
    id: string;
    title: string;
    updated_at: string;
  }[];

  const activeId = searchParams.c ?? null;
  if (activeId && !convList.some((c) => c.id === activeId)) {
    redirect("/jdmedia");
  }

  type RawMsg = { id: string; role: "user" | "assistant"; content: string };
  type RawAtt = {
    id: string;
    message_id: string;
    name: string;
    mime_type: string;
    storage_path: string;
    size: number | null;
  };

  let messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments: ChatAttachment[];
  }[] = [];

  if (activeId) {
    const [{ data: rawMsgs }, { data: rawAtts }] = await Promise.all([
      supabase
        .from("ai_messages")
        .select("id, role, content")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true }),
      supabase
        .from("ai_attachments")
        .select(
          "id, message_id, name, mime_type, storage_path, size, ai_messages!inner(conversation_id)"
        )
        .eq("ai_messages.conversation_id", activeId),
    ]);

    const attsByMsg = new Map<string, RawAtt[]>();
    for (const a of (rawAtts ?? []) as unknown as RawAtt[]) {
      if (!attsByMsg.has(a.message_id)) attsByMsg.set(a.message_id, []);
      attsByMsg.get(a.message_id)!.push(a);
    }

    // Crear signed URLs (válidas 1h) para visualizar/descargar
    const allPaths: string[] = [];
    for (const arr of attsByMsg.values()) {
      for (const a of arr) allPaths.push(a.storage_path);
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

    messages = ((rawMsgs ?? []) as RawMsg[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: (attsByMsg.get(m.id) ?? []).map((a) => ({
        name: a.name,
        mime_type: a.mime_type,
        url: signedUrlMap.get(a.storage_path) ?? "",
        size: a.size ?? undefined,
      })),
    }));
  }

  // "En vivo" salió del menú lateral: se entra por este botón. Lo ve quien
  // tiene la feature jdmedia_live (o admin, o el owner por env).
  const isLiveOwner =
    !!process.env.JDMEDIA_LIVE_OWNER_EMAIL &&
    me.email === process.env.JDMEDIA_LIVE_OWNER_EMAIL;
  const permisos = (me as unknown as { permisos?: Record<string, boolean> }).permisos;
  const canLive =
    isLiveOwner || me.rol === "admin" || permisos?.jdmedia_live === true;

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] md:-m-6">
      <ConversationsSidebar conversations={convList} activeId={activeId} />
      <div className="flex min-w-0 flex-1 flex-col">
        {canLive && (
          <div className="flex items-center justify-end border-b px-3 py-1.5">
            <Link
              href="/jdmedia/live"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/20"
            >
              <Radio className="h-3.5 w-3.5" />
              Sesión en vivo
            </Link>
          </div>
        )}
        <JdmediaChat
          key={activeId ?? "new"}
          conversationId={activeId}
          initialMessages={messages}
          userName={me.nombre}
        />
      </div>
    </div>
  );
}
