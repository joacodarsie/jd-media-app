"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";
import { invitarReunion } from "@/app/(app)/clientes/reunion-invitar-actions";
import { whatsappLink } from "@/lib/payment-reminder";

/**
 * Manda la invitación a la reunión mensual: por WhatsApp al contacto o copiada
 * para pegar en el grupo de la cuenta. Las dos dejan registrado que se invitó.
 */
export function InvitarReunionBoton({ clienteId, ticketId, yaInvitada }: { clienteId: string; ticketId: string; yaInvitada: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function porWhatsapp() {
    // La pestaña se abre ya (en el clic) para que el navegador no la bloquee.
    const ventana = window.open("about:blank", "_blank");
    start(async () => {
      const r = await invitarReunion({ clienteId, ticketId });
      if (!r.ok) {
        ventana?.close();
        return void toast.error(r.error);
      }
      const link = whatsappLink(r.telefono, r.mensaje);
      if (!link) {
        ventana?.close();
        await navigator.clipboard.writeText(r.mensaje).catch(() => {});
        return void toast.message("La cuenta no tiene un teléfono usable: copié el mensaje para el grupo.");
      }
      if (ventana) ventana.location.href = link;
      else window.location.href = link;
      router.refresh();
    });
  }

  function copiar() {
    start(async () => {
      const r = await invitarReunion({ clienteId, ticketId });
      if (!r.ok) return void toast.error(r.error);
      try {
        await navigator.clipboard.writeText(r.mensaje);
        toast.success("Mensaje copiado: pegalo en el grupo de la cuenta.");
      } catch {
        toast.error("No pude copiar el mensaje.");
      }
      router.refresh();
    });
  }

  return (
    <span className="flex shrink-0 gap-1.5">
      <button
        type="button"
        onClick={porWhatsapp}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Send className="h-3 w-3" /> {yaInvitada ? "Reenviar" : "Invitar"}
      </button>
      <button
        type="button"
        onClick={copiar}
        disabled={pending}
        title="Copiar el mensaje para el grupo de WhatsApp"
        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
      >
        <Copy className="h-3 w-3" /> Para el grupo
      </button>
    </span>
  );
}
