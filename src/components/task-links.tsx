"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { saveLinks } from "@/app/(app)/tareas/actions";
import type { TaskLink } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TaskLinks({
  taskId,
  links,
}: {
  taskId: string;
  links: TaskLink[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  function persist(next: TaskLink[]) {
    start(async () => {
      const res = await saveLinks(taskId, next);
      if (res?.error) toast.error("Error: " + res.error);
      else router.refresh();
    });
  }

  function add() {
    const u = url.trim();
    if (!u) return;
    const safe = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    persist([...links, { label: label.trim() || safe, url: safe }]);
    setLabel("");
    setUrl("");
  }

  return (
    <div className="space-y-2">
      {links.length > 0 && (
        <ul className="space-y-1">
          {links.map((l, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{l.label}</span>
              </a>
              <button
                onClick={() => persist(links.filter((_, j) => j !== i))}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive"
                title="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Nombre (ej: Brief en Drive)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="sm:w-52"
        />
        <Input
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={add}
          disabled={pending || !url.trim()}
        >
          <Plus className="mr-1 h-4 w-4" /> Agregar
        </Button>
      </div>
    </div>
  );
}
