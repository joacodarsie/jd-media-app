"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, BarChart3, Eye, Heart, MessageCircle, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchTiktokResults, type TiktokResults as Data } from "@/app/(app)/clientes/[id]/resultados/actions";

/**
 * Muestra los resultados orgánicos de TikTok del cliente: perfil + estadísticas
 * (seguidores, likes, videos) + los videos del mes con sus métricas. Trae los
 * datos a pedido con un botón. Demuestra los 3 scopes en uso.
 */
export function TiktokResults({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [data, setData] = useState<Data | null>(null);

  function load() {
    start(async () => {
      const res = await fetchTiktokResults(clientId);
      if ("error" in res) return void toast.error(res.error);
      setData(res.data);
      toast.success("Datos de TikTok actualizados");
    });
  }

  const nf = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-AR"));

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={load} disabled={pending} className="gap-1.5">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
        {data ? "Actualizar datos de TikTok" : "Traer datos de TikTok"}
      </Button>

      {data && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          {/* Perfil + estadísticas (user.info.basic + user.info.stats) */}
          <div className="flex items-center gap-3">
            {data.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold">{data.display_name ?? data.username ?? "—"}</div>
              {data.username && <div className="text-xs text-muted-foreground">@{data.username}</div>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Seguidores" value={nf(data.followers)} />
            <Stat label="Me gusta" value={nf(data.likes)} />
            <Stat label="Videos" value={nf(data.videoCount)} />
          </div>

          {/* Videos del mes (video.list) */}
          {data.videos.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Últimos videos
              </div>
              <ul className="divide-y">
                {data.videos.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{v.title?.trim() || "(sin título)"}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {nf(v.view_count)}</span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {nf(v.like_count)}</span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {nf(v.comment_count)}</span>
                      <span className="hidden items-center gap-1 sm:inline-flex"><Share2 className="h-3 w-3" /> {nf(v.share_count)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 text-center">
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
