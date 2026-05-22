"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageSquare, Eye, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface ClientComment {
  id: string;
  contenido: string;
  created_at: string;
  visto_at: string | null;
  visto_por_id: string | null;
}

export function ClientPubComments({
  publicationId,
}: {
  publicationId: string;
}) {
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, start] = useTransition();
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const sb = createClient();
    const [{ data }, { data: userData }] = await Promise.all([
      sb
        .from("client_pub_comments")
        .select("id, contenido, created_at, visto_at, visto_por_id")
        .eq("publication_id", publicationId)
        .order("created_at", { ascending: false }),
      sb.auth.getUser(),
    ]);
    setComments((data ?? []) as ClientComment[]);
    setUserId(userData?.user?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicationId]);

  function markAsSeen(id: string) {
    start(async () => {
      const sb = createClient();
      const { error } = await sb
        .from("client_pub_comments")
        .update({
          visto_at: new Date().toISOString(),
          visto_por_id: userId,
        })
        .eq("id", id);
      if (error) return;
      load();
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando comentarios del cliente…
      </div>
    );
  }

  if (comments.length === 0) return null;

  const unseen = comments.filter((c) => !c.visto_at).length;

  return (
    <div className="rounded-md border border-orange-300 bg-orange-50/40 p-3 dark:border-orange-900 dark:bg-orange-950/20">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-orange-900 dark:text-orange-200">
        <MessageSquare className="h-3.5 w-3.5" />
        Comentarios del cliente ({comments.length})
        {unseen > 0 && (
          <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unseen} sin ver
          </span>
        )}
      </div>
      <ul className="space-y-2 text-sm">
        {comments.map((c) => (
          <li
            key={c.id}
            className="rounded bg-background p-2 text-orange-950 dark:text-orange-100"
          >
            <p className="whitespace-pre-wrap text-sm">{c.contenido}</p>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>
                {new Date(c.created_at).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {!c.visto_at ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-1.5 text-[10px]"
                  onClick={() => markAsSeen(c.id)}
                  disabled={marking}
                >
                  <Eye className="h-3 w-3" />
                  Marcar visto
                </Button>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-300">
                  ✓ visto{" "}
                  {new Date(c.visto_at).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
