import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, MessageCircle } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTrigger } from "@/components/help-trigger";
import { loadOnboarding, OnboardingStepRow } from "../_shared";

export const dynamic = "force-dynamic";

export default async function OnboardingCmPage({
  params,
}: {
  params: { id: string };
}) {
  // Onboarding del Community Manager: lo hace la CM de la cuenta; admin y la
  // coordinación general también lo ven.
  await requireRole(["admin", "coordinador", "community_manager"]);

  const data = await loadOnboarding(params.id);
  if (!data) notFound();
  const { client, onb, pagoEsperado, credenciales, steps } = data;

  const cmSteps = steps.filter((s) => s.stage === "cm");
  const cmDone = cmSteps.filter((s) => s.done).length;
  const progress = Math.round((cmDone / cmSteps.length) * 100);

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
          Onboarding · Community Manager
          <HelpTrigger slug="onboarding" label="Cómo funciona el onboarding" />
        </div>
        <h1 className="mt-1 text-2xl font-bold">{client.nombre}</h1>
        <p className="text-muted-foreground">
          El arranque operativo de la cuenta · {cmDone}/{cmSteps.length} pasos ·{" "}
          {progress}%
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
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <MessageCircle className="h-3.5 w-3.5" /> Community Manager
              </div>
              <CardTitle className="text-base">Arranque operativo de la cuenta</CardTitle>
              <p className="text-xs text-muted-foreground">
                Dejá la cuenta lista para operar: accesos a todas las redes,
                rediseño de perfiles y biografías, y el Instagram vinculado a la
                página de Facebook.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {cmDone}/{cmSteps.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {cmSteps.map((s) => (
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

      {cmDone === cmSteps.length && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          <div>
            <div className="font-semibold text-emerald-900 dark:text-emerald-200">
              Cuenta lista para operar 🎉
            </div>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70">
              {client.nombre} quedó con sus perfiles al día y todo vinculado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
