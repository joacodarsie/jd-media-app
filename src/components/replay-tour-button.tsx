"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Boton para volver a abrir el tour de bienvenida. Despacha el evento
 * `jd:start-tour` que el componente WelcomeTour (montado en el layout) escucha.
 */
export function ReplayTourButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.dispatchEvent(new Event("jd:start-tour"))}
    >
      <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
      Volver a ver el tour
    </Button>
  );
}
