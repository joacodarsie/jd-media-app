"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Square, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BatchResult {
  ok?: number;
  total?: number;
  importedTotal?: number;
  remaining?: number;
  done?: boolean;
  error?: string;
  reconnect?: boolean;
}

/**
 * Analiza TODOS los CVs del Gmail hacia el pool, en loop automático: llama al
 * endpoint en tandas (cada una procesa varios CVs en paralelo y corta antes de
 * los 60s) hasta terminar. Muestra progreso y se puede frenar. Es resumible:
 * saltea los ya analizados, así si se corta se retoma sin reprocesar.
 */
export function RecruitmentPoolImport({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const stopRef = useRef(false);

  async function runLoop() {
    setRunning(true);
    setNeedsReconnect(false);
    stopRef.current = false;
    let sessionOk = 0;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (stopRef.current) break;
        const res = await fetch("/api/reclutamiento/pool/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = (await res.json().catch(() => ({}))) as BatchResult;
        if (!res.ok || data.error) {
          if (data.reconnect) setNeedsReconnect(true);
          toast.error(
            data.error ??
              (res.status === 504
                ? "Una tanda tardó demasiado. Volvé a tocar para seguir."
                : `Error ${res.status}`)
          );
          break;
        }
        sessionOk += data.ok ?? 0;
        if (typeof data.importedTotal === "number") setImported(data.importedTotal);
        if (typeof data.total === "number") setTotal(data.total);
        router.refresh();
        if (data.done || (data.ok ?? 0) === 0) {
          toast.success(
            sessionOk > 0
              ? `Listo: ${sessionOk} CV(s) analizados en esta sesión.`
              : "No quedaban CVs nuevos para analizar."
          );
          break;
        }
      }
    } catch {
      toast.error("Se cortó la conexión. Volvé a tocar para retomar (no se pierde lo hecho).");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  if (!connected) return null;

  const pct =
    imported != null && total != null && total > 0
      ? Math.min(100, Math.round((imported / total) * 100))
      : null;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Analizar todos los CVs de Gmail</p>
          <p className="text-xs text-muted-foreground">
            La IA lee cada CV y lo clasifica para su mejor rol. Dejá la pestaña
            abierta; se puede cortar y retomar.
          </p>
        </div>
        {running ? (
          <Button variant="outline" onClick={() => (stopRef.current = true)}>
            <Square className="mr-2 h-4 w-4" /> Frenar
          </Button>
        ) : (
          <Button onClick={runLoop}>
            <Sparkles className="mr-2 h-4 w-4" /> Analizar todo
          </Button>
        )}
      </div>

      {needsReconnect && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">
          <span className="text-amber-800 dark:text-amber-200">
            El acceso a Gmail se venció. Reconectá y volvé a tocar “Analizar todo”.
          </span>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <a href="/api/gmail/connect">
              <Mail className="h-3.5 w-3.5" /> Reconectar Gmail
            </a>
          </Button>
        </div>
      )}

      {(running || imported != null) && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct ?? 5}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {running && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
            {imported != null && total != null
              ? `${imported} de ${total} CVs analizados${pct != null ? ` (${pct}%)` : ""}`
              : "Procesando…"}
          </p>
        </div>
      )}
    </div>
  );
}
