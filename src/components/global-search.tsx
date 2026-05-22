"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ListChecks,
  Users,
  CalendarDays,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  kind: "tarea" | "cliente" | "publicacion" | "documento";
  id: string;
  titulo: string;
  subtitle: string;
  href: string;
}

const ICON_FOR: Record<SearchResult["kind"], typeof ListChecks> = {
  tarea: ListChecks,
  cliente: Users,
  publicacion: CalendarDays,
  documento: FileText,
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atajos: Cmd/Ctrl+K abre el modal, Esc cierra
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Búsqueda con debounce
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      start(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = (await res.json()) as { results: SearchResult[] };
          setResults(data.results ?? []);
          setActive(0);
        } catch {
          setResults([]);
        }
      });
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open]);

  function go(r: SearchResult) {
    setOpen(false);
    setQ("");
    setResults([]);
    router.push(r.href);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const r = results[active];
      if (r) {
        e.preventDefault();
        go(r);
      }
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Buscar (Ctrl/Cmd + K)"
        className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="hidden rounded border bg-muted px-1 text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Buscar tarea, cliente, publicación o documento…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Escribí al menos 2 letras para buscar.
                </p>
              ) : results.length === 0 && !pending ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Sin resultados para &quot;{q}&quot;.
                </p>
              ) : (
                <ul className="py-1">
                  {results.map((r, i) => {
                    const Icon = ICON_FOR[r.kind];
                    return (
                      <li key={r.kind + r.id}>
                        <button
                          onClick={() => go(r)}
                          onMouseEnter={() => setActive(i)}
                          className={cn(
                            "flex w-full items-start gap-2 px-4 py-2 text-left",
                            i === active && "bg-muted"
                          )}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {r.titulo}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {r.subtitle}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-3 py-1.5 text-[10px] text-muted-foreground">
              <span>
                <kbd className="rounded border bg-muted px-1">↑↓</kbd> navegar ·{" "}
                <kbd className="rounded border bg-muted px-1">Enter</kbd> abrir
              </span>
              <span>
                <kbd className="rounded border bg-muted px-1">Esc</kbd> cerrar
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
