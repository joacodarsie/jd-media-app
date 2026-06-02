import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  FileBarChart,
  CheckCircle2,
  Circle,
  CreditCard,
  Users,
  MessageSquare,
  ListChecks,
  CalendarPlus,
  Phone,
  AlertTriangle,
} from "lucide-react";
import { requireClientAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import type { ClientService } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingStepToggle } from "@/components/onboarding-step-toggle";
import { OnboardingContractForm } from "@/components/onboarding-contract-form";
import { MeetGuideGenerator } from "@/components/meet-guide-generator";
import { WelcomeMessagesDialog } from "@/components/welcome-messages-dialog";
import { PaymentMessageDialog } from "@/components/payment-message-dialog";
import { GenerateInitialTasksButton } from "@/components/generate-initial-tasks-button";
import { AssignContractNumberButton } from "@/components/assign-contract-number-button";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

interface ClientLite {
  id: string;
  nombre: string;
  contacto_nombre: string | null;
  contacto_dni_cuit: string | null;
  contacto_domicilio: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
  contrato_numero: string | null;
  contrato_fecha_inicio: string | null;
  contrato_plazo_meses: number | null;
  contrato_dia_cobro: number | null;
  contrato_moneda: string | null;
  contrato_descuento_pct: number | null;
  contrato_descuento_meses: number | null;
  contrato_observaciones: string | null;
}

interface OnboardingState {
  cliente_id: string;
  carta_enviada_at: string | null;
  pago_recibido_at: string | null;
  equipo_asignado_at: string | null;
  grupo_wpp_creado_at: string | null;
  mensajes_enviados_at: string | null;
  diagnostico_generado_at: string | null;
  tareas_iniciales_at: string | null;
  kickoff_agendado_at: string | null;
  meet_guide_md: string | null;
  meet_guide_generated_at: string | null;
}

function calendarUrl(client: ClientLite) {
  const text = encodeURIComponent(`Kickoff / Onboarding ${client.nombre} — JD Media`);
  const details = encodeURIComponent(
    `Reunión de kickoff y onboarding con ${client.contacto_nombre ?? client.nombre}. Presentar equipo y cronograma + relevamiento estratégico de la marca (grabar para el diagnóstico).`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`;
}

export default async function OnboardingPage({
  params,
}: {
  params: { id: string };
}) {
  await requireClientAccess(params.id);
  const supabase = createClient();
  const admin = createAdmin();

  const [
    { data: clientData },
    { data: servicesData },
    { data: onbData },
    { count: tasksCount },
    { count: diagApprovedCount },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, nombre, contacto_nombre, contacto_dni_cuit, contacto_domicilio, contacto_email, contacto_telefono, cm_id, disenador_id, audiovisual_id, contrato_numero, contrato_fecha_inicio, contrato_plazo_meses, contrato_dia_cobro, contrato_moneda, contrato_descuento_pct, contrato_descuento_meses, contrato_observaciones"
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("client_services")
      .select("*")
      .eq("cliente_id", params.id)
      .eq("activo", true)
      .order("tipo"),
    admin
      .from("client_onboarding")
      .select("*")
      .eq("cliente_id", params.id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", params.id),
    supabase
      .from("client_diagnostics")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", params.id)
      .eq("status", "approved"),
  ]);

  if (!clientData) notFound();
  const client = clientData as ClientLite;
  const services = (servicesData ?? []) as ClientService[];
  const onb = (onbData ?? {
    cliente_id: client.id,
    carta_enviada_at: null,
    pago_recibido_at: null,
    equipo_asignado_at: null,
    grupo_wpp_creado_at: null,
    mensajes_enviados_at: null,
    diagnostico_generado_at: null,
    tareas_iniciales_at: null,
    kickoff_agendado_at: null,
    meet_guide_md: null,
    meet_guide_generated_at: null,
  }) as OnboardingState;

  // Estado derivado
  const total = services.reduce(
    (acc, s) => acc + (Number(s.monto_mensual) || 0),
    0
  );

  // Señales que el sistema sabe SIN que el usuario tenga que clickear:
  // - Equipo: si hay al menos un rol asignado
  // - Carta enviada: si ya tiene número de contrato asignado
  // - Tareas iniciales: si existen tareas vinculadas al cliente
  // - Diagnóstico generado: si hay al menos un diagnóstico aprobado
  const teamAssigned =
    !!client.cm_id || !!client.disenador_id || !!client.audiovisual_id;
  const cartaDerived = !!client.contrato_numero;
  const tareasDerived = (tasksCount ?? 0) > 0;
  const diagnosticoDerived = (diagApprovedCount ?? 0) > 0;

  const equipoDoneEffective = onb.equipo_asignado_at || teamAssigned;
  const cartaDoneEffective = onb.carta_enviada_at || cartaDerived;
  const tareasDoneEffective = onb.tareas_iniciales_at || tareasDerived;
  const diagDoneEffective = onb.diagnostico_generado_at || diagnosticoDerived;

  const steps: Array<{
    key:
      | "carta_enviada_at"
      | "pago_recibido_at"
      | "equipo_asignado_at"
      | "grupo_wpp_creado_at"
      | "mensajes_enviados_at"
      | "meet_guide"
      | "kickoff_agendado_at"
      | "diagnostico_generado_at"
      | "tareas_iniciales_at";
    title: string;
    done: string | null | undefined;
    icon: typeof FileText;
    description?: string;
    autoDerived?: boolean;
    /** Fila especial sin toggle de DB (estado derivado, acción propia). */
    custom?: boolean;
  }> = [
    {
      key: "carta_enviada_at",
      title: "Carta acuerdo + cobro enviados",
      done: cartaDoneEffective as string | null,
      autoDerived: !onb.carta_enviada_at && cartaDerived,
      icon: FileText,
      description: "Descargá el PDF de la carta acuerdo y mandá el mensaje de cobro (con proporcional y datos bancarios autocalculados).",
    },
    {
      key: "pago_recibido_at",
      title: "Pago recibido",
      done: onb.pago_recibido_at,
      icon: CreditCard,
      description: "Confirmá el ingreso del primer pago antes de seguir con el resto del proceso.",
    },
    {
      key: "equipo_asignado_at",
      title: "Equipo asignado",
      done: equipoDoneEffective as string | null,
      autoDerived: !onb.equipo_asignado_at && teamAssigned,
      icon: Users,
      description: "Asigná CM, diseñador y/o audiovisual desde la ficha del cliente.",
    },
    {
      key: "grupo_wpp_creado_at",
      title: "Grupo de WhatsApp creado",
      done: onb.grupo_wpp_creado_at,
      icon: Phone,
      description: "Creá el grupo en WhatsApp con el cliente + equipo asignado.",
    },
    {
      key: "mensajes_enviados_at",
      title: "Mensajes de bienvenida enviados",
      done: onb.mensajes_enviados_at,
      icon: MessageSquare,
      description: "Generá la cadena adaptada a los servicios contratados, copiala y pegala en el grupo.",
    },
    {
      key: "meet_guide",
      title: "Documento guía del meet de onboarding",
      done: onb.meet_guide_md ? (onb.meet_guide_generated_at ?? onb.meet_guide_md) : null,
      icon: FileText,
      custom: true,
      description: "Generá con IA la guía personalizada del meet de onboarding a partir de la transcripción del meet comercial. Usala para conducir la reunión.",
    },
    {
      key: "kickoff_agendado_at",
      title: "Reunión de kickoff / onboarding agendada",
      done: onb.kickoff_agendado_at,
      icon: CalendarPlus,
      description: "Coordiná la primera reunión con el cliente y el equipo: presentación + relevamiento estratégico (de acá sale la transcripción para el diagnóstico). Cargala en Calendar.",
    },
    {
      key: "diagnostico_generado_at",
      title: "Diagnóstico inicial generado",
      done: diagDoneEffective as string | null,
      autoDerived: !onb.diagnostico_generado_at && diagnosticoDerived,
      icon: FileBarChart,
      description: "Subí la transcripción del meet de onboarding (PDF de Tactiq). La IA arma el informe estratégico que después usamos como brief.",
    },
    {
      key: "tareas_iniciales_at",
      title: "Tareas iniciales creadas",
      done: tareasDoneEffective as string | null,
      autoDerived: !onb.tareas_iniciales_at && tareasDerived,
      icon: ListChecks,
      description: "Genera automáticamente las tareas según los servicios (auditoría, manual, calendario, etc.).",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  // Validaciones para mostrar warnings
  const hasContractData =
    client.contrato_fecha_inicio &&
    (client.contrato_plazo_meses ?? 0) > 0 &&
    client.contacto_nombre &&
    client.contacto_dni_cuit;

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
          Onboarding
          <HelpTrigger slug="onboarding" label="Cómo funciona el onboarding" />
        </div>
        <h1 className="mt-1 text-2xl font-bold">{client.nombre}</h1>
        <p className="text-muted-foreground">
          {doneCount}/{steps.length} pasos completados · {progress}%
        </p>
      </div>

      {/* Barra progreso */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Datos contractuales (form) */}
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
              contrato_descuento_meses: client.contrato_descuento_meses,
              contrato_observaciones: client.contrato_observaciones,
            }}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!client.contrato_numero && (
              <AssignContractNumberButton clientId={client.id} />
            )}
            <Link
              href={`/contrato/cliente/${client.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FFD400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#FFC700]"
            >
              <FileText className="h-3.5 w-3.5" /> Ver carta acuerdo (PDF)
            </Link>
          </div>

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
            <span className="text-sm font-normal text-muted-foreground">
              ({services.length})
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Definí los servicios desde la ficha del cliente. El total mensual se
            calcula automático.
          </p>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm">
              <p className="text-muted-foreground">
                No hay servicios cargados todavía.
              </p>
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
                    <div className="font-medium">
                      {SERVICE_TYPE_LABEL[s.tipo] ?? s.tipo}
                    </div>
                    {s.pack && (
                      <div className="text-xs text-muted-foreground">
                        {s.pack}
                      </div>
                    )}
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
                  {(client.contrato_moneda ?? "ARS")}{" "}
                  {total.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de onboarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.map((step) => {
            const Icon = step.icon;
            const isDone = !!step.done;
            return (
              <div
                key={step.key}
                className={`flex items-start gap-3 rounded-md border bg-card p-3 transition ${
                  isDone ? "border-emerald-300/60 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/15" : ""
                }`}
              >
                {step.custom ? (
                  <div
                    className="mt-0.5"
                    title={isDone ? "Generado" : "Pendiente"}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                ) : (
                  <OnboardingStepToggle
                    clientId={client.id}
                    stepKey={step.key as Exclude<typeof step.key, "meet_guide">}
                    initialDone={isDone}
                    autoDerived={!!step.autoDerived}
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{step.title}</span>
                      {step.autoDerived && (
                        <span
                          className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
                          title="Detectado desde los datos del sistema"
                        >
                          Auto
                        </span>
                      )}
                    </div>
                    {isDone && step.done && typeof step.done === "string" && (
                      <span className="text-[11px] text-muted-foreground">
                        {fmtDate(step.done)}
                      </span>
                    )}
                  </div>
                  {step.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                  {/* Acciones contextuales */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {step.key === "meet_guide" && (
                      <div className="w-full">
                        <MeetGuideGenerator
                          clienteId={client.id}
                          initialMarkdown={onb.meet_guide_md}
                          initialGeneratedAt={onb.meet_guide_generated_at}
                        />
                      </div>
                    )}
                    {step.key === "carta_enviada_at" && (
                      <>
                        <Link
                          href={`/contrato/cliente/${client.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                        >
                          <FileText className="h-3 w-3" /> Abrir PDF
                        </Link>
                        <PaymentMessageDialog
                          clientId={client.id}
                          alreadyDone={isDone}
                        />
                      </>
                    )}
                    {step.key === "equipo_asignado_at" && (
                      <Link
                        href={`/clientes/${client.id}`}
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                      >
                        <Users className="h-3 w-3" /> Asignar desde ficha
                      </Link>
                    )}
                    {step.key === "mensajes_enviados_at" && (
                      <WelcomeMessagesDialog clientId={client.id} alreadyDone={isDone} />
                    )}
                    {step.key === "diagnostico_generado_at" && (
                      <Link
                        href={`/clientes/${client.id}/diagnostico`}
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                      >
                        <FileBarChart className="h-3 w-3" /> Abrir diagnóstico
                      </Link>
                    )}
                    {step.key === "tareas_iniciales_at" && (
                      <GenerateInitialTasksButton
                        clientId={client.id}
                        alreadyDone={isDone}
                      />
                    )}
                    {step.key === "kickoff_agendado_at" && (
                      <a
                        href={calendarUrl(client)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
                      >
                        <CalendarPlus className="h-3 w-3" /> Agendar en Calendar
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Estado final */}
      {doneCount === steps.length && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 dark:text-emerald-300" />
          <div>
            <div className="font-semibold text-emerald-900 dark:text-emerald-200">
              Onboarding completo 🎉
            </div>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/70">
              Todo listo para arrancar a trabajar con {client.nombre}.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
