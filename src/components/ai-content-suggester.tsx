"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  suggestPublicationContent,
  type AISuggestion,
} from "@/app/(app)/contenidos/ai-actions";

export interface AppliedSuggestion {
  copy: string;
  hashtags: string;
  descripcion: string;
  guion: string | null;
  titulo: string;
}

export function AIContentSuggester({
  clienteId,
  tipo,
  red,
  onApply,
  disabled,
}: {
  clienteId: string | undefined;
  tipo: string;
  red: string;
  onApply: (s: AppliedSuggestion) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState("");
  const [pending, start] = useTransition();
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [docsUsed, setDocsUsed] = useState<string[]>([]);

  function reset() {
    setHint("");
    setSuggestion(null);
    setDocsUsed([]);
  }

  function generate() {
    if (!clienteId) {
      toast.error("Elegí primero un cliente.");
      return;
    }
    setSuggestion(null);
    setDocsUsed([]);
    start(async () => {
      const res = await suggestPublicationContent({
        cliente_id: clienteId,
        tipo,
        red,
        hint: hint.trim() || undefined,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSuggestion(res.suggestion);
      setDocsUsed(res.docsUsed ?? []);
    });
  }

  function applyIt() {
    if (!suggestion) return;
    onApply({
      copy: suggestion.copy,
      hashtags: suggestion.hashtags,
      descripcion: suggestion.descripcion,
      guion: suggestion.guion,
      titulo: suggestion.titulo,
    });
    setOpen(false);
    reset();
    toast.success("Sugerencia aplicada");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="gap-1.5"
        title={
          clienteId
            ? "Sugerir ideas con IA usando el contexto del cliente"
            : "Elegí un cliente primero"
        }
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Sugerir con IA
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Sugerir contenido con IA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="rounded-md bg-primary/10 px-2 py-1.5 text-[11px] text-foreground/80">
            Usa el rubro, las notas, los documentos cargados y los últimos
            posts del cliente para mantener consistencia.
          </p>
          <div>
            <Label className="text-xs">Tema o idea (opcional)</Label>
            <Textarea
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Ej: queremos hablar de la nueva colección de invierno; o dejá vacío para que proponga algo libre"
              className="min-h-[60px]"
            />
          </div>

          {suggestion && (
            <div className="space-y-3 rounded-md border bg-card p-3">
              {docsUsed.length > 0 && (
                <div className="rounded-md bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  ✓ Leyó {docsUsed.length} doc{docsUsed.length > 1 ? "s" : ""}{" "}
                  del cliente: <i>{docsUsed.join(", ")}</i>
                </div>
              )}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Idea
                </div>
                <p className="text-sm font-medium">{suggestion.titulo}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {suggestion.notas}
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Copy
                </div>
                <p className="whitespace-pre-wrap text-sm">{suggestion.copy}</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Hashtags
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {suggestion.hashtags}
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción visual
                </div>
                <p className="text-sm">{suggestion.descripcion}</p>
              </div>
              {suggestion.guion && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Guion
                  </div>
                  <p className="whitespace-pre-wrap text-sm">
                    {suggestion.guion}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {suggestion ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={generate}
                disabled={pending}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Otra idea
              </Button>
              <Button type="button" onClick={applyIt}>
                Aplicar al formulario
              </Button>
            </>
          ) : (
            <Button type="button" onClick={generate} disabled={pending || !clienteId}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pensando…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar idea
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
