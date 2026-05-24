"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleOnboardingStep } from "@/app/(app)/clientes/[id]/onboarding/actions";

type StepKey =
  | "carta_enviada_at"
  | "pago_recibido_at"
  | "equipo_asignado_at"
  | "grupo_wpp_creado_at"
  | "mensajes_enviados_at"
  | "diagnostico_generado_at"
  | "tareas_iniciales_at"
  | "kickoff_agendado_at";

export function OnboardingStepToggle({
  clientId,
  stepKey,
  initialDone,
}: {
  clientId: string;
  stepKey: StepKey;
  initialDone: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !done;
    setDone(next);
    start(async () => {
      const res = await toggleOnboardingStep(clientId, stepKey, next);
      if (res?.error) {
        toast.error(res.error);
        setDone(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={done ? "Marcar como pendiente" : "Marcar como hecho"}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
        done
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-muted-foreground/40 bg-card hover:border-primary"
      }`}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : done ? (
        <Check className="h-3 w-3" />
      ) : null}
    </button>
  );
}
