"use client";

import { Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LinkBorrador } from "@/lib/tareas/links";

/**
 * Filas de links de referencia (nombre + dirección) para cargar junto con una
 * tarea o una subtarea. No guarda nada: el formulario que lo usa normaliza con
 * `normalizarLinks` al enviar.
 */
export function LinksEditor({
  value,
  onChange,
  compacto = false,
}: {
  value: LinkBorrador[];
  onChange: (v: LinkBorrador[]) => void;
  compacto?: boolean;
}) {
  const set = (i: number, campo: keyof LinkBorrador, v: string) =>
    onChange(value.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));
  const alto = compacto ? "h-8 text-xs" : "h-9 text-sm";

  return (
    <div className="space-y-2">
      {value.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={f.label}
            onChange={(e) => set(i, "label", e.target.value)}
            placeholder="Nombre (ej: referencia de reel)"
            className={`${alto} w-2/5`}
          />
          <Input
            value={f.url}
            onChange={(e) => set(i, "url", e.target.value)}
            placeholder="https://…"
            className={`${alto} flex-1`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            title="Quitar link"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground"
        onClick={() => onChange([...value, { label: "", url: "" }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Agregar link
      </Button>
    </div>
  );
}
