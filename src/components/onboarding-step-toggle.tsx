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
  | "kickoff_agendado_at"
  | "meet_guide_generated_at"
  | "drive_creado_at"
  | "accesos_cargados_at"
  | "perfiles_rediseno_at"
  | "cm_accesos_at"
  | "cm_perfiles_at"
  | "cm_vinculacion_at"
  | "dg_manual_marca_at"
  | "dg_kit_marca_at"
  | "dg_proyecto_canva_at"
  | "dg_plantillas_historias_at"
  | "dg_aprobado_at";

export function OnboardingStepToggle({
  clientId,
  stepKey,
  initialDone,
  autoDerived = false,
}: {
  clientId: string;
  stepKey: StepKey;
  initialDone: boolean;
  /**
   * Si true, el step se considera hecho a partir de datos reales del sistema
   * (ej: equipo asignado, tareas creadas, diagnóstico aprobado). El toggle
   * queda en read-only con tooltip explicativo.
   */
  autoDerived?: boolean;
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
      } else if (autoDerived && next) {
        // Estaba marcado solo por los datos del sistema; ahora lo confirmó a mano.
        toast.success("Paso confirmado");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        autoDerived
          ? "Se marcó solo con los datos del sistema — podés confirmarlo o destildarlo"
          : done
          ? "Marcar como pendiente"
          : "Marcar como hecho"
      }
      aria-label={done ? "Marcar como pendiente" : "Marcar como hecho"}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
        done
          ? autoDerived
            ? "border-emerald-500 bg-emerald-500/90 text-white ring-2 ring-emerald-500/20"
            : "border-emerald-500 bg-emerald-500 text-white"
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
