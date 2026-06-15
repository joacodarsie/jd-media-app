import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Megaphone, ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTrigger } from "@/components/help-trigger";
import { loadOnboarding, OnboardingStepRow } from "../_shared";

export const dynamic = "force-dynamic";

export default async function OnboardingRedesPage({
  params,
}: {
  params: { id: string };
}) {
  // Onboarding de Gestión de Redes: lo da la coordinación del servicio (+ admin).
  await requireRole(["admin", "coordinador"]);

  const data = await loadOnboarding(params.id);
  if (!data) notFound();
  const { client, onb, coordName, mediaBuyerName, pagoEsperado, credenciales, tienePauta, steps } =
    data;

  const redesSteps = steps.filter((s) => s.stage === "redes");
  const redesDone = redesSteps.filter((s) => s.done).length;
  const progress = Math.round((redesDone / redesSteps.length) * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/clientes/${client.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al cliente
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          Onboarding · Gestión de Redes
          <HelpTrigger slug="onboarding" label="Cómo funciona el onboarding" />
        </div>
        <h1 className="mt-1 text-2xl font-bold">{client.nombre}</h1>
        <p className="text-muted-foreground">
          A cargo de la coordinación{coordName ? ` (${coordName})` : ""} · {redesDone}/
          {redesSteps.length} pasos · {progress}%
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Etapa 2 · Gestión de Redes
              </div>
              <CardTitle className="text-base">Pasos de la coordinación</CardTitle>
              <p className="text-xs text-muted-foreground">
                Conducí el meet de onboarding y dejá la cuenta lista para producir: kickoff,
                diagnóstico, accesos, Drive, perfiles y tareas iniciales.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {redesDone}/{redesSteps.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {redesSteps.map((s) => (
            <OnboardingStepRow
              key={s.key}
              step={s}
              client={client}
              onb={onb}
              pagoEsperado={pagoEsperado}
              credenciales={credenciales}
            />
          ))}
        </CardContent>
      </Card>

      {redesDone === redesSteps.length && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          <div>
            <div className="font-semibold text-emerald-900 dark:text-emerald-200">
              Gestión de Redes lista 🎉
            </div>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70">
              La cuenta de {client.nombre} quedó lista para arrancar a producir.
            </p>
          </div>
        </div>
      )}

      {tienePauta && (
        <Link
          href={`/clientes/${client.id}/pauta`}
          className="flex items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Megaphone className="h-4 w-4 text-primary" />
            <span>
              Onboarding de publicidad
              <span className="block text-xs font-normal text-muted-foreground">
                Paid Media{mediaBuyerName ? ` · ${mediaBuyerName}` : ""}
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}
    </div>
  );
}
