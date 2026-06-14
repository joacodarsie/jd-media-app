"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Copy as CopyIcon, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

/**
 * Visor de solo lectura del documento guía del meet de onboarding.
 * Lo prepara Dirección en el onboarding inicial; la coordinación lo usa como
 * referencia para conducir la reunión.
 */
export function MeetGuideViewer({
  markdown,
  generatedAt,
}: {
  markdown: string | null;
  generatedAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function copy() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("No se pudo copiar.")
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-medium">Documento guía del meet de onboarding</div>
            <div className="text-xs text-muted-foreground">
              {markdown
                ? `Lo prepara Dirección · ${
                    generatedAt
                      ? new Date(generatedAt).toLocaleString("es-AR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "listo"
                  }. Usalo para conducir la reunión.`
                : "Todavía no está generado: lo prepara Dirección en el onboarding inicial."}
            </div>
          </div>
        </div>
        {markdown && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={copy}>
              {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <CopyIcon className="mr-1 h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button variant={expanded ? "outline" : "default"} size="sm" onClick={() => setExpanded((e) => !e)}>
              {expanded ? (
                <>
                  <ChevronUp className="mr-1 h-3.5 w-3.5" /> Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="mr-1 h-3.5 w-3.5" /> Ver documento
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      {markdown && expanded && (
        <div className="px-4 py-4">
          <Markdown>{markdown}</Markdown>
        </div>
      )}
    </div>
  );
}
