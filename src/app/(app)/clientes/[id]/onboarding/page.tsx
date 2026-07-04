import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Network,
  Palette,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/payment-reminder";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingContractForm } from "@/components/onboarding-contract-form";
import { AssignContractNumberButton } from "@/components/assign-contract-number-button";
import { HelpTrigger } from "@/components/help-trigger";
import { loadOnboarding, OnboardingStepRow } from "./_shared";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  params,
}: {
  params: { id: string };
}) {
  // Onboarding INICIAL: solo Dirección (admin).
  await requireRole(["admin"]);

  const data = await loadOnboarding(params.id);
  if (!data) notFound();
  const { client, services, onb, coordName, mediaBuyerName, total, pagoEsperado, credenciales, tienePauta, steps, hasContractData } = data;

  const inicialSteps = steps.filter((s) => s.stage === "inicial");
  const inicialDone = inicialSteps.filter((s) => s.done).length;
  const progress = Math.round((inicialDone / inicialSteps.length) * 100);

  // Cuentas hermanas: otras cuentas activas del MISMO titular (mismo teléfono).
  // Si hay al menos una, se ofrece generar la carta acuerdo UNIFICADA.
  const miTel = normalizePhone(client.contacto_telefono);
  let hermanas: { id: string; nombre: string }[] = [];
  if (miTel) {
    const supabase = createClient();
    const { data: otras } = await supabase
      .from("clients")
      .select("id, nombre, contacto_telefono")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .neq("id", client.id);
    hermanas = ((otras ?? []) as { id: string; nombre: string; contacto_telefono: string | null }[])
      .filter((o) => normalizePhone(o.contacto_telefono) === miTel)
      .map((o) => ({ id: o.id, nombre: o.nombre }));
  }
  // La carta unificada arranca por esta cuenta (define las condiciones comunes).
  const unifiedIds = [client.id, ...hermanas.map((h) => h.id)].join(",");

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
          Onboarding inicial · Dirección
          <HelpTrigger slug="onboarding" label="Cómo funciona el onboarding" />
        </div>
        <h1 className="mt-1 text-2xl font-bold">{client.nombre}</h1>
        <p className="text-muted-foreground">
          {inicialDone}/{inicialSteps.length} pasos · {progress}%
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Datos contractuales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del contrato</CardTitle>
          <p className="text-xs text-muted-foreground">
            Estos datos se usan para generar la carta acuerdo en PDF.
          </p>
        </CardHeader>
        <CardContent>
          <OnboardingContractForm
            clientId={client.id}
            initial={{
              contacto_nombre: client.contacto_nombre,
              contacto_dni_cuit: client.contacto_dni_cuit,
              contacto_domicilio: client.contacto_domicilio,
              contrato_numero: client.contrato_numero,
              contrato_fecha_inicio: client.contrato_fecha_inicio,
              contrato_plazo_meses: client.contrato_plazo_meses,
              contrato_dia_cobro: client.contrato_dia_cobro,
              contrato_moneda: client.contrato_moneda ?? "ARS",
              contrato_descuento_pct: client.contrato_descuento_pct,
              contrato_descuento_monto: client.contrato_descuento_monto,
              contrato_descuento_meses: client.contrato_descuento_meses,
              contrato_observaciones: client.contrato_observaciones,
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!client.contrato_numero && <AssignContractNumberButton clientId={client.id} />}
            <Link
              href={`/contrato/cliente/${client.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FFD400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#FFC700]"
            >
              <FileText className="h-3.5 w-3.5" /> Ver carta acuerdo (PDF)
            </Link>
            {hermanas.length > 0 && (
              <Link
                href={`/contrato/unificado?ids=${unifiedIds}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#FFD400] px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-[#FFF7CC] dark:hover:bg-[#FFD400]/10"
              >
                <FileText className="h-3.5 w-3.5" /> Carta unificada (
                {hermanas.length + 1} marcas)
              </Link>
            )}
          </div>
          {hermanas.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Mismo titular que{" "}
              <b>{hermanas.map((h) => h.nombre).join(", ")}</b> (mismo teléfono).
              La carta unificada cubre todas las marcas en un solo documento, con
              el detalle y el total combinados.
            </p>
          )}

          {!hasContractData && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
              <span className="text-amber-900 dark:text-amber-200">
                Faltan datos contractuales (nombre, DNI/CUIT, fecha de inicio o plazo). Completalos antes de generar la carta.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Servicios contratados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Servicios contratados{" "}
            <span className="text-sm font-normal text-muted-foreground">({services.length})</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Definí los servicios desde la ficha del cliente. El total mensual se calcula automático.
          </p>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm">
              <p className="text-muted-foreground">No hay servicios cargados todavía.</p>
              <Link href={`/clientes/${client.id}`}>
                <Button size="sm" variant="outline" className="mt-2">
                  Ir a la ficha del cliente
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {services.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{SERVICE_TYPE_LABEL[s.tipo] ?? s.tipo}</div>
                    {s.pack && <div className="text-xs text-muted-foreground">{s.pack}</div>}
                  </div>
                  <div className="text-sm tabular-nums">
                    {s.monto_mensual
                      ? `${s.moneda || "ARS"} ${Number(s.monto_mensual).toLocaleString("es-AR")}`
                      : "—"}
                  </div>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Total mensual</span>
                <span className="tabular-nums">
                  {client.contrato_moneda ?? "ARS"} {total.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ETAPA 1 · INICIAL ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Etapa 1 · Inicial
              </div>
              <CardTitle className="text-base">Onboarding inicial</CardTitle>
              <p className="text-xs text-muted-foreground">
                A cargo de Dirección. Desde la carta acuerdo hasta el documento guía del meet.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {inicialDone}/{inicialSteps.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {inicialSteps.map((s) => (
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

      {inicialDone === inicialSteps.length && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          <div>
            <div className="font-semibold text-emerald-900 dark:text-emerald-200">
              Etapa inicial completa 🎉
            </div>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70">
              Listo para que la coordinación tome el onboarding de Gestión de Redes.
            </p>
          </div>
        </div>
      )}

      {/* Acceso a las otras etapas (admin ve todo) */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href={`/clientes/${client.id}/onboarding/redes`}
          className="flex items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Network className="h-4 w-4 text-primary" />
            <span>
              Onboarding de Gestión de Redes
              <span className="block text-xs font-normal text-muted-foreground">
                Coordinación{coordName ? ` · ${coordName}` : ""}
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          href={`/clientes/${client.id}/onboarding/cm`}
          className="flex items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>
              Onboarding de Community Manager
              <span className="block text-xs font-normal text-muted-foreground">
                Arranque operativo de la cuenta
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          href={`/clientes/${client.id}/onboarding/diseno`}
          className="flex items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-muted"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Palette className="h-4 w-4 text-primary" />
            <span>
              Onboarding de Diseño Gráfico
              <span className="block text-xs font-normal text-muted-foreground">
                Identidad visual del arranque
              </span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

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
    </div>
  );
}
