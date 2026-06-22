"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Estado de la conexión a Gmail de la agencia (para traer CVs). Vive en la página
 * de Reclutamiento. Conectar/Reconectar dispara el OAuth de Google.
 */
export function RecruitmentGmailConnection({
  connectedEmail,
  migrated,
}: {
  connectedEmail: string | null;
  migrated: boolean;
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Mail className="h-4 w-4 text-primary" />
        {connectedEmail ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Gmail conectado: <b>{connectedEmail}</b>
          </span>
        ) : (
          <span className="text-muted-foreground">
            Conectá la casilla de la agencia para traer los CVs de los mails.
          </span>
        )}
      </div>
      <Button asChild variant={connectedEmail ? "outline" : "default"} size="sm" className="gap-1.5">
        <a href="/api/gmail/connect">
          <RefreshCw className="h-3.5 w-3.5" />
          {connectedEmail ? "Reconectar" : "Conectar Gmail"}
        </a>
      </Button>
    </div>
  );
}
