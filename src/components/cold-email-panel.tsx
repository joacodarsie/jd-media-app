"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Search, Send, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  programarEnviosDeCampana,
  enviarPrueba,
  enviarLoteAhora,
  cancelarPendientes,
  agregarBaja,
} from "@/app/(app)/prospeccion/email-actions";

export interface CampanaEmail {
  id: string;
  nombre: string;
  contactos: number;
  conEmail: number;
  sinEmailConWeb: number;
  sinNada: number;
  enCola: number;
  enviados: number;
  tieneMensaje: boolean;
}

export function ColdEmailPanel({
  campanas,
  configurado,
  puedeMandar,
}: {
  campanas: CampanaEmail[];
  configurado: boolean;
  puedeMandar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [buscando, setBuscando] = useState<string | null>(null);
  const [asunto, setAsunto] = useState("Una idea para [EMPRESA]");
  const [baja, setBaja] = useState("");

  /** Busca los emails de a tandas hasta que no queden pendientes. */
  async function buscarEmails(c: CampanaEmail) {
    setBuscando(c.id);
    try {
      let total = 0;
      for (let vuelta = 0; vuelta < 20; vuelta++) {
        const res = await fetch(`/api/prospeccion/${c.id}/emails`, { method: "POST" });
        const data = (await res.json()) as {
          error?: string;
          encontrados?: number;
          pendientes?: number;
          revisados?: number;
        };
        if (data.error) {
          toast.error(data.error);
          break;
        }
        total += data.encontrados ?? 0;
        toast.info(
          `${total} emails encontrados${data.pendientes ? ` · quedan ${data.pendientes} sitios` : ""}`
        );
        if (!data.pendientes || !data.revisados) break;
      }
      toast.success(`Listo: ${total} emails nuevos en ${c.nombre}`);
      router.refresh();
    } finally {
      setBuscando(null);
    }
  }

  function programar(c: CampanaEmail) {
    start(async () => {
      const res = await programarEnviosDeCampana(c.id, asunto);
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (!("programados" in res)) return;
      if (!res.programados) {
        toast.info(
          res.sinEmail
            ? `No hay nadie nuevo para encolar. Hay ${res.sinEmail} contactos sin email: probá "Buscar emails".`
            : "No hay nadie nuevo para encolar."
        );
        return;
      }
      toast.success(`${res.programados} mails en cola`);
      router.refresh();
    });
  }

  function mandarPrueba() {
    start(async () => {
      const res = await enviarPrueba();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if ("to" in res)
        toast.success(`Prueba enviada a ${res.to}. Respondela para probar el Reply-To.`);
    });
  }

  function mandarAhora() {
    start(async () => {
      const res = await enviarLoteAhora();
      if ("error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (!("enviados" in res)) return;
      if (!res.configurado) {
        toast.error(res.detalle[0] ?? "Falta configurar el envío.");
        return;
      }
      toast.success(
        `${res.enviados} enviados${res.errores ? ` · ${res.errores} con error` : ""} · quedan ${res.pendientes}`
      );
      if (res.detalle.length) console.warn(res.detalle);
      router.refresh();
    });
  }

  function cancelar(c: CampanaEmail) {
    if (!confirm(`¿Sacar de la cola los ${c.enCola} mails pendientes de ${c.nombre}?`)) return;
    start(async () => {
      const res = await cancelarPendientes(c.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.cancelados} sacados de la cola`);
      router.refresh();
    });
  }

  function cargarBaja() {
    const email = baja.trim();
    if (!email) return;
    start(async () => {
      const res = await agregarBaja(email);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Agregado a la lista de bajas");
      setBaja("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
        <div className="min-w-[260px] flex-1">
          <label className="text-xs font-medium text-muted-foreground">
            Asunto (podés usar [EMPRESA])
          </label>
          <Input
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            className="mt-1 h-9"
            placeholder="Una idea para [EMPRESA]"
          />
        </div>
        {/* Antes de mandarle a un lead conviene ver el mail con los propios ojos. */}
        <Button
          variant="outline"
          onClick={mandarPrueba}
          disabled={pending || !configurado}
          className="h-9"
        >
          <Mail className="mr-1.5 h-4 w-4" />
          Mandarme una prueba
        </Button>
        {puedeMandar && (
          <Button onClick={mandarAhora} disabled={pending || !configurado} className="h-9">
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Mandar el lote de hoy
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {campanas.map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {c.contactos} contactos · <b>{c.conEmail}</b> con email ·{" "}
                  {c.sinEmailConWeb} por buscar · {c.sinNada} sin web ni email
                  {c.enviados > 0 && <> · {c.enviados} enviados</>}
                  {c.enCola > 0 && <> · {c.enCola} en cola</>}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => buscarEmails(c)}
                  disabled={!!buscando || c.sinEmailConWeb === 0}
                  title={
                    c.sinEmailConWeb === 0
                      ? "No quedan sitios web por revisar"
                      : "Entra al sitio de cada empresa y saca el mail. No gasta tokens."
                  }
                >
                  {buscando === c.id ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-1.5 h-4 w-4" />
                  )}
                  Buscar emails ({c.sinEmailConWeb})
                </Button>
                <Button
                  size="sm"
                  onClick={() => programar(c)}
                  disabled={pending || c.conEmail === 0 || !c.tieneMensaje}
                  title={
                    !c.tieneMensaje
                      ? "La campaña no tiene mensaje: generalo primero en la campaña"
                      : "Arma la cola de envíos"
                  }
                >
                  <Mail className="mr-1.5 h-4 w-4" />
                  Programar envíos
                </Button>
                {c.enCola > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelar(c)}
                    disabled={pending}
                  >
                    <X className="mr-1.5 h-4 w-4" />
                    Vaciar cola
                  </Button>
                )}
              </div>
            </div>
            {!c.tieneMensaje && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Esta campaña todavía no tiene mensaje. Generalo y elegí cuál usar
                en la campaña: el email usa el mismo texto que WhatsApp.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3">
        <div className="min-w-[240px] flex-1">
          <label className="text-xs font-medium text-muted-foreground">
            Dar de baja a mano (alguien que pidió que no le escribamos más)
          </label>
          <Input
            value={baja}
            onChange={(e) => setBaja(e.target.value)}
            className="mt-1 h-9"
            placeholder="mail@empresa.com"
          />
        </div>
        <Button variant="outline" onClick={cargarBaja} disabled={pending} className="h-9">
          Agregar a bajas
        </Button>
      </div>
    </div>
  );
}
