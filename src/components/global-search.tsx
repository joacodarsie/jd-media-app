"use client";

/**
 * Ctrl/Cmd + K: saltá a cualquier lado (18/10/2026). Sin escribir muestra las
 * secciones para ir directo; escribiendo busca secciones, clientes, tareas,
 * piezas, documentos y personas del equipo. Se maneja con el teclado.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ListChecks,
  Users,
  CalendarDays,
  FileText,
  Loader2,
  X,
  CornerDownLeft,
  UserRound,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  kind: "tarea" | "cliente" | "publicacion" | "documento" | "persona" | "pagina";
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
  persona: UserRound,
  pagina: Compass,
};

const ETIQUETA: Record<SearchResult["kind"], string> = {
  tarea: "Tarea",
  cliente: "Cliente",
  publicacion: "Pieza",
  documento: "Doc",
  persona: "Equipo",
  pagina: "Ir a",
};

// Las secciones para saltar directo (si alguien no tiene permiso, la página lo manda a Mi día).
const PAGINAS: { titulo: string; href: string; emoji: string; claves?: string }[] = [
  { titulo: "Mi día", href: "/dashboard", emoji: "☀️", claves: "inicio dashboard hoy" },
  { titulo: "Tareas", href: "/tareas", emoji: "✅", claves: "tickets pendientes" },
  { titulo: "Contenidos", href: "/contenidos", emoji: "🗓️", claves: "calendario piezas publicaciones" },
  { titulo: "Agenda", href: "/agenda", emoji: "📅", claves: "reuniones" },
  { titulo: "Clientes", href: "/clientes", emoji: "🏢", claves: "cuentas marcas" },
  { titulo: "Project Manager", href: "/onboarding", emoji: "🚀", claves: "arranque onboarding cuentas nuevas pm luz" },
  { titulo: "Comercial", href: "/comercial", emoji: "🎯", claves: "propuestas ventas leads" },
  { titulo: "Paid Media", href: "/paid-media", emoji: "📈", claves: "pauta anuncios meta ads" },
  { titulo: "Cobros y pagos", href: "/cobros", emoji: "💰", claves: "plata facturas" },
  { titulo: "El resumen", href: "/finanzas/resumen", emoji: "📊", claves: "finanzas mes" },
  { titulo: "Dirección", href: "/direccion", emoji: "🧭", claves: "coordinadores" },
  { titulo: "Equipo", href: "/equipo", emoji: "👥", claves: "puestos personas" },
  { titulo: "Chat del equipo", href: "/chat", emoji: "💬", claves: "mensajes" },
  { titulo: "JDmedIA", href: "/jdmedia", emoji: "✨", claves: "ia asistente" },
  { titulo: "Métricas y objetivos", href: "/objetivos", emoji: "🏁", claves: "metas" },
  { titulo: "Quejas", href: "/quejas", emoji: "📣", claves: "reclamos" },
  { titulo: "Contratos", href: "/contratos", emoji: "📄", claves: "acuerdos" },
  { titulo: "Mi perfil", href: "/mi-perfil", emoji: "🙂", claves: "foto sueldo datos" },
];

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remotos, setRemotos] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  // Atajos: Cmd/Ctrl+K abre el modal, Esc cierra
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Búsqueda con debounce
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setActive(0);
    if (q.trim().length < 2) {
      setRemotos([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      start(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = (await res.json()) as { results: SearchResult[] };
          setRemotos(data.results ?? []);
        } catch {
          setRemotos([]);
        }
      });
    }, 160);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open]);

  const paginas: SearchResult[] = useMemo(() => {
    const t = sinTildes(q.trim());
    return PAGINAS.filter((p) => !t || sinTildes(`${p.titulo} ${p.claves ?? ""}`).includes(t))
      .slice(0, t ? 4 : PAGINAS.length)
      .map((p) => ({ kind: "pagina", id: p.href, titulo: `${p.emoji}  ${p.titulo}`, subtitle: "", href: p.href }));
  }, [q]);
  const results = q.trim().length < 2 ? paginas : [...paginas, ...remotos];

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(r: SearchResult) {
    setOpen(false);
    setQ("");
    setRemotos([]);
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

  const vacio = q.trim().length < 2;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Buscar o ir a cualquier sección (Ctrl/Cmd + K)"
        className="group inline-flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground hover:shadow-sm"
      >
        <Search className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
        <span className="hidden sm:inline">Buscar o ir a…</span>
        <kbd className="hidden rounded border bg-muted px-1 text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Buscá un cliente, tarea, pieza, persona… o una sección"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {vacio && (
                <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ir a
                </div>
              )}
              {!vacio && results.length === 0 && !pending ? (
                <div className="px-4 py-10 text-center text-sm">
                  <div className="mb-1 text-2xl">🔎</div>
                  <div className="text-muted-foreground">Nada con &quot;{q}&quot;.</div>
                  <div className="text-xs text-muted-foreground/70">Probá con menos palabras o revisá la ortografía.</div>
                </div>
              ) : (
                <ul ref={listaRef} className={cn("p-1.5", vacio && "grid grid-cols-2 gap-0.5 sm:grid-cols-3")}>
                  {results.map((r, i) => {
                    const Icon = ICON_FOR[r.kind];
                    const elegido = i === active;
                    return (
                      <li
                        key={r.kind + r.id}
                        data-i={i}
                        className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
                        style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                      >
                        <button
                          onClick={() => go(r)}
                          onMouseEnter={() => setActive(i)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors",
                            elegido ? "bg-primary/15" : "hover:bg-muted"
                          )}
                        >
                          {r.kind !== "pagina" && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{r.titulo}</div>
                            {r.subtitle && <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>}
                          </div>
                          {!vacio && (
                            <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                              {ETIQUETA[r.kind]}
                            </span>
                          )}
                          {elegido && !vacio && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-3 py-1.5 text-[10px] text-muted-foreground">
              <span>
                <kbd className="rounded border bg-muted px-1">↑↓</kbd> moverse · <kbd className="rounded border bg-muted px-1">Enter</kbd> abrir
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
