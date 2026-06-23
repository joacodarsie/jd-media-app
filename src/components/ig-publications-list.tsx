"use client";

import { useMemo, useState } from "react";
import { Radar, Heart, MessageCircle, Star, Film, Image as ImageIcon, Layers, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PubItem {
  id: string;
  kind: "reel" | "post" | "carrusel" | "historia";
  permalink: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  timestamp: string | null; // ISO
  reach: number | null;
  like_count: number | null;
  comments_count: number | null;
  saved: number | null;
  replies: number | null;
}

const fmt = (n: number) => Math.round(n).toLocaleString("es-AR");

const KIND_META: Record<PubItem["kind"], { label: string; icon: typeof Film }> = {
  reel: { label: "Reel", icon: Clapperboard },
  post: { label: "Posteo", icon: ImageIcon },
  carrusel: { label: "Carrusel", icon: Layers },
  historia: { label: "Historia", icon: Film },
};

const FILTERS: { value: string; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "reel", label: "Reels" },
  { value: "post", label: "Posteos" },
  { value: "carrusel", label: "Carruseles" },
  { value: "historia", label: "Historias" },
];

function fmtFecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function IgPublicationsList({ items }: { items: PubItem[] }) {
  const [tipo, setTipo] = useState("todas");
  const [orden, setOrden] = useState<"recientes" | "alcance">("recientes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const filtered = useMemo(() => {
    const desdeT = desde ? new Date(desde + "T00:00:00").getTime() : -Infinity;
    const hastaT = hasta ? new Date(hasta + "T23:59:59").getTime() : Infinity;
    return items
      .filter((it) => {
        if (tipo !== "todas" && it.kind !== tipo) return false;
        const t = it.timestamp ? new Date(it.timestamp).getTime() : 0;
        if (t < desdeT || t > hastaT) return false;
        return true;
      })
      .sort((a, b) => {
        if (orden === "alcance") return (b.reach ?? 0) - (a.reach ?? 0);
        return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime();
      });
  }, [items, tipo, orden, desde, hasta]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTipo(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                tipo === f.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            Desde
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="h-8 rounded-md border bg-background px-2"
            />
          </label>
          <label className="flex items-center gap-1">
            Hasta
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="h-8 rounded-md border bg-background px-2"
            />
          </label>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as "recientes" | "alcance")}
            className="h-8 rounded-md border bg-background px-2"
          >
            <option value="recientes">Más recientes</option>
            <option value="alcance">Mayor alcance</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "publicación" : "publicaciones"}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No hay publicaciones con esos filtros.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((m) => {
            const meta = KIND_META[m.kind];
            const Icon = meta.icon;
            return (
              <a
                key={m.id}
                href={m.permalink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-lg border bg-card transition hover:border-primary/40"
              >
                <div className="relative aspect-square bg-muted">
                  {m.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      {meta.label}
                    </div>
                  )}
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                  {m.timestamp && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {fmtFecha(m.timestamp)}
                    </span>
                  )}
                </div>
                <div className="space-y-1 p-2">
                  {m.caption && <p className="line-clamp-2 text-xs text-muted-foreground">{m.caption}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {m.reach != null && m.reach > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Radar className="h-3 w-3" /> {fmt(m.reach)}
                      </span>
                    )}
                    {m.like_count != null && (
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3 w-3" /> {fmt(m.like_count)}
                      </span>
                    )}
                    {m.comments_count != null && m.comments_count > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {fmt(m.comments_count)}
                      </span>
                    )}
                    {m.saved != null && m.saved > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3" /> {fmt(m.saved)}
                      </span>
                    )}
                    {m.replies != null && m.replies > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" /> {fmt(m.replies)}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
