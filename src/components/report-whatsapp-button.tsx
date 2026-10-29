"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Botón para enviarle al cliente el reporte del mes por WhatsApp. Arma un link
 * PÚBLICO del reporte (reusa el token del portal) que el cliente abre sin login,
 * y un mensaje listo. Si la cuenta todavía no tiene link de portal generado,
 * avisa para crearlo en la ficha.
 */
export function ReportWhatsappButton({
  clienteId,
  mes,
  mesLabel,
  telefono,
  token,
}: {
  clienteId: string;
  mes: string;
  mesLabel: string;
  telefono: string | null;
  token: string | null;
}) {
  const [copied, setCopied] = useState(false);
  // El dominio, recién en el navegador: así el servidor y el navegador dibujan
  // lo mismo (si no, React redibuja todo; 29/10/2026).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // Sin token de portal no se puede armar el link público.
  if (!token) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 text-sm">
          <p className="font-medium">Falta el link del portal</p>
          <p className="mt-1 text-muted-foreground">
            Para mandar el reporte al cliente, primero generá su link de portal en
            la ficha del cliente. Con eso se arma el link público del reporte.
          </p>
          <Link
            href={`/clientes/${clienteId}`}
            className="mt-2 inline-block font-medium text-primary underline underline-offset-2"
          >
            Ir a la ficha del cliente →
          </Link>
        </PopoverContent>
      </Popover>
    );
  }

  // Un solo link (17/10/2026): su plataforma, donde está el reporte de cada mes
  // junto con el calendario, el crecimiento y todo lo demás.
  const url = `${origin}/c/${token}?ver=resultados#reportes`;
  void mes;
  const mensaje = `Hola! 👋 Ya está el reporte de ${mesLabel} en tu plataforma de JD Media: ${url}\n\nAhí tenés los resultados de cada mes, tu calendario y cómo viene creciendo la cuenta. Cualquier consulta, quedamos a disposición. ¡Gracias por la confianza! — JD Media`;

  const waLink = telefono
    ? `https://wa.me/${telefono.replace(/[^\d]/g, "")}?text=${encodeURIComponent(mensaje)}`
    : null;

  function copyLink() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-[#25D366] text-white hover:bg-[#1ebe5b]"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3 text-sm">
        <div>
          <p className="font-medium">Enviar el reporte al cliente</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Link público (lo abre sin login). El mensaje ya viene armado.
          </p>
        </div>
        <div className="break-all rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          {url}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1"
            onClick={copyLink}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
          {waLink ? (
            <Button
              asChild
              size="sm"
              className="h-8 gap-1 bg-[#25D366] text-white hover:bg-[#1ebe5b]"
            >
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp
              </a>
            </Button>
          ) : (
            <span className="self-center text-xs text-muted-foreground">
              Sin teléfono · copiá el link
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
