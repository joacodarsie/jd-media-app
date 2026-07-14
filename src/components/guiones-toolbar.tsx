"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Selector de persona (editor/diseñador) para la vista Guiones del mes. */
export function PersonaSelect({
  options,
  value,
}: {
  options: { id: string; nombre: string }[];
  value?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("persona", id);
    else next.delete("persona");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border bg-background px-2 text-sm"
    >
      <option value="">Todo el equipo</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          Solo lo de {o.nombre}
        </option>
      ))}
    </select>
  );
}

/** Imprime la página (el shell se oculta con @media print). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-9 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
    >
      🖨️ Imprimir / PDF
    </button>
  );
}

/** Copia un bloque de texto plano (una sección de guiones) al portapapeles. */
export function CopyBlockButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="shrink-0 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
    >
      {copied ? "Copiado ✓" : "Copiar"}
    </button>
  );
}
