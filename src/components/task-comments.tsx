"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addComment, deleteComment } from "@/app/(app)/tareas/actions";
import { fmtDateTime } from "@/lib/dates";
import type { AppUser, Comment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X } from "lucide-react";

function initials(n: string) {
  return n
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TaskComments({
  taskId,
  comments,
  users,
  currentUserId,
  isStaff,
}: {
  taskId: string;
  comments: Comment[];
  users: Pick<AppUser, "id" | "nombre">[];
  currentUserId: string;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  function send() {
    if (!text.trim()) return;
    start(async () => {
      const res = await addComment(taskId, text);
      if (res?.error) {
        toast.error("Error: " + res.error);
        return;
      }
      setText("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no hay comentarios.
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-muted text-xs">
                {initials(c.autor?.nombre ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {c.autor?.nombre ?? "Usuario"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fmtDateTime(c.created_at)}
                </span>
                {(c.user_id === currentUserId || isStaff) && (
                  <button
                    title="Eliminar comentario"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      start(async () => {
                        const res = await deleteComment(c.id, taskId);
                        if (res?.error) toast.error("Error: " + res.error);
                        else router.refresh();
                      })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">
                {c.contenido.split(/(@[\p{L}]+)/u).map((part, i) =>
                  part.startsWith("@") ? (
                    <span key={i} className="font-medium text-primary">
                      {part}
                    </span>
                  ) : (
                    part
                  )
                )}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-4">
        <Textarea
          rows={3}
          placeholder="Escribí un comentario… Mencioná con @Nombre"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Mencionar:</span>
          {users.slice(0, 12).map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() =>
                setText(
                  (t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${u.nombre.split(" ")[0]} `
                )
              }
              className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent"
            >
              {u.nombre.split(" ")[0]}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={send} disabled={pending || !text.trim()}>
            {pending ? "Enviando…" : "Comentar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
