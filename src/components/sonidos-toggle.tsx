"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { setSonidos, sonar, sonidosActivos } from "@/lib/sonido";

/** Prender o apagar los sonidos de la plataforma en este dispositivo (18/10/2026). */
export function SonidosToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(sonidosActivos()), []);
  return (
    <button
      type="button"
      onClick={() => {
        const nuevo = !on;
        setSonidos(nuevo);
        setOn(nuevo);
        if (nuevo) sonar("hecha");
      }}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition hover:bg-muted/50"
    >
      {on ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
      <span className="flex-1">
        <span className="block font-medium">Sonidos {on ? "prendidos" : "apagados"}</span>
        <span className="text-xs text-muted-foreground">Un «tic» suave al completar una tarea o aprobar una pieza. Solo en este dispositivo.</span>
      </span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
