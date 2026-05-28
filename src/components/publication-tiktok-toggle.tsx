"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Music } from "lucide-react";
import { setPublicationTiktokSubido } from "@/app/(app)/contenidos/actions";

export function PublicationTiktokToggle({
  id,
  initialSubido,
}: {
  id: string;
  initialSubido: boolean;
}) {
  const router = useRouter();
  const [subido, setSubido] = useState(initialSubido);
  const [pending, start] = useTransition();

  function onToggle(next: boolean) {
    setSubido(next); // optimistic
    start(async () => {
      const res = await setPublicationTiktokSubido(id, next);
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        setSubido(!next);
        return;
      }
      toast.success(next ? "Marcado: subido a TikTok" : "Pendiente de subir a TikTok");
      router.refresh();
    });
  }

  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs transition ${
        subido
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-dashed bg-muted/30 text-muted-foreground hover:bg-muted/60"
      } ${pending ? "opacity-60" : ""}`}
      title="Recordatorio: marcalo cuando ya lo hayas subido a TikTok"
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-emerald-500"
        checked={subido}
        disabled={pending}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <Music className="h-3.5 w-3.5" />
      <span className="font-medium">
        {subido ? "Ya está subido a TikTok" : "Subir a TikTok"}
      </span>
    </label>
  );
}
