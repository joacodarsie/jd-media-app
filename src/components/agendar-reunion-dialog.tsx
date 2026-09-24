"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { agendarReunionProspecto } from "@/app/(app)/prospeccion/reunion-actions";

/** "YYYY-MM-DD" y "HH:MM" locales para los inputs. */
function partesLocales(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dia: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Pide día y hora de la reunión con un prospecto. Al guardar, el contacto
 * pasa a "reunión", la reunión queda en la Agenda y les llega el aviso a
 * quien contacta y al director. Después ofrece sumarla a Google Calendar.
 */
export function AgendarReunionDialog({
  contacto,
  onClose,
  onAgendada,
}: {
  /** null = cerrado. */
  contacto: { id: string; empresa: string; reunion_fecha?: string | null; meet_link?: string | null } | null;
  onClose: () => void;
  onAgendada?: (id: string, inicioIso: string) => void;
}) {
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [duracion, setDuracion] = useState("45");
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();

  // Al abrir: la fecha ya cargada, o mañana a las 10.
  useEffect(() => {
    if (!contacto) return;
    const base = contacto.reunion_fecha
      ? new Date(contacto.reunion_fecha)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(10, 0, 0, 0);
          return d;
        })();
    const p = partesLocales(base);
    setDia(p.dia);
    setHora(p.hora);
    setLink(contacto.meet_link ?? "");
  }, [contacto]);

  function guardar() {
    if (!contacto) return;
    if (!dia || !hora) return void toast.error("Poné el día y la hora.");
    const inicio = new Date(`${dia}T${hora}:00`);
    if (Number.isNaN(inicio.getTime())) return void toast.error("La fecha no es válida.");
    start(async () => {
      const res = await agendarReunionProspecto({
        contactId: contacto.id,
        inicio: inicio.toISOString(),
        duracionMin: Number(duracion),
        link: link || null,
      });
      if ("error" in res && res.error) return void toast.error(res.error);
      if (!("ok" in res)) return;
      onAgendada?.(contacto.id, inicio.toISOString());
      onClose();
      toast.success(`Reunión con ${contacto.empresa}: ${res.cuando}. Les llegó el aviso a los dos.`, {
        duration: 12000,
        action: {
          label: "Sumar a Google Calendar",
          onClick: () => window.open(res.googleCalendar, "_blank", "noopener,noreferrer"),
        },
      });
    });
  }

  return (
    <Dialog open={!!contacto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-violet-500" />
            <span className="truncate">Reunión con {contacto?.empresa}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Día</Label>
              <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Duración</Label>
            <select
              value={duracion}
              onChange={(e) => setDuracion(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
            >
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Link de la reunión (opcional)</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://meet.google.com/…"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Queda en la Agenda y les avisa a quien contacta y a dirección, en la plataforma y en el
            celular. La mañana de la reunión llega un recordatorio.
          </p>
          <Button onClick={guardar} disabled={pending} className="w-full">
            {pending ? "Agendando…" : "Agendar reunión"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
