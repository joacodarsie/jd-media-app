import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Palette } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTrigger } from "@/components/help-trigger";
import { loadOnboarding, OnboardingStepRow } from "../_shared";

export const dynamic = "force-dynamic";

export default async function OnboardingDisenoPage({
  params,
}: {
  params: { id: string };
}) {
  // Onboarding de Diseño Gráfico: lo hace el diseñador/a; lo aprueba la
  // Coordinación de Diseño. Admin y la coordinación (general y de diseño) lo ven.
  await requireRole(["admin", "coordinador", "coordinador_diseno", "diseno"]);

  const data = await loadOnboarding(params.id);
  if (!data) notFound();
  const { client, onb, pagoEsperado, credenciales, steps } = data;

  const disenoSteps = steps.filter((s) => s.stage === "diseno");
  const disenoDone = disenoSteps.filter((s) => s.done).length;
  const progress = Math.round((disenoDone / disenoSteps.length) * 100);

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
          Onboarding · Diseño Gráfico
          <HelpTrigger slug="onboarding" label="Cómo funciona el onboarding" />
        </div>
        <h1 className="mt-1 text-2xl font-bold">{client.nombre}</h1>
        <p className="text-muted-foreground">
          El arranque visual de la cuenta · {disenoDone}/{disenoSteps.length} pasos ·{" "}
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
                <Palette className="h-3.5 w-3.5" /> Etapa 3 · Diseño Gráfico
              </div>
              <CardTitle className="text-base">Identidad visual del arranque</CardTitle>
              <p className="text-xs text-muted-foreground">
                Al iniciar una cuenta el diseñador/a crea el manual de marca, el kit,
                el proyecto en Canva y las plantillas. La Coordinación de Diseño lo
                aprueba antes de mandarlo al grupo.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {disenoDone}/{disenoSteps.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {disenoSteps.map((s) => (
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

      {disenoDone === disenoSteps.length && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          <div>
            <div className="font-semibold text-emerald-900 dark:text-emerald-200">
              Identidad visual lista 🎉
            </div>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70">
              La marca de {client.nombre} quedó aprobada y lista para producir contenido.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
