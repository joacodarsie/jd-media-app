"use client";

/**
 * El círculo para dar una tarea por hecha de un toque (18/10/2026): se llena,
 * la fila se tacha y se va deslizando, y recién ahí se guarda. Si la tarea
 * necesita aprobación, el aviso de siempre lo explica. Va dentro de una fila
 * marcada con `data-fila-tarea`.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { updateTaskStatus } from "@/app/(app)/tareas/actions";
import { cn } from "@/lib/utils";

export function CompletarTarea({ id, titulo, className }: { id: string; titulo: string; className?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const [hecha, setHecha] = useState(false);

  async function completar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hecha) return;
    setHecha(true);
    const fila = ref.current?.closest<HTMLElement>("[data-fila-tarea]");
    fila?.classList.add("jd-fila-hecha");
    const [res] = await Promise.all([updateTaskStatus(id, "completada"), new Promise((r) => setTimeout(r, 750))]);
    if (!res || "error" in res) {
      fila?.classList.remove("jd-fila-hecha");
      setHecha(false);
      toast.error((res as { error?: string })?.error ?? "No se pudo marcar como hecha.");
      return;
    }
    if (res.aviso) toast.message(res.aviso);
    else if (res.estado === "completada") toast.success("¡Hecha!");
    router.refresh();
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={completar}
      aria-label={`Marcar «${titulo}» como hecha`}
      title="Marcar como hecha"
      className={cn(
        "group/check flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
        hecha
          ? "scale-110 border-emerald-500 bg-emerald-500 text-white"
          : "border-muted-foreground/30 text-transparent hover:border-emerald-500 hover:text-emerald-500",
        className
      )}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </button>
  );
}
