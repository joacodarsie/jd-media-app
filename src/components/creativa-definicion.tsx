"use client";

/**
 * Lo que la dirección creativa define al arrancar una cuenta (23/10/2026):
 * identidad, tono, cuánto pesa cada medio y qué tan urgente es vender.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MEDIOS, NIVELES, URGENCIAS, type DefinicionCreativa, type NivelMedio, type Urgencia } from "@/lib/creativa/creativa";
import { guardarDefinicion } from "@/app/(app)/creativa/actions";

const TONO_NIVEL: Record<NivelMedio, string> = {
  alta: "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  media: "border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200",
  baja: "border-sky-500 bg-sky-500/15 text-sky-800 dark:text-sky-200",
  no: "border-muted-foreground/40 bg-muted text-muted-foreground",
};

export function CreativaDefinicion({ clienteId, inicial }: { clienteId: string; inicial: DefinicionCreativa | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [identidad, setIdentidad] = useState(inicial?.dc_identidad ?? "");
  const [tono, setTono] = useState(inicial?.dc_tono ?? "");
  const [medios, setMedios] = useState<Record<string, NivelMedio>>({ ...(inicial?.dc_medios ?? {}) });
  const [urgencia, setUrgencia] = useState<Urgencia | null>(inicial?.dc_urgencia ?? null);
  const [objetivo, setObjetivo] = useState(inicial?.dc_objetivo ?? "");

  function guardar() {
    start(async () => {
      const r = await guardarDefinicion(clienteId, { identidad, tono, medios, urgencia, objetivo });
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Guardado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>🪪 Identidad de marca</Label>
          <Textarea
            rows={4}
            value={identidad}
            onChange={(e) => setIdentidad(e.target.value)}
            placeholder="Quiénes son, qué los hace distintos, su personalidad y a quién le hablan."
          />
        </div>
        <div>
          <Label>🗣️ Tono de marca</Label>
          <Textarea rows={4} value={tono} onChange={(e) => setTono(e.target.value)} placeholder="Cómo hablan: cercano o formal, con humor o serio, palabras que sí y que no." />
        </div>
      </div>

      <div>
        <Label>📡 Importancia de cada medio</Label>
        <div className="mt-1.5 space-y-1.5">
          {MEDIOS.map((m) => (
            <div key={m.clave} className="flex flex-wrap items-center gap-2">
              <span className="w-44 text-sm">{m.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {NIVELES.map((n) => (
                  <button
                    key={n.valor}
                    type="button"
                    onClick={() => setMedios((v) => ({ ...v, [m.clave]: n.valor }))}
                    className={cn("rounded-full border px-2.5 py-0.5 text-xs", medios[m.clave] === n.valor ? TONO_NIVEL[n.valor] : "hover:bg-muted")}
                    aria-pressed={medios[m.clave] === n.valor}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>⏱️ Prioridad y urgencia de su comunicación</Label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {(Object.keys(URGENCIAS) as Urgencia[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUrgencia(u)}
              aria-pressed={urgencia === u}
              className={cn("rounded-xl border p-3 text-left text-sm transition", urgencia === u ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted")}
            >
              <span className="mr-1.5" aria-hidden="true">
                {URGENCIAS[u].emoji}
              </span>
              {URGENCIAS[u].label}
            </button>
          ))}
        </div>
        <Input className="mt-2" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo principal en una línea. Ej: llenar la agenda de diciembre" />
      </div>

      <div className="flex justify-end">
        <Button onClick={guardar} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar
        </Button>
      </div>
    </div>
  );
}
