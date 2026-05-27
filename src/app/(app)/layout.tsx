import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { NotificationBell } from "@/components/notification-bell";
import { AIChatLauncher } from "@/components/ai-chat-launcher";
import { RealtimeBadgesSync } from "@/components/realtime-badges-sync";
import { WelcomeTour } from "@/components/welcome-tour";
import type { QuickLinkRow } from "@/components/quick-links-manager";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = createClient();

  // Las notificaciones "vencida" / "proxima a vencer" se generan ahora SOLO en
  // dashboard/page.tsx (la primera pantalla que mira el usuario al loguearse)
  // y en cron diario. Antes corria aca en cada nav y agregaba ~10ms a TODO.

  const [
    { data: items },
    { count: unreadCount },
    { data: links },
    { data: chatUnread },
    { count: taskUnreadCount },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, user_id, task_id, tipo, mensaje, leida, created_at, link")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("leida", false),
    supabase
      .from("quick_links")
      .select("id, label, url, icon, orden")
      .order("orden"),
    supabase.rpc("team_chat_unread_count", { p_user_id: user.id }),
    // Notificaciones sin leer asociadas a tareas (asignación, comentario, vencidas)
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("leida", false)
      .not("task_id", "is", null),
  ]);

  const bell = (
    <NotificationBell
      items={(items ?? []) as Notification[]}
      unreadCount={unreadCount ?? 0}
    />
  );

  const chatUnreadNum =
    typeof chatUnread === "number" ? chatUnread : Number(chatUnread ?? 0);

  const { hasRecentChanges, latestEntryDate } = await import("@/lib/help/changelog");
  const showNovedadesBadge = hasRecentChanges(14);
  const novedadesLatestDate = latestEntryDate();

  const badges: Record<string, number> = {
    "/chat": chatUnreadNum,
    "/tareas": taskUnreadCount ?? 0,
    "/novedades": showNovedadesBadge ? 1 : 0,
  };

  return (
    <AppShell
      user={user}
      bell={bell}
      quickLinks={(links ?? []) as QuickLinkRow[]}
      badges={badges}
      novedadesLatestDate={novedadesLatestDate}
    >
      <RealtimeBadgesSync userId={user.id} />
      {children}
      <AIChatLauncher />
      <WelcomeTour userRol={user.rol} userName={user.nombre} />
    </AppShell>
  );
}
