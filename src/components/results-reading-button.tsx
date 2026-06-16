"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { generateResultsReading } from "@/app/reporte/cliente/[id]/actions";

export function ResultsReadingButton({
  clienteId,
  mes,
  hasReading,
}: {
  clienteId: string;
  mes: string;
  hasReading: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await generateResultsReading(clienteId, mes);
      if ("error" in res) return void toast.error(res.error);
      toast.success(hasReading ? "Lectura regenerada." : "Lectura generada.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
      title="Interpreta los resultados del mes (Instagram + pauta) con IA"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-emerald-600" />}
      {hasReading ? "Regenerar lectura IA" : "Lectura IA"}
    </button>
  );
}
