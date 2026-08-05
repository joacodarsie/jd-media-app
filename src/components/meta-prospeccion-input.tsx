"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setMetaProspeccion } from "@/app/(app)/prospeccion/actividad/actions";

/**
 * La meta diaria de una persona, editable en el lugar.
 *
 * Se toca el número, se escribe y se guarda al salir del campo o con Enter —
 * sin botón de guardar ni modal, porque es un número que se ajusta al pasar.
 * Esc cancela y vuelve al valor anterior.
 */
export function MetaProspeccionInput({
  userId,
  nombre,
  meta,
}: {
  userId: string;
  nombre: string;
  meta: number;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(String(meta));
  const [guardando, setGuardando] = useState(false);
  const [reciente, setReciente] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // El valor confirmado: contra este comparamos para no guardar de más.
  const guardadoRef = useRef(String(meta));

  // Si la página se revalida con otro valor, seguimos a la fuente de verdad.
  useEffect(() => {
    setValor(String(meta));
    guardadoRef.current = String(meta);
  }, [meta]);

  async function guardar() {
    const limpio = valor.trim();
    if (limpio === guardadoRef.current) return;

    if (limpio !== "" && !/^\d+$/.test(limpio)) {
      toast.error("La meta tiene que ser un número entero.");
      setValor(guardadoRef.current);
      return;
    }

    setGuardando(true);
    const res = await setMetaProspeccion(userId, limpio === "" ? null : limpio);
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.error);
      setValor(guardadoRef.current);
      return;
    }

    const nuevo = res.meta === null ? "" : String(res.meta);
    guardadoRef.current = nuevo;
    setValor(nuevo);
    setReciente(true);
    setTimeout(() => setReciente(false), 1600);
    toast.success(
      res.meta === 0
        ? `A ${nombre} no se le pide meta.`
        : `Meta de ${nombre}: ${res.meta ?? "por defecto"} por día.`
    );
    router.refresh();
  }

  return (
    <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
      <span className="text-xs font-normal text-muted-foreground">meta</span>
      <input
        ref={inputRef}
        value={valor}
        inputMode="numeric"
        aria-label={`Meta diaria de ${nombre}`}
        disabled={guardando}
        onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            setValor(guardadoRef.current);
            inputRef.current?.blur();
          }
        }}
        className={cn(
          "w-10 rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-xs tabular-nums",
          "text-muted-foreground transition",
          "hover:border-border hover:bg-muted/60",
          "focus:border-primary focus:bg-background focus:text-foreground focus:outline-none",
          guardando && "opacity-50"
        )}
      />
      {guardando && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {reciente && !guardando && <Check className="h-3 w-3 text-emerald-500" />}
    </span>
  );
}
