"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Suscripción Supabase Realtime:
 * - team_messages: para actualizar badge de chat.
 * - notifications: para actualizar campana y badges.
 *
 * Estrategia: en cualquier insert relevante, llamamos router.refresh() (debounced)
 * que re-ejecuta el layout server-side y actualiza badges. También dispara
 * notificación del navegador si el usuario dio permiso.
 */
export function RealtimeBadgesSync({
  userId,
}: {
  userId: string;
}) {
  const router = useRouter();
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function scheduleRefresh() {
      if (refreshTimer.current != null) {
        window.clearTimeout(refreshTimer.current);
      }
      refreshTimer.current = window.setTimeout(() => {
        router.refresh();
      }, 400);
    }

    function showBrowserNotification(title: string, body: string) {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      // Solo si la pestaña no está activa
      if (typeof document !== "undefined" && document.visibilityState === "visible") return;
      try {
        new Notification(title, { body, icon: "/favicon.ico", tag: "jd-media" });
      } catch {
        /* ignore */
      }
    }

    // Channel: notificaciones del user
    const notifChannel = supabase
      .channel(`realtime-notifs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as { mensaje?: string; tipo?: string };
          // Toast en la app
          toast(n.mensaje ?? "Nueva notificación", {
            description: n.tipo ?? undefined,
          });
          // Notificación del navegador si está autorizada
          showBrowserNotification("JD Media", n.mensaje ?? "Tenés una nueva notificación");
          scheduleRefresh();
        }
      )
      .subscribe();

    // Channel: mensajes del chat (cualquier insert dispara refresh; el server filtra el conteo)
    const msgChannel = supabase
      .channel(`realtime-msgs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_messages",
        },
        (payload) => {
          const m = payload.new as { user_id?: string };
          if (m.user_id === userId) return; // No notifico por mis propios mensajes
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current != null) {
        window.clearTimeout(refreshTimer.current);
      }
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [userId, router]);

  return null;
}
