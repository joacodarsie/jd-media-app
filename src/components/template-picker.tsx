"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  bumpTemplateUse,
  TEMPLATE_CATEGORY_LABEL,
  type TemplateCategory,
} from "@/app/(app)/templates/actions";

interface TemplateLite {
  id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  scope: "propio" | "global";
  use_count: number;
}

/**
 * Boton + popover para insertar un template en cualquier textarea.
 *
 * Uso:
 *   <TemplatePicker onSelect={(text) => insertarEnTextarea(text)} />
 *
 * - Carga templates al abrir (lazy).
 * - Busqueda inline por titulo o contenido.
 * - Click → onSelect(contenido) y bump del use_count en background.
 */
export function TemplatePicker({
  onSelect,
  filterCategoria,
  trigger,
}: {
  onSelect: (text: string) => void;
  filterCategoria?: TemplateCategory;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateLite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open || templates !== null) return;
    setLoading(true);
    const sb = createClient();
    let qb = sb
      .from("message_templates")
      .select("id, titulo, contenido, categoria, scope, use_count")
      .order("use_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(40);
    if (filterCategoria) qb = qb.eq("categoria", filterCategoria);
    qb.then(({ data }) => {
      setTemplates(
        (data ?? []).map((d) => ({
          id: d.id as string,
          titulo: d.titulo as string,
          contenido: d.contenido as string,
          categoria: d.categoria as string,
          scope: d.scope as "propio" | "global",
          use_count: (d.use_count as number) ?? 0,
        }))
      );
      setLoading(false);
    });
  }, [open, templates, filterCategoria]);

  const filtered = useMemo(() => {
    if (!templates) return [];
    const qq = q.trim().toLowerCase();
    if (!qq) return templates;
    return templates.filter(
      (t) =>
        t.titulo.toLowerCase().includes(qq) ||
        t.contenido.toLowerCase().includes(qq)
    );
  }, [templates, q]);

  function pick(t: TemplateLite) {
    onSelect(t.contenido);
    setOpen(false);
    // Fire-and-forget al server.
    bumpTemplateUse(t.id).catch(() => undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Insertar template"
            className="h-9 w-9"
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-80 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar template…"
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> cargando…
            </div>
          ) : (templates ?? []).length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              <p>Sin templates todavía.</p>
              <a
                href="/templates"
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-primary hover:underline"
              >
                Crear el primero →
              </a>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Sin coincidencias para &quot;{q}&quot;.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => pick(t)}
                    className="block w-full px-3 py-2 text-left hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {t.titulo}
                      </span>
                      <span
                        className={cn(
                          "ml-auto shrink-0 rounded-full px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide",
                          t.scope === "global"
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {t.scope === "global" ? "Global" : "Propio"}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {t.contenido}
                    </p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                      {TEMPLATE_CATEGORY_LABEL[
                        t.categoria as TemplateCategory
                      ] ?? t.categoria}
                      {t.use_count > 0 && ` · usado ${t.use_count}×`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
          <a href="/templates" target="_blank" rel="noreferrer" className="hover:underline">
            Administrar templates →
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
