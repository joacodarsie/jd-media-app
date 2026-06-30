import Link from "next/link";
import {
  FileText,
  FileBarChart,
  CreditCard,
  Users,
  MessageSquare,
  ListChecks,
  CalendarPlus,
  Phone,
  FolderPlus,
  KeyRound,
  UserCircle,
  Palette,
  Package,
  Layers,
  BadgeCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { fmtDate } from "@/lib/dates";
import type { ClientService } from "@/lib/types";
import { OnboardingStepToggle } from "@/components/onboarding-step-toggle";
import { OnboardingDriveField } from "@/components/onboarding-drive-field";
import { ClientListEditor } from "@/components/client-list-editor";
import { MeetGuideGenerator } from "@/components/meet-guide-generator";
import { WelcomeMessagesDialog } from "@/components/welcome-messages-dialog";
import { PaymentMessageDialog } from "@/components/payment-message-dialog";
import { PagoRecibidoControl } from "@/components/pago-recibido-control";
import { GenerateInitialTasksButton } from "@/components/generate-initial-tasks-button";
import { MeetGuideViewer } from "@/components/meet-guide-viewer";

export interface ClientLite {
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
  coordinador_id: string | null;
  media_buyer_id: string | null;
  drive_url: string | null;
  credenciales: Record<string, string>[] | null;
  contrato_numero: string | null;
  contrato_fecha_inicio: string | null;
  contrato_plazo_meses: number | null;
  contrato_dia_cobro: number | null;
  contrato_moneda: string | null;
  contrato_descuento_pct: number | null;
  contrato_descuento_meses: number | null;
  contrato_observaciones: string | null;
}

export interface OnboardingState {
  cliente_id: string;
  carta_enviada_at: string | null;
  pago_recibido_at: string | null;
  pago_recibido_monto: number | null;
  pago_recibido_nota: string | null;
  equipo_asignado_at: string | null;
  grupo_wpp_creado_at: string | null;
  mensajes_enviados_at: string | null;
  diagnostico_generado_at: string | null;
  tareas_iniciales_at: string | null;
  kickoff_agendado_at: string | null;
  meet_guide_md: string | null;
  meet_guide_generated_at: string | null;
  drive_creado_at: string | null;
  accesos_cargados_at: string | null;
  perfiles_rediseno_at: string | null;
  dg_manual_marca_at: string | null;
  dg_kit_marca_at: string | null;
  dg_proyecto_canva_at: string | null;
  dg_plantillas_historias_at: string | null;
  dg_aprobado_at: string | null;
}

export type Stage = "inicial" | "redes" | "diseno";

export type StepDef = {
  key:
    | "carta_enviada_at"
    | "pago_recibido_at"
    | "equipo_asignado_at"
    | "grupo_wpp_creado_at"
    | "mensajes_enviados_at"
    | "meet_guide"
    | "kickoff_agendado_at"
    | "diagnostico_generado_at"
    | "accesos_cargados_at"
    | "drive_creado_at"
    | "perfiles_rediseno_at"
    | "tareas_iniciales_at"
    | "dg_manual_marca_at"
    | "dg_kit_marca_at"
    | "dg_proyecto_canva_at"
    | "dg_plantillas_historias_at"
    | "dg_aprobado_at";
  stage: Stage;
  title: string;
  done: string | null | undefined;
  icon: typeof FileText;
  description?: string;
  autoDerived?: boolean;
};

export interface OnboardingData {
  client: ClientLite;
  services: ClientService[];
  onb: OnboardingState;
  coordName: string | null;
  mediaBuyerName: string | null;
  total: number;
  pagoEsperado: number;
  credenciales: Record<string, string>[];
  tienePauta: boolean;
  steps: StepDef[];
  hasContractData: boolean;
}

export function calendarUrl(client: ClientLite) {
  const text = encodeURIComponent(`Kickoff / Onboarding ${client.nombre} — JD Media`);
  const details = encodeURIComponent(
    `Reunión de kickoff y onboarding con ${client.contacto_nombre ?? client.nombre}. Presentar equipo y cronograma + relevamiento estratégico de la marca (grabar para el diagnóstico).`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`;
}

/** Carga todos los datos del onboarding de un cliente (o null si no existe). */
export async function loadOnboarding(clientId: string): Promise<OnboardingData | null> {
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
        "id, nombre, contacto_nombre, contacto_dni_cuit, contacto_domicilio, contacto_email, contacto_telefono, cm_id, disenador_id, audiovisual_id, coordinador_id, media_buyer_id, drive_url, credenciales, contrato_numero, contrato_fecha_inicio, contrato_plazo_meses, contrato_dia_cobro, contrato_moneda, contrato_descuento_pct, contrato_descuento_meses, contrato_observaciones"
      )
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("client_services")
      .select("*")
      .eq("cliente_id", clientId)
      .eq("activo", true)
      .order("tipo"),
    admin.from("client_onboarding").select("*").eq("cliente_id", clientId).maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("cliente_id", clientId),
    supabase
      .from("client_diagnostics")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clientId)
      .eq("status", "approved"),
  ]);

  if (!clientData) return null;
  const client = clientData as ClientLite;
  const services = (servicesData ?? []) as ClientService[];
  const onb = (onbData ?? {
    cliente_id: client.id,
    carta_enviada_at: null,
    pago_recibido_at: null,
    pago_recibido_monto: null,
    pago_recibido_nota: null,
    equipo_asignado_at: null,
    grupo_wpp_creado_at: null,
    mensajes_enviados_at: null,
    diagnostico_generado_at: null,
    tareas_iniciales_at: null,
    kickoff_agendado_at: null,
    meet_guide_md: null,
    meet_guide_generated_at: null,
    drive_creado_at: null,
    accesos_cargados_at: null,
    perfiles_rediseno_at: null,
    dg_manual_marca_at: null,
    dg_kit_marca_at: null,
    dg_proyecto_canva_at: null,
    dg_plantillas_historias_at: null,
    dg_aprobado_at: null,
  }) as OnboardingState;

  // Nombres de los responsables (coordinador de la cuenta / media buyer).
  const ownerIds = [client.coordinador_id, client.media_buyer_id].filter(
    (x): x is string => !!x
  );
  let coordName: string | null = null;
  let mediaBuyerName: string | null = null;
  if (ownerIds.length) {
    const { data: owners } = await admin
      .from("users")
      .select("id, nombre")
      .in("id", ownerIds);
    const byId = new Map(
      ((owners ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre])
    );
    coordName = client.coordinador_id ? byId.get(client.coordinador_id) ?? null : null;
    mediaBuyerName = client.media_buyer_id ? byId.get(client.media_buyer_id) ?? null : null;
  }

  const credenciales = (client.credenciales ?? []) as Record<string, string>[];
  // Gestión de redes ya incluye el paid media básico en Meta Ads, así que la
  // etapa/sección de publicidad se muestra con cualquiera de los dos servicios.
  const tienePauta = services.some(
    (s) => s.tipo === "paid_media" || s.tipo === "gestion_redes"
  );

  const total = services.reduce((acc, s) => acc + (Number(s.monto_mensual) || 0), 0);
  const pagoEsperado = services.reduce((acc, s) => {
    const m = Number(s.monto_mensual) || 0;
    return acc + (s.facturacion === "unico" ? m * 0.5 : m);
  }, 0);

  // Señales derivadas del sistema.
  const teamAssigned = !!client.cm_id || !!client.disenador_id || !!client.audiovisual_id;
  const cartaDerived = !!client.contrato_numero;
  const tareasDerived = (tasksCount ?? 0) > 0;
  const diagnosticoDerived = (diagApprovedCount ?? 0) > 0;
  const driveDerived = !!client.drive_url;
  const accesosDerived = credenciales.length > 0;

  const steps: StepDef[] = [
    // ── ETAPA 1 · INICIAL (Dirección) ──
    {
      key: "carta_enviada_at",
      stage: "inicial",
      title: "Carta acuerdo + cobro enviados",
      done: (onb.carta_enviada_at || cartaDerived) as string | null,
      autoDerived: !onb.carta_enviada_at && cartaDerived,
      icon: FileText,
      description:
        "Descargá el PDF de la carta acuerdo y mandá el mensaje de cobro (con el monto del mes y datos bancarios autocalculados).",
    },
    {
      key: "pago_recibido_at",
      stage: "inicial",
      title: "Pago recibido",
      done: onb.pago_recibido_at,
      icon: CreditCard,
      description:
        "Registrá cuánto pagó el cliente. Si señó (pago parcial), cargá el monto recibido y queda registrado cuánto debe todavía.",
    },
    {
      key: "equipo_asignado_at",
      stage: "inicial",
      title: "Equipo asignado",
      done: (onb.equipo_asignado_at || teamAssigned) as string | null,
      autoDerived: !onb.equipo_asignado_at && teamAssigned,
      icon: Users,
      description: "Asigná CM, diseñador y/o audiovisual desde la ficha del cliente.",
    },
    {
      key: "grupo_wpp_creado_at",
      stage: "inicial",
      title: "Grupo de WhatsApp creado",
      done: onb.grupo_wpp_creado_at,
      icon: Phone,
      description: "Creá el grupo en WhatsApp con el cliente + equipo asignado.",
    },
    {
      key: "mensajes_enviados_at",
      stage: "inicial",
      title: "Mensajes de bienvenida enviados",
      done: onb.mensajes_enviados_at,
      icon: MessageSquare,
      description:
        "Generá la cadena adaptada a los servicios contratados, copiala y pegala en el grupo.",
    },
    {
      key: "meet_guide",
      stage: "inicial",
      title: "Documento guía del meet de onboarding",
      done: onb.meet_guide_generated_at ?? onb.meet_guide_md ?? null,
      icon: FileText,
      description:
        "Generá con IA la guía personalizada del meet de onboarding a partir de la transcripción del meet comercial. Acá termina tu etapa: la guía la usa la coordinadora para conducir la reunión.",
    },
    // ── ETAPA 2 · GESTIÓN DE REDES (Coordinación) ──
    {
      key: "kickoff_agendado_at",
      stage: "redes",
      title: "Reunión de onboarding",
      done: onb.kickoff_agendado_at,
      icon: CalendarPlus,
      description:
        "Coordiná la primera reunión con el cliente y el equipo: presentación + relevamiento estratégico (de acá sale la transcripción para el diagnóstico). Cargala en Calendar.",
    },
    {
      key: "diagnostico_generado_at",
      stage: "redes",
      title: "Diagnóstico inicial generado",
      done: (onb.diagnostico_generado_at || diagnosticoDerived) as string | null,
      autoDerived: !onb.diagnostico_generado_at && diagnosticoDerived,
      icon: FileBarChart,
      description:
        "Subí la transcripción del meet de onboarding (PDF de Tactiq). La IA arma el informe estratégico que después usamos como brief.",
    },
    {
      key: "accesos_cargados_at",
      stage: "redes",
      title: "Accesos del cliente cargados",
      done: (onb.accesos_cargados_at || accesosDerived) as string | null,
      autoDerived: !onb.accesos_cargados_at && accesosDerived,
      icon: KeyRound,
      description:
        "Cargá los accesos que pase el cliente: Instagram, TikTok, Facebook y cualquier otro acceso relevante. Quedan guardados en la ficha del cliente.",
    },
    {
      key: "drive_creado_at",
      stage: "redes",
      title: "Drive del cliente creado",
      done: (onb.drive_creado_at || driveDerived) as string | null,
      autoDerived: !onb.drive_creado_at && driveDerived,
      icon: FolderPlus,
      description:
        "Creá la carpeta del cliente en el Drive de JD Media con sus 3 subcarpetas y pegá el link (se muestra en el calendario de contenidos).",
    },
    {
      key: "perfiles_rediseno_at",
      stage: "redes",
      title: "Rediseño de perfiles y biografías realizado",
      done: onb.perfiles_rediseno_at,
      icon: UserCircle,
      description:
        "Actualizá foto de perfil, biografía, links, portadas e historias destacadas de las cuentas según la nueva identidad.",
    },
    {
      key: "tareas_iniciales_at",
      stage: "redes",
      title: "Tareas iniciales creadas",
      done: (onb.tareas_iniciales_at || tareasDerived) as string | null,
      autoDerived: !onb.tareas_iniciales_at && tareasDerived,
      icon: ListChecks,
      description:
        "Genera automáticamente las tareas según los servicios (auditoría, manual, calendario, etc.).",
    },
    // ── ETAPA 3 · DISEÑO GRÁFICO (arranque visual, lo hace el diseñador/a) ──
    {
      key: "dg_manual_marca_at",
      stage: "diseno",
      title: "Manual de marca creado",
      done: onb.dg_manual_marca_at,
      icon: FileText,
      description:
        "Armá el manual de marca del cliente en Canva: logo y variantes, paleta, tipografías, usos y tono visual.",
    },
    {
      key: "dg_kit_marca_at",
      stage: "diseno",
      title: "Kit de marca armado",
      done: onb.dg_kit_marca_at,
      icon: Package,
      description:
        "Cargá el kit de marca en Canva (logos, colores y fuentes) para que todo el equipo diseñe con la identidad correcta.",
    },
    {
      key: "dg_proyecto_canva_at",
      stage: "diseno",
      title: "Proyecto en Canva del cliente",
      done: onb.dg_proyecto_canva_at,
      icon: Palette,
      description:
        "Creá la carpeta/proyecto del cliente en Canva con su estructura, lista para producir el contenido.",
    },
    {
      key: "dg_plantillas_historias_at",
      stage: "diseno",
      title: "Plantillas de historias",
      done: onb.dg_plantillas_historias_at,
      icon: Layers,
      description:
        "Diseñá las plantillas base de historias (preguntas, encuestas, placas) para mantener coherencia visual.",
    },
    {
      key: "dg_aprobado_at",
      stage: "diseno",
      title: "Aprobado por Coordinación de Diseño",
      done: onb.dg_aprobado_at,
      icon: BadgeCheck,
      description:
        "La Coordinación de Diseño revisa y aprueba el manual de marca y las plantillas de historias antes de mandarlos al grupo del cliente. (Los posteos del día a día NO pasan por esta aprobación.)",
    },
  ];

  const hasContractData = !!(
    client.contrato_fecha_inicio &&
    (client.contrato_plazo_meses ?? 0) > 0 &&
    client.contacto_nombre &&
    client.contacto_dni_cuit
  );

  return {
    client,
    services,
    onb,
    coordName,
    mediaBuyerName,
    total,
    pagoEsperado,
    credenciales,
    tienePauta,
    steps,
    hasContractData,
  };
}

/** Renderiza una fila del checklist con su acción contextual. */
export function OnboardingStepRow({
  step,
  client,
  onb,
  pagoEsperado,
  credenciales,
}: {
  step: StepDef;
  client: ClientLite;
  onb: OnboardingState;
  pagoEsperado: number;
  credenciales: Record<string, string>[];
}) {
  const Icon = step.icon;
  const isDone = !!step.done;
  return (
    <div
      className={`flex items-start gap-3 rounded-md border bg-card p-3 transition ${
        isDone
          ? "border-emerald-300/60 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/15"
          : ""
      }`}
    >
      {step.key === "meet_guide" ? (
        <OnboardingStepToggle
          clientId={client.id}
          stepKey="meet_guide_generated_at"
          initialDone={isDone}
        />
      ) : (
        <OnboardingStepToggle
          clientId={client.id}
          stepKey={step.key as Exclude<StepDef["key"], "meet_guide">}
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
            <span className="text-[11px] text-muted-foreground">{fmtDate(step.done)}</span>
          )}
        </div>
        {step.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
        )}
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
              <PaymentMessageDialog clientId={client.id} alreadyDone={isDone} />
            </>
          )}
          {step.key === "pago_recibido_at" && (
            <PagoRecibidoControl
              clientId={client.id}
              esperado={pagoEsperado}
              moneda={client.contrato_moneda ?? "ARS"}
              initialMonto={onb.pago_recibido_monto}
              initialNota={onb.pago_recibido_nota}
            />
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
          {step.key === "accesos_cargados_at" && (
            <div className="w-full rounded-md border bg-muted/20 p-2.5">
              <ClientListEditor
                clientId={client.id}
                field="credenciales"
                title="Accesos del cliente"
                description="Instagram, TikTok, Facebook y cualquier otro acceso que pase el cliente. Es la misma lista que figura en la ficha del cliente."
                addLabel="Agregar acceso"
                initial={credenciales}
                itemFields={[
                  { name: "servicio", label: "Plataforma / servicio", placeholder: "Ej: Instagram, TikTok, Facebook" },
                  { name: "url", label: "URL (opcional)", type: "url", placeholder: "https://…" },
                  { name: "usuario", label: "Usuario / Email" },
                  { name: "password", label: "Contraseña", type: "password" },
                  { name: "notas", label: "Notas (opcional)" },
                ]}
              />
            </div>
          )}
          {step.key === "drive_creado_at" && (
            <OnboardingDriveField clientId={client.id} initialUrl={client.drive_url} />
          )}
          {step.key === "tareas_iniciales_at" && (
            <GenerateInitialTasksButton clientId={client.id} alreadyDone={isDone} />
          )}
          {step.key === "kickoff_agendado_at" && (
            <>
              <a
                href={calendarUrl(client)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20"
              >
                <CalendarPlus className="h-3 w-3" /> Agendar en Calendar
              </a>
              <div className="w-full">
                <MeetGuideViewer
                  markdown={onb.meet_guide_md}
                  generatedAt={onb.meet_guide_generated_at}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
