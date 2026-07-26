"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Conexión a Gmail de la agencia (para traer CVs). El token se refresca solo
 * (on-demand al importar + cron diario), así que cuando está todo bien esta
 * tarjeta NO se muestra: es 100% automática. Solo aparece si Gmail no está
 * conectado todavía, o si el refresh viene fallando (se cayó de verdad).
 */
export function RecruitmentGmailConnection({
  connectedEmail,
  migrated,
  broken = false,
}: {
  connectedEmail: string | null;
  migrated: boolean;
  /** true si está conectado pero el auto-refresh viene fallando (token vencido/revocado). */
  broken?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  // Muestra el resultado del callback de OAuth (?gmail=ok:email | error:...).
  useEffect(() => {
    const g = params.get("gmail");
    if (!g) return;
    if (g.startsWith("ok:")) toast.success(`Gmail conectado (${g.slice(3)}).`);
    else if (g === "error:sin_refresh")
      toast.error("Google no devolvió permiso de sincronización. Reintentá la conexión.");
    else if (g.startsWith("error:")) toast.error(`No se pudo conectar Gmail: ${g.slice(6)}`);
    router.replace("/reclutamiento");
  }, [params, router]);

  if (!migrated) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        Para traer CVs desde Gmail, primero aplicá la migración{" "}
        <code>0095_gmail_account.sql</code> y completá el setup de Google (te paso la guía).
      </div>
    );
  }

  // Todo en orden y conectado → invisible: la sincronización es automática.
  if (connectedEmail && !broken) return null;

  // Se cayó de verdad: aviso ámbar con el botón para reconectar a mano.
  if (connectedEmail && broken) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Gmail (<b>{connectedEmail}</b>) se desconectó y no se está
            sincronizando solo. Reconectalo una vez para que vuelva a traer los CVs.
          </span>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <a href="/api/gmail/connect">
            <RefreshCw className="h-3.5 w-3.5" /> Reconectar
          </a>
        </Button>
      </div>
    );
  }

  // Todavía no está conectado.
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4 text-primary" />
        Conectá la casilla de la agencia y los CVs entran solos al pool.
      </div>
      <Button asChild size="sm" className="gap-1.5">
        <a href="/api/gmail/connect">
          <RefreshCw className="h-3.5 w-3.5" /> Conectar Gmail
        </a>
      </Button>
    </div>
  );
}
