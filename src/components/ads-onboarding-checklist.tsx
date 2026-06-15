"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toggleAdsStep, saveAdsNotes, type AdsStepKey } from "@/app/(app)/clientes/[id]/pauta/actions";
import { cn } from "@/lib/utils";

export interface AdsOnboardingState {
  accesos_fb_at?: string | null;
  ads_manager_at?: string | null;
  dolar_app_at?: string | null;
  tarjeta_vinculada_at?: string | null;
  campanas_definidas_at?: string | null;
  campanas_publicadas_at?: string | null;
  campanas_notas?: string | null;
  notas?: string | null;
}

const STEPS: { key: AdsStepKey; titulo: string; desc: string }[] = [
  {
    key: "accesos_fb_at",
    titulo: "Pedir accesos a Facebook del cliente",
    desc: "Solicitar al cliente acceso a su cuenta / página de Facebook (como administrador).",
  },
  {
    key: "ads_manager_at",
    titulo: "Administrador de anuncios (Meta)",
    desc: "Crear o acceder al Business Manager / Administrador de anuncios de Meta del cliente.",
  },
  {
    key: "dolar_app_at",
    titulo: "Cliente descarga Dólar App",
    desc: "Pedirle al cliente que se descargue Dólar App, así no se le cobran los impuestos sobre la pauta.",
  },
  {
    key: "tarjeta_vinculada_at",
    titulo: "Vincular tarjeta global de Dólar App",
    desc: "Vincular la tarjeta global de Dólar App con la cuenta de anuncios del cliente como medio de pago.",
  },
  {
    key: "campanas_definidas_at",
    titulo: "Definir y armar las campañas clave",
    desc: "Definir las campañas clave para la cuenta y dejarlas armadas (objetivos, segmentación, presupuesto, creatividades).",
  },
  {
    key: "campanas_publicadas_at",
    titulo: "Publicar las campañas",
    desc: "Publicar las campañas y dejarlas corriendo.",
  },
];

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function AdsOnboardingChecklist({
  clientId,
  initial,
}: {
  clientId: string;
  initial: AdsOnboardingState;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [savingNotes, startNotes] = useTransition();
  const [campanas, setCampanas] = useState(initial.campanas_notas ?? "");
  const [notas, setNotas] = useState(initial.notas ?? "");

  const stepVal = (k: AdsStepKey) => (initial[k] as string | null | undefined) ?? null;
  const doneCount = STEPS.filter((s) => stepVal(s.key)).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);

  function toggle(step: AdsStepKey, current: string | null) {
    start(async () => {
      const res = await toggleAdsStep(clientId, step, !current);
      if (res?.error) return void toast.error(res.error);
      router.refresh();
    });
  }

  function save() {
    startNotes(async () => {
      const res = await saveAdsNotes(clientId, campanas || null, notas || null);
      if (res?.error) return void toast.error(res.error);
      toast.success("Guardado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Progreso */}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Progreso</span>
          <span className="text-muted-foreground">
            {doneCount}/{STEPS.length} pasos · {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Pasos */}
      <ol className="space-y-2">
        {STEPS.map((s, i) => {
          const val = stepVal(s.key);
          const done = !!val;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggle(s.key, val)}
                disabled={pending}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40",
                  done && "border-emerald-300/60 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/10"
                )}
              >
                <span className="mt-0.5 shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">{i + 1}.</span>
                    <span className={cn("font-medium", done && "text-emerald-800 dark:text-emerald-200")}>
                      {s.titulo}
                    </span>
                    {done && val && (
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">✓ {fmtWhen(val)}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{s.desc}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Notas */}
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Campañas clave</label>
          <Textarea
            value={campanas}
            onChange={(e) => setCampanas(e.target.value)}
            rows={3}
            placeholder="Qué campañas se definieron para esta cuenta (objetivo, público, presupuesto)…"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Notas</label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Cualquier detalle del setup (IDs de cuenta, observaciones, pendientes)…"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={savingNotes} className="gap-1.5">
            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
