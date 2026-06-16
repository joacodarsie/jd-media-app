"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Building2 } from "lucide-react";

// Identificador del portfolio empresarial (Business) de JD Media en Meta.
// Es lo que el cliente pega para darnos acceso como socio.
const JDMEDIA_BUSINESS_ID = "570336019465694";

export function JdMediaPartnerCard() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(JDMEDIA_BUSINESS_ID).then(
      () => {
        setCopied(true);
        toast.success("ID copiado.");
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("No se pudo copiar.")
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Acceso para JD Media (modelo socio)</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        El cliente es <b>dueño</b> de sus activos y nos da acceso como <b>socio con
        administración total</b> (además de tu usuario admin). Para eso necesita el ID
        del portfolio empresarial de JD Media:
      </p>

      {/* ID copiable */}
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-md border bg-card px-3 py-2 font-mono text-sm tracking-wide">
          {JDMEDIA_BUSINESS_ID}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium transition hover:bg-muted"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/* Cómo lo hace el cliente */}
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Cómo darnos el acceso (desde el Business del cliente):</p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>
            En <b>business.facebook.com</b> → arriba a la izquierda, elegir el negocio del
            cliente.
          </li>
          <li>
            <b>Configuración del negocio → Usuarios → Socios</b>.
          </li>
          <li>
            <b>Agregar → &ldquo;Dar acceso a activos a un socio&rdquo;</b> y pegar el ID de
            arriba.
          </li>
          <li>
            Tildar y dar <b>acceso total / Administrar</b> a: <b>Página de Facebook</b>,
            <b> Cuenta publicitaria</b> y <b>Cuenta de Instagram</b> (y píxel si hay).
          </li>
          <li>Confirmar.</li>
        </ol>
        <p className="pt-1">
          Después, desde el Business de JD Media, asigná esos 3 activos al usuario del
          sistema <b>&ldquo;jdmedia&rdquo;</b> (los 3 pasos en amarillo de abajo).
        </p>
      </div>
    </div>
  );
}
