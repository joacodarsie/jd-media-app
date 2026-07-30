"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { armarCierre, armarEmail } from "@/lib/prospecting/cold-email";
import { guardarCierre } from "@/app/(app)/prospeccion/email-actions";

export interface CierreForm {
  oferta: string;
  codigo: string;
  web: string;
  instagram: string;
  whatsapp: string;
}

/**
 * Editor + previsualización del mail. Existe porque el dueño pidió "revisar qué
 * es lo que envío": acá ve el mail EXACTO que le va a llegar a un prospecto,
 * con la oferta y sus links, antes de que salga uno solo.
 */
export function ColdEmailCierre({
  inicial,
  ejemploCuerpo,
  firma,
  direccion,
}: {
  inicial: CierreForm;
  ejemploCuerpo: string;
  firma: string;
  direccion: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<CierreForm>(inicial);

  const set = (k: keyof CierreForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const preview = armarEmail({
    asuntoPlantilla: "Una idea para [EMPRESA]",
    cuerpoPlantilla: ejemploCuerpo,
    empresa: "Panadería del Centro",
    contacto: "Marcelo",
    remitente: { nombre: firma, agencia: "JD Media", direccion },
    bajaUrl: "https://jd-media-app.vercel.app/baja/ejemplo",
    cierre: form,
  });

  function guardar() {
    start(async () => {
      const res = await guardarCierre(form);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Guardado — sale así en los próximos envíos");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="font-semibold">Qué dice el mail</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        El cuerpo sale del mensaje de cada campaña. Esto es el cierre: la oferta y
        por dónde te contestan. <b>El código es lo que te deja medir</b> cuántos
        clientes salieron del mail.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Campo label="Oferta" valor={form.oferta} onChange={set("oferta")} placeholder="$50.000 de descuento en el primer mes" />
        <Campo label="Código para mencionar" valor={form.codigo} onChange={set("codigo")} placeholder="MAIL50" />
        <Campo label="WhatsApp" valor={form.whatsapp} onChange={set("whatsapp")} placeholder="+54 9 351 ..." />
        <Campo label="Instagram" valor={form.instagram} onChange={set("instagram")} placeholder="@jdmedia" />
        <Campo label="Web" valor={form.web} onChange={set("web")} placeholder="jdmedia.com" />
      </div>

      <Button onClick={guardar} disabled={pending} className="mt-3">
        Guardar
      </Button>

      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          Así le llega a un prospecto (ejemplo real):
        </p>
        <div className="mt-2 rounded-lg border bg-background p-3 text-sm">
          <p className="border-b pb-2 text-xs text-muted-foreground">
            Asunto: <b className="text-foreground">{preview.asunto}</b>
          </p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed">
            {preview.texto}
          </pre>
        </div>
        {!armarCierre(form) && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Sin oferta ni links el mail sale igual, pero pierde el gancho y no vas
            a poder medir de dónde vino el cliente.
          </p>
        )}
      </div>
    </div>
  );
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
}: {
  label: string;
  valor: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={valor} onChange={onChange} placeholder={placeholder} className="mt-1 h-9" />
    </div>
  );
}
