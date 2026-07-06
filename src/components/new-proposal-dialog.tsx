"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDirectProposal } from "@/app/(app)/comercial/actions";
import { CLIENT_PACK_LABEL } from "@/lib/constants";

const NONE = "__none__";

/**
 * Carga directa de un prospecto que ya te pasó los datos → crea una propuesta y
 * te lleva a armar la carta acuerdo. Sin pasar por el pipeline de leads.
 */
export function NewProposalDialog({
  services,
  users,
  coordinadores,
  defaultCoordinadorId,
  trigger,
}: {
  services: { slug: string; name: string }[];
  users: { id: string; nombre: string }[];
  /** Candidatas a coordinar la cuenta (rol coordinación). */
  coordinadores?: { id: string; nombre: string }[];
  defaultCoordinadorId?: string | null;
  trigger?: React.ReactNode;
}) {
  const coords = coordinadores ?? [];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [servicio, setServicio] = useState(NONE);
  const [pack, setPack] = useState("Presencia");
  const [monto, setMonto] = useState("");
  const [cerradoPor, setCerradoPor] = useState(NONE);
  const [coordinador, setCoordinador] = useState(defaultCoordinadorId ?? NONE);

  function submit() {
    if (!nombre.trim()) return void toast.error("Poné el nombre del cliente.");
    start(async () => {
      const res = await createDirectProposal({
        nombre,
        contacto_nombre: contacto || null,
        email: email || null,
        telefono: telefono || null,
        servicio: servicio === NONE ? null : servicio,
        pack: servicio === "gestion_redes" ? pack : null,
        monto_estimado: monto ? Number(monto) : null,
        cerrado_por_id: cerradoPor === NONE ? null : cerradoPor,
        coordinador_id: coordinador === NONE ? null : coordinador,
      });
      if ("error" in res) return void toast.error(res.error);
      toast.success("Propuesta creada. Completá el contrato y generá la carta.");
      setOpen(false);
      router.push(`/clientes/${res.clientId}/onboarding`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <FileText className="mr-2 h-4 w-4" /> Nueva propuesta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva propuesta</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cargá los datos del prospecto que ya te los pasó. Se crea una{" "}
          <b>propuesta</b> (no cuenta hasta que pague) y te lleva a armar la carta
          acuerdo + el mensaje de transferencia.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Cliente / empresa *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Estudio Lumina" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contacto (persona)</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Nombre y apellido" />
            </div>
            <div>
              <Label>WhatsApp / teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3511234567" />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@cliente.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Servicio interesado</Label>
              <Select value={servicio} onValueChange={setServicio}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
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
            {servicio === "gestion_redes" && (
              <div>
                <Label>Pack</Label>
                <Select value={pack} onValueChange={setPack}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLIENT_PACK_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Monto mensual (ARS)</Label>
              <Input type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" />
            </div>
          </div>
          <div>
            <Label>Cerrado por (comercial)</Label>
            <Select value={cerradoPor} onValueChange={setCerradoPor}>
              <SelectTrigger>
                <SelectValue placeholder="Vos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Yo (quien carga)</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Quien cerró la venta — define la comisión del primer mes cuando se active.
            </p>
          </div>
          {coords.length > 0 && (
            <div>
              <Label>Coordinador/a de la cuenta</Label>
              <Select value={coordinador} onValueChange={setCoordinador}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin asignar</SelectItem>
                  {coords.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Después ella asigna los puestos (CM, diseño, audiovisual) desde el
                onboarding de Gestión de Redes.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear propuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
