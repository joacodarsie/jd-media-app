"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitAIFeedback } from "@/app/actions/ai-feedback";

/**
 * Botones de feedback rápido para outputs IA. 👍 / 👎 → guarda en
 * `ai_generations_feedback`. Al votar negativo, abre input para comentario corto.
 *
 * Uso:
 *   <AIFeedback feature="diagnostic" refId={diagnosticId} clienteId={clientId} model="claude-sonnet-4-6" />
 */
export function AIFeedback({
  feature,
  refId,
  clienteId,
  model,
  label = "¿Te sirvió este resultado?",
  compact = false,
}: {
  feature: string;
  refId?: string | null;
  clienteId?: string | null;
  model?: string | null;
  label?: string;
  compact?: boolean;
}) {
  const [submitted, setSubmitted] = useState<null | 1 | -1>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();

  function vote(rating: 1 | -1, comentario?: string) {
    setSubmitted(rating);
    start(async () => {
      const res = await submitAIFeedback({
        feature,
        rating,
        refId,
        clienteId,
        model,
        comentario,
      });
      if (res?.error) {
        toast.error(res.error);
        setSubmitted(null);
        return;
      }
      if (rating === -1) {
        // Si fue negativo, después del primer click abrimos comentario.
        // Si vino con comentario directamente, ya está completo.
        if (!comentario) setShowComment(true);
        else {
          setShowComment(false);
          toast.success("Gracias por el feedback");
        }
      } else {
        toast.success("Gracias por el feedback");
      }
    });
  }

  if (submitted && !showComment) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400",
          compact && "px-1.5 py-0.5 text-[11px]"
        )}
      >
        <Check className="h-3 w-3" /> Gracias por tu feedback
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1")}>
      <div className="flex items-center gap-2">
        {!compact && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => vote(1)}
          className={cn(
            "inline-flex items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400",
            compact ? "h-6 w-6" : "h-7 w-7"
          )}
          title="Buen resultado"
        >
          {pending && submitted === 1 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => vote(-1)}
          className={cn(
            "inline-flex items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-400",
            compact ? "h-6 w-6" : "h-7 w-7"
          )}
          title="Resultado flojo"
        >
          {pending && submitted === -1 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {showComment && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Qué falló? (opcional)"
            className="h-7 flex-1 rounded-md border bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            maxLength={300}
            autoFocus
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => vote(-1, comment)}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Enviar
          </button>
          <button
            type="button"
            onClick={() => setShowComment(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Saltar
          </button>
        </div>
      )}
    </div>
  );
}
