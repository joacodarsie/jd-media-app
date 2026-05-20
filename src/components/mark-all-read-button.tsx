"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllRead } from "@/app/(app)/notificaciones/actions";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllRead();
          router.refresh();
        })
      }
    >
      {pending ? "Marcando…" : "Marcar todas como leídas"}
    </Button>
  );
}
