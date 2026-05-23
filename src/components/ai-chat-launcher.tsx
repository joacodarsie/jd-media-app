"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// El bundle pesado (file handling, base64, voz, markdown) sólo se descarga
// cuando el usuario abre el chat por primera vez.
const AIChat = dynamic(() => import("@/components/ai-chat").then((m) => m.AIChat), {
  ssr: false,
});

// Rutas donde el flotante es redundante (la página entera ya es el chat IA).
const FULLY_HIDDEN_ROUTES = ["/jdmedia"];

// Rutas con input pegado al borde inferior — desplazamos el flotante hacia
// arriba para que no tape el botón de enviar.
const SHIFTED_ROUTES = ["/chat"];

export function AIChatLauncher() {
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);

  const fullyHidden = FULLY_HIDDEN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
  if (fullyHidden) return null;

  if (opened) {
    return <AIChat initialOpen onClosed={() => setOpened(false)} />;
  }

  const shifted = SHIFTED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  return (
    <button
      onClick={() => setOpened(true)}
      aria-label="Abrir asistente"
      title="Abrir asistente IA"
      className={cn(
        "fixed right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/5 transition hover:scale-105",
        // En /chat lo subimos sobre el input bar para que no tape el botón "Enviar".
        shifted ? "bottom-24" : "bottom-5"
      )}
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
