import Link from "next/link";
import {
  Bell,
  UserPlus,
  AtSign,
  MessageCircle,
  Clock,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";
import { MarkAllReadButton } from "@/components/mark-all-read-button";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  asignacion: UserPlus,
  mencion: AtSign,
  comentario: MessageCircle,
  proxima_a_vencer: Clock,
  vencida: AlertCircle,
};

const ICON_COLOR: Record<string, string> = {
  asignacion: "text-blue-500",
  mencion: "text-primary",
  comentario: "text-zinc-500",
  proxima_a_vencer: "text-amber-500",
  vencida: "text-red-500",
};

export default async function NotificacionesPage() {
  const me = await requireUser();
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, user_id, task_id, tipo, mensaje, leida, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.leida).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">
            {unread > 0 ? `${unread} sin leer` : "Todo al día."}
          </p>
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Todavía no tenés notificaciones.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((n) => {
            const Icon = ICONS[n.tipo] ?? Bell;
            const href = n.task_id ? `/tareas/${n.task_id}` : "#";
            return (
              <li key={n.id}>
                <Link
                  href={href}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-accent",
                    !n.leida && "bg-primary/5"
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      ICON_COLOR[n.tipo]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        !n.leida && "font-medium"
                      )}
                    >
                      {n.mensaje}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {fmtDateTime(n.created_at)}
                    </p>
                  </div>
                  {!n.leida && (
                    <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
