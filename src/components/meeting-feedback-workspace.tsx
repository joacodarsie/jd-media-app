"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { getMeetingFeedback } from "@/app/(app)/comercial/feedback/actions";

export function MeetingFeedbackWorkspace() {
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    if (transcript.trim().length < 80) {
      toast.error("Pegá una transcripción más completa.");
      return;
    }
    start(async () => {
      setFeedback(null);
      const res = await getMeetingFeedback(transcript);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setFeedback(res.feedback);
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <label className="text-sm font-medium">
            Transcripción de la reunión comercial
          </label>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={10}
            placeholder="Pegá acá la transcripción (o un resumen detallado) de la reunión con el prospecto. Cuanto más completa, mejor el análisis."
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              La IA analiza tu técnica de venta y te devuelve qué mejorar para la
              próxima. No se guarda en ningún lado.
            </p>
            <Button onClick={run} disabled={pending || transcript.trim().length < 80}>
              {pending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-4 w-4" />
              )}
              Analizar reunión
            </Button>
          </div>
        </CardContent>
      </Card>

      {pending && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analizando la reunión y armando tu feedback…
            </p>
          </CardContent>
        </Card>
      )}

      {feedback && !pending && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Feedback de la reunión
            </div>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Markdown>{feedback}</Markdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
