"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// El bundle pesado (file handling, base64, voz, markdown) sólo se descarga
// cuando el usuario abre el chat por primera vez.
const AIChat = dynamic(() => import("@/components/ai-chat").then((m) => m.AIChat), {
  ssr: false,
});

// Rutas donde el flotante estorba (ya hay su propio chat full-page o input pegado al borde).
const HIDDEN_ROUTES = ["/chat", "/jdmedia"];

export function AIChatLauncher() {
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);

  const hidden = HIDDEN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  if (hidden) return null;

  if (opened) {
    return <AIChat initialOpen onClosed={() => setOpened(false)} />;
  }

  return (
    <button
      onClick={() => setOpened(true)}
      aria-label="Abrir asistente"
      className={cn(
        "fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
      )}
    >
      <MessageCircle className="h-5 w-5" />
    </button>
  );
}
