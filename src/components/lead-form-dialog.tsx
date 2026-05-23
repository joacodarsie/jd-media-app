"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertLead, type LeadInput, type LeadStage } from "@/app/(app)/comercial/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STAGE_LABEL: Record<LeadStage, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  propuesta: "Propuesta enviada",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export interface LeadInit {
  id?: string;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  origen: string | null;
  servicio_interesado: string | null;
  monto_estimado: number | null;
  moneda: string;
  stage: LeadStage;
  asignado_a_id: string | null;
  notas: string | null;
  proxima_accion: string | null;
  proxima_accion_at: string | null;
  perdido_motivo: string | null;
}

const NONE = "__none__";

export function LeadFormDialog({
  mode,
  lead,
  defaultStage,
  services,
  users,
  trigger,
}: {
  mode: "create" | "edit";
  lead?: LeadInit;
  defaultStage?: LeadStage;
  services: { slug: string; name: string }[];
  users: { id: string; nombre: string }[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [nombre, setNombre] = useState(lead?.nombre ?? "");
  const [empresa, setEmpresa] = useState(lead?.empresa ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [telefono, setTelefono] = useState(lead?.telefono ?? "");
  const [origen, setOrigen] = useState(lead?.origen ?? "");
  const [servicio, setServicio] = useState<string>(
    lead?.servicio_interesado ?? NONE
  );
  const [monto, setMonto] = useState<string>(
    lead?.monto_estimado != null ? String(lead.monto_estimado) : ""
  );
  const [moneda, setMoneda] = useState(lead?.moneda ?? "ARS");
  const [stage, setStage] = useState<LeadStage>(
    lead?.stage ?? defaultStage ?? "nuevo"
  );
  const [asignado, setAsignado] = useState<string>(
    lead?.asignado_a_id ?? NONE
  );
  const [notas, setNotas] = useState(lead?.notas ?? "");
  const [proximaAccion, setProximaAccion] = useState(lead?.proxima_accion ?? "");
  const [proximaFecha, setProximaFecha] = useState(
    lead?.proxima_accion_at ? lead.proxima_accion_at.slice(0, 10) : ""
  );
  const [perdidoMotivo, setPerdidoMotivo] = useState(lead?.perdido_motivo ?? "");

  function submit() {
    if (!nombre.trim()) {
      toast.error("Falta nombre.");
      return;
    }
    const payload: LeadInput = {
      id: lead?.id,
      nombre,
      empresa,
      email,
      telefono,
      origen,
      servicio_interesado: servicio === NONE ? null : servicio,
      monto_estimado: monto ? Number(monto) : null,
      moneda,
      stage,
      asignado_a_id: asignado === NONE ? null : asignado,
      notas,
      proxima_accion: proximaAccion,
      proxima_accion_at: proximaFecha
        ? new Date(proximaFecha + "T12:00:00").toISOString()
        : null,
      perdido_motivo: stage === "perdido" ? perdidoMotivo : null,
    };
    start(async () => {
      const res = await upsertLead(payload);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Guardado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo lead" : "Editar lead"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre del contacto</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Origen</Label>
              <Input
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                placeholder="Instagram, referido, web, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Servicio interesado</Label>
              <Select value={servicio} onValueChange={setServicio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin definir</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto estimado</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0"
                />
                <Select value={moneda} onValueChange={setMoneda}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Asignado a</Label>
              <Select value={asignado} onValueChange={setAsignado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as LeadStage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Próxima acción</Label>
              <Input
                value={proximaAccion}
                onChange={(e) => setProximaAccion(e.target.value)}
                placeholder="Mandar propuesta, llamar, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha próxima acción</Label>
              <Input
                type="date"
                value={proximaFecha}
                onChange={(e) => setProximaFecha(e.target.value)}
              />
            </div>
          </div>

          {stage === "perdido" && (
            <div className="space-y-2">
              <Label>Motivo de pérdida</Label>
              <Input
                value={perdidoMotivo}
                onChange={(e) => setPerdidoMotivo(e.target.value)}
                placeholder="Precio, timing, eligió competencia…"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              rows={4}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Contexto, necesidades, conversaciones previas…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
