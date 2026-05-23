"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  deleteConversation,
  renameConversation,
} from "@/app/(app)/jdmedia/actions";
import { Button } from "@/components/ui/button";

interface ConvRow {
  id: string;
  title: string;
  updated_at: string;
}

export function ConversationsSidebar({
  conversations,
  activeId,
}: {
  conversations: ConvRow[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(c: ConvRow) {
    setEditingId(c.id);
    setEditValue(c.title);
  }

  function saveEdit(id: string) {
    const v = editValue.trim();
    if (!v) {
      setEditingId(null);
      return;
    }
    start(async () => {
      const res = await renameConversation(id, v);
      if (res?.error) toast.error(res.error);
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("¿Borrar esta conversación?")) return;
    start(async () => {
      const res = await deleteConversation(id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (activeId === id) {
        router.push("/jdmedia");
      } else {
        router.refresh();
      }
    });
  }

  function fmt(date: string) {
    try {
      const d = new Date(date);
      return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return "";
    }
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card/40 md:flex">
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">JDmedIA</div>
          <div className="text-[10px] text-muted-foreground">
            Tu copiloto de la agencia
          </div>
        </div>
      </div>
      <div className="px-3 py-2">
        <Link href="/jdmedia">
          <Button className="w-full justify-start" size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Nueva conversación
          </Button>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Todavía no tenés conversaciones. Empezá una nueva acá.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const active = c.id === activeId;
              const editing = c.id === editingId;
              return (
                <li key={c.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                      active ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    {editing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(c.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 w-full rounded border bg-background px-2 text-sm"
                      />
                    ) : (
                      <Link
                        href={`/jdmedia?c=${c.id}`}
                        className="min-w-0 flex-1 truncate"
                        title={c.title}
                      >
                        <div className="truncate font-medium">{c.title}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {fmt(c.updated_at)}
                        </div>
                      </Link>
                    )}
                    {!editing && (
                      <div className="ml-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEdit(c)}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                          title="Renombrar"
                          disabled={pending}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => remove(c.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                          title="Borrar"
                          disabled={pending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
