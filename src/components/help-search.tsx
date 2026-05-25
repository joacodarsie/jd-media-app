"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { HelpPage } from "@/lib/help/load";

export function HelpSearch({ pages }: { pages: HelpPage[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (query.length < 2) return [];
    return pages
      .map((p) => {
        const hay = [
          p.title,
          p.description ?? "",
          p.category ?? "",
          p.content,
        ]
          .join(" ")
          .toLowerCase();
        const idx = hay.indexOf(query);
        return { p, idx };
      })
      .filter((r) => r.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .slice(0, 8);
  }, [pages, query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en la guía…"
          className="h-11 pl-9 pr-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {query.length >= 2 && (
        <div className="rounded-lg border bg-card">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Nada para “{q}”.
            </p>
          ) : (
            <ul className="divide-y">
              {results.map((r) => (
                <li key={r.p.slug}>
                  <Link
                    href={`/ayuda/${r.p.slug}`}
                    className="block px-3 py-2 transition hover:bg-muted/50"
                  >
                    <div className="text-sm font-medium">{r.p.title}</div>
                    {r.p.description && (
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {r.p.description}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
