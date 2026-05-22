"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateMyWhatsApp } from "@/app/(app)/mi-perfil/actions";

export function WhatsAppOptinCard({
  initialPhone,
  initialOptin,
}: {
  initialPhone: string | null;
  initialOptin: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [optin, setOptin] = useState(initialOptin);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateMyWhatsApp(phone || null, optin);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Guardado");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          Notificaciones por WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Si activás esta opción, vas a recibir un WhatsApp cada vez que te
          asignen una tarea, te mencionen en un comentario o algo te venza.
          (El sistema queda activo cuando el bot de WhatsApp esté conectado.)
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label className="text-xs">Tu número de WhatsApp</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 351 555 5555"
              className="h-9"
            />
          </div>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm">
            <input
              type="checkbox"
              checked={optin}
              onChange={(e) => setOptin(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Activado
          </label>
        </div>
        <Button onClick={save} disabled={pending} size="sm">
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </CardContent>
    </Card>
  );
}
