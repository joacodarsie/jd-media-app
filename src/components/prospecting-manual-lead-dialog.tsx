"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { addManualLead } from "@/app/(app)/prospeccion/actions";

/** Carga manual de un lead que encontraste vos. La IA después le arma el mensaje. */
export function ProspectingManualLeadDialog({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    empresa: "",
    descripcion: "",
    ciudad: "",
    pais: "",
    sitio_web: "",
    instagram: "",
    telefono: "",
    email: "",
    por_que: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.empresa.trim()) return void toast.error("Poné el nombre de la empresa.");
    start(async () => {
      const res = await addManualLead(campaignId, {
        empresa: f.empresa,
        descripcion: f.descripcion || null,
        ciudad: f.ciudad || null,
        pais: f.pais || null,
        sitio_web: f.sitio_web || null,
        instagram: f.instagram || null,
        telefono: f.telefono || null,
        email: f.email || null,
        por_que: f.por_que || null,
      });
      if ("error" in res) return void toast.error(res.error);
      toast.success("Lead agregado");
      setOpen(false);
      setF({ empresa: "", descripcion: "", ciudad: "", pais: "", sitio_web: "", instagram: "", telefono: "", email: "", por_que: "" });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Cargar lead a mano
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cargar lead manual</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Encontraste una empresa vos. Cargá lo que tengas — con el teléfono o el
          Instagram alcanza. Después tocás <b>Generar mensaje</b>.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Empresa *</Label>
            <Input value={f.empresa} onChange={set("empresa")} placeholder="Ej: Gimnasio Olimpo" />
          </div>
          <div>
            <Label>Qué hace</Label>
            <Input value={f.descripcion} onChange={set("descripcion")} placeholder="Ej: cadena de 2 gimnasios" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ciudad</Label>
              <Input value={f.ciudad} onChange={set("ciudad")} />
            </div>
            <div>
              <Label>País</Label>
              <Input value={f.pais} onChange={set("pais")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>WhatsApp (internacional)</Label>
              <Input value={f.telefono} onChange={set("telefono")} placeholder="+54 351 ..." />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input value={f.instagram} onChange={set("instagram")} placeholder="@marca" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sitio web</Label>
              <Input value={f.sitio_web} onChange={set("sitio_web")} placeholder="marca.com" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={f.email} onChange={set("email")} />
            </div>
          </div>
          <div>
            <Label>Por qué es buen lead</Label>
            <Textarea rows={2} value={f.por_que} onChange={set("por_que")} placeholder="Ej: marca conocida pero IG sin postear hace meses, sin pauta." />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
