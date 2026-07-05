"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { EditableClause } from "@/lib/contract-clauses";
import { saveContractClauses } from "@/app/(app)/carta-plantilla/actions";

export function ContractClausesEditor({
  clauses,
  initial,
}: {
  clauses: EditableClause[];
  initial: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Estado por cláusula: el texto actual (override si hay, si no el default).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const c of clauses) v[c.key] = initial[c.key] ?? c.default;
    return v;
  });

  const defaultOf = (key: string) => clauses.find((c) => c.key === key)?.default ?? "";
  const isEdited = (key: string) => values[key].trim() !== defaultOf(key).trim();

  function set(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }
  function restore(key: string) {
    set(key, defaultOf(key));
  }

  function save() {
    // Solo mandamos las cláusulas realmente modificadas (distintas del default);
    // las que quedaron en default se omiten y usan el texto por defecto vivo.
    const payload: Record<string, string> = {};
    for (const c of clauses) {
      if (isEdited(c.key)) payload[c.key] = values[c.key];
    }
    start(async () => {
      const res = await saveContractClauses(payload);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      const n = Object.keys(payload).length;
      toast.success(
        n === 0
          ? "Guardado: todas las cláusulas usan el texto por defecto."
          : `Guardado: ${n} cláusula(s) personalizada(s).`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Guardar cambios
        </Button>
      </div>

      {clauses.map((c) => (
        <Card key={c.key}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {c.titulo}
                {isEdited(c.key) && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    editada
                  </span>
                )}
              </h3>
              {isEdited(c.key) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => restore(c.key)}
                >
                  <RotateCcw className="h-3 w-3" /> Restaurar por defecto
                </Button>
              )}
            </div>
            <Textarea
              value={values[c.key]}
              onChange={(e) => set(c.key, e.target.value)}
              rows={Math.min(10, Math.max(3, values[c.key].split("\n").length + 1))}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Separá párrafos con una línea en blanco. Podés usar{" "}
              <code>**negrita**</code> para resaltar.
            </p>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1 h-4 w-4" />
          )}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
