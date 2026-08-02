"use client";

import { hoyYmd } from "@/lib/dates";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CalendarCheck, Link2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registrarReunionMensual } from "@/app/(app)/clientes/actions";

/**
 * Acciones de calidad en la ficha del cliente: registrar la reunión mensual de
 * seguimiento y copiar el link de la encuesta de satisfacción (que es el mismo
 * del portal + /encuesta).
 */
export function ClientQualityActions({
  clienteId,
  periodo,
  reunionHecha,
  portalToken,
}: {
  clienteId: string;
  periodo: string;
  reunionHecha: boolean;
  portalToken: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(hoyYmd());
  const [notas, setNotas] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function guardar() {
    start(async () => {
      const res = await registrarReunionMensual({
        clienteId,
        periodo,
        fecha,
        notas: notas || null,
      });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Reunión registrada");
      setOpen(false);
      setNotas("");
      router.refresh();
    });
  }

  async function copiarEncuesta() {
    if (!portalToken) return;
    const url = `${window.location.origin}/encuesta/${portalToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Link de la encuesta copiado");
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <CalendarCheck className="h-3.5 w-3.5" />
          {reunionHecha ? "Editar reunión" : "Registrar reunión"}
        </Button>
        {portalToken && (
          <Button variant="outline" size="sm" onClick={copiarEncuesta} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
            Link de encuesta
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reunión de seguimiento del mes</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Dejá registrado que hablaste con el cliente y qué salió. Es la señal de
            calidad que no sale de ningún número.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">¿Qué salió de la reunión?</Label>
              <Textarea
                rows={4}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Cómo lo ve el cliente, qué pidió, qué hay que ajustar…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={guardar} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
