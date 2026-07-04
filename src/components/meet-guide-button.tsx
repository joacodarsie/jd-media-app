"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, ClipboardList, Copy, Check } from "lucide-react";
import { generateMeetGuide } from "@/app/reporte/cliente/[id]/actions";
import { Markdown } from "@/components/markdown";

/**
 * Guión INTERNO del meet mensual con el cliente. Solo el equipo lo ve (no se
 * muestra en el portal). Se genera con IA a partir de las métricas del mes y la
 * comparación con el mes anterior.
 */
export function MeetGuideButton({
  clienteId,
  mes,
  initialGuion,
}: {
  clienteId: string;
  mes: string;
  initialGuion: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [guion, setGuion] = useState<string | null>(initialGuion);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function run() {
    start(async () => {
      const res = await generateMeetGuide(clienteId, mes);
      if ("error" in res) return void toast.error(res.error);
      setGuion(res.texto ?? null);
      setOpen(true);
      toast.success(guion ? "Guión regenerado." : "Guión del meet generado.");
      router.refresh();
    });
  }

  function copy() {
    if (!guion) return;
    navigator.clipboard?.writeText(guion).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-violet-600" />
          <div>
            <p className="text-sm font-semibold">Guión del meet con el cliente</p>
            <p className="text-xs text-muted-foreground">
              Ayudamemoria interno para conducir la reunión (no lo ve el cliente).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {guion && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              {open ? "Ocultar" : "Ver"}
            </button>
          )}
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-60 dark:bg-transparent"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-violet-600" />
            )}
            {guion ? "Regenerar guión" : "Generar guión"}
          </button>
        </div>
      </div>

      {open && guion && (
        <div className="mt-3 rounded-md border bg-card p-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <Markdown>{guion}</Markdown>
        </div>
      )}
    </div>
  );
}
