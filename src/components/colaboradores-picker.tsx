"use client";

import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * «También la hacen»: sumar más personas a una tarea, además del responsable
 * (pedido del dueño, 13/10/2026). Chips con los elegidos y un desplegable para
 * sumar otro. Al responsable no se lo ofrece: ya está.
 */
export function ColaboradoresPicker({
  value,
  onChange,
  users,
  responsableId,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  users: { id: string; nombre: string }[];
  responsableId: string | null;
}) {
  const nombre = (id: string) => users.find((u) => u.id === id)?.nombre ?? "Alguien";
  const elegidos = value.filter((id) => id !== responsableId);
  const disponibles = users.filter((u) => u.id !== responsableId && !elegidos.includes(u.id));
  return (
    <div className="space-y-2">
      {elegidos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {elegidos.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pl-2.5 pr-1 text-xs font-medium"
            >
              {nombre(id)}
              <button
                type="button"
                onClick={() => onChange(elegidos.filter((x) => x !== id))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Quitar a ${nombre(id)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {disponibles.length > 0 && (
        // key: el desplegable vuelve a «Sumar a alguien» después de cada elección.
        <Select key={elegidos.join(",")} onValueChange={(v) => onChange([...elegidos, v])}>
          <SelectTrigger className="h-9 text-sm text-muted-foreground">
            <SelectValue placeholder="+ Sumar a alguien" />
          </SelectTrigger>
          <SelectContent>
            {disponibles.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
