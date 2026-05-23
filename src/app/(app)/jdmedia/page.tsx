import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JdmediaChat } from "@/components/jdmedia-chat";
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

  // Si pidieron una conversación puntual via ?c=, validamos que sea del usuario
  const activeId = searchParams.c ?? null;
  if (activeId && !convList.some((c) => c.id === activeId)) {
    redirect("/jdmedia");
  }

  let messages: { id: string; role: "user" | "assistant"; content: string }[] = [];
  if (activeId) {
    const { data } = await supabase
      .from("ai_messages")
      .select("id, role, content")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: true });
    messages = (data ?? []) as typeof messages;
  }

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] md:-m-6">
      <ConversationsSidebar conversations={convList} activeId={activeId} />
      <div className="flex min-w-0 flex-1 flex-col">
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
