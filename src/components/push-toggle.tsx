"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      const ok =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!ok) {
        if (!cancelled) setSupported(false);
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setSupported(true);
        setSubscribed(!!sub);
        setEndpoint(sub?.endpoint ?? null);
      } catch {
        if (!cancelled) setSupported(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!vapidKey) {
      toast.error(
        "Falta configurar VAPID_PUBLIC_KEY en el servidor. Avisame y lo seteo."
      );
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Tenés que permitir las notificaciones desde el navegador.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          user_agent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("No se pudo guardar la suscripción: " + (data.error ?? res.status));
        return;
      }
      setSubscribed(true);
      setEndpoint(subJson.endpoint ?? null);
      toast.success("Notificaciones push activadas en este dispositivo");
    } catch (e) {
      toast.error(
        "No se pudo activar: " + (e instanceof Error ? e.message : "error")
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const ep = sub?.endpoint ?? endpoint;
      if (sub) await sub.unsubscribe();
      if (ep) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(ep)}`, {
          method: "DELETE",
        });
      }
      setSubscribed(false);
      setEndpoint(null);
      toast.success("Notificaciones push desactivadas");
    } catch (e) {
      toast.error(
        "No se pudo desactivar: " + (e instanceof Error ? e.message : "error")
      );
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return (
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        Tu navegador no soporta notificaciones push. En iPhone, primero
        instalá la app (compartir → Añadir a pantalla de inicio).
      </div>
    );
  }
  if (supported === null) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Recibí en tu celular o computadora las notificaciones de tareas,
        reuniones y menciones, incluso con la app cerrada.
      </p>
      {subscribed ? (
        <Button variant="outline" onClick={disable} disabled={busy} size="sm">
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <BellOff className="mr-1 h-4 w-4" />
          )}
          Desactivar push en este dispositivo
        </Button>
      ) : (
        <Button onClick={enable} disabled={busy} size="sm">
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Bell className="mr-1 h-4 w-4" />
          )}
          Activar notificaciones push
        </Button>
      )}
    </div>
  );
}
