"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ApprovalLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${origin}/aprobacion/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Link público para que el cliente apruebe sus piezas pendientes. No
        requiere login. Compartilo por WhatsApp.
      </p>
      <div className="flex items-stretch gap-1.5">
        <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
          {url}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copy}
          className="shrink-0"
          title="Copiar link"
        >
          {copied ? (
            <>
              <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3.5 w-3.5" />
              Copiar
            </>
          )}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-muted"
          title="Abrir en otra pestaña"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
