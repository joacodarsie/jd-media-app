"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Save, Eye, EyeOff, ExternalLink, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClientJsonbArray } from "@/app/(app)/clientes/actions";

type Field = { name: string; label: string; placeholder?: string; type?: "text" | "url" | "password" };

interface Props {
  clientId: string;
  field: "links_custom" | "redes_sociales" | "credenciales";
  title: string;
  /** descripción opcional */
  description?: string;
  /** definición de los campos por item */
  itemFields: Field[];
  /** valor actual */
  initial: Record<string, string>[];
  /** etiqueta del botón "agregar" */
  addLabel?: string;
}

export function ClientListEditor({
  clientId,
  field,
  title,
  description,
  itemFields,
  initial,
  addLabel = "Agregar",
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Record<string, string>[]>(initial ?? []);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showPwd, setShowPwd] = useState<Set<number>>(new Set());

  function add() {
    setItems((arr) => [...arr, Object.fromEntries(itemFields.map((f) => [f.name, ""]))]);
    setEditing(true);
  }
  function remove(idx: number) {
    setItems((arr) => arr.filter((_, i) => i !== idx));
  }
  function patch(idx: number, key: string, val: string) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }
  function togglePwd(i: number) {
    setShowPwd((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  function save() {
    // filtrar items vacíos
    const cleaned = items.filter((it) => Object.values(it).some((v) => (v ?? "").trim() !== ""));
    start(async () => {
      const res = await updateClientJsonbArray(clientId, field, cleaned);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Guardado");
      setItems(cleaned);
      setEditing(false);
      router.refresh();
    });
  }

  // VISTA: lista (no editing)
  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
            Nada cargado.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {items.map((it, i) => (
              <li key={i} className="rounded-md border bg-card px-3 py-2">
                {field === "links_custom" && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{it.titulo || it.url}</span>
                  </a>
                )}
                {field === "redes_sociales" && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium capitalize">{it.red}</span>
                    <span className="truncate text-xs text-muted-foreground">{it.url}</span>
                  </a>
                )}
                {field === "credenciales" && (
                  <div className="space-y-0.5">
                    <div className="font-medium">{it.servicio}</div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {it.usuario && (
                        <span>
                          <span className="text-muted-foreground">user:</span> {it.usuario}
                        </span>
                      )}
                      {it.password && (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-muted-foreground">pass:</span>
                          <code className="rounded bg-muted px-1">
                            {showPwd.has(i) ? it.password : "••••••••"}
                          </code>
                          <button
                            type="button"
                            onClick={() => togglePwd(i)}
                            className="text-muted-foreground hover:text-foreground"
                            title={showPwd.has(i) ? "Ocultar" : "Mostrar"}
                          >
                            {showPwd.has(i) ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                        </span>
                      )}
                      {it.url && (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          abrir
                        </a>
                      )}
                    </div>
                    {it.notas && (
                      <div className="text-xs text-muted-foreground">{it.notas}</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // VISTA: edición
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setItems(initial ?? []); setEditing(false); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={save} disabled={pending} className="gap-1">
            <Save className="h-3.5 w-3.5" />
            Guardar
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="space-y-2 rounded-md border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">#{idx + 1}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => remove(idx)}
                className="h-7 w-7 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {itemFields.map((f) => (
                <div key={f.name} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type === "password" ? "text" : f.type ?? "text"}
                    value={it[f.name] ?? ""}
                    onChange={(e) => patch(idx, f.name, e.target.value)}
                    placeholder={f.placeholder}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
