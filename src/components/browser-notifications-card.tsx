"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Perm = "default" | "granted" | "denied" | "unsupported";

export function BrowserNotificationsCard() {
  const [perm, setPerm] = useState<Perm>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission as Perm);
  }, []);

  async function request() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const r = await Notification.requestPermission();
      setPerm(r as Perm);
      if (r === "granted") {
        toast.success("Notificaciones activadas");
        // Test inmediato
        try {
          new Notification("JD Media", {
            body: "Vas a recibir notificaciones acá cuando te mencionen o haya novedades.",
            icon: "/favicon.ico",
          });
        } catch {
          /* ignore */
        }
      } else if (r === "denied") {
        toast.error("Bloqueaste las notificaciones. Tenés que habilitarlas desde el navegador.");
      }
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {perm === "granted" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          Notificaciones del navegador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {perm === "unsupported" ? (
          <p className="text-muted-foreground">
            Tu navegador no soporta notificaciones nativas.
          </p>
        ) : perm === "granted" ? (
          <p className="text-muted-foreground">
            Activadas ✓ — vas a recibir un aviso del sistema cuando te mencionen en chat o aparezca
            una notificación nueva (solo si la pestaña no está enfocada).
          </p>
        ) : perm === "denied" ? (
          <p className="text-muted-foreground">
            Las bloqueaste en este navegador. Para activarlas, abrí los permisos del sitio (candado
            arriba a la izquierda de la URL → Notificaciones → Permitir) y recargá.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              Recibí avisos del sistema operativo cuando te mencionen en chat o llegue una
              novedad, incluso si tenés la app abierta en otra pestaña.
            </p>
            <Button size="sm" onClick={request}>
              <Bell className="mr-1 h-4 w-4" /> Activar notificaciones
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
