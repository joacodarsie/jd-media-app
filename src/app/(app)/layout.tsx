import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ensureDueNotifications } from "@/lib/notifications";
import type { Notification } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { NotificationBell } from "@/components/notification-bell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = createClient();

  await ensureDueNotifications(supabase, user.id);

  const [{ data: items }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("leida", false),
  ]);

  const bell = (
    <NotificationBell
      items={(items ?? []) as Notification[]}
      unreadCount={count ?? 0}
    />
  );

  return (
    <AppShell user={user} bell={bell}>
      {children}
    </AppShell>
  );
}
