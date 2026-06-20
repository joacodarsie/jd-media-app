import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ExternalLink,
  FileBarChart,
  FileText,
  FolderOpen,
  Globe,
  Mail,
  Megaphone,
  Network,
  Phone,
  Pencil,
  Sparkles,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { listEventsForUser } from "@/lib/google-calendar";
import { CLIENT_STATUS_LABEL } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Client, TaskWithRels } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/markdown";
import { HelpTrigger } from "@/components/help-trigger";
import { TaskList } from "@/components/task-list";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { DeleteClientButton } from "@/components/delete-client-button";
import { ClientServicesEditor } from "@/components/client-services-editor";
import { ClientStatusToggle } from "@/components/client-status-toggle";
import { ClientActivateButton } from "@/components/client-activate-button";
import { ClientListEditor } from "@/components/client-list-editor";
import { DocumentsManager, type DocumentRow } from "@/components/documents-manager";
import { ClientPortalLink } from "@/components/client-portal-link";
import { ClientMeetingsCard } from "@/components/client-meetings-card";
import {
  MovimientosHistorialCard,
  type MovimientoRow,
} from "@/components/movimientos-historial-card";
import { ScrollTopOnMount } from "@/components/scroll-top-on-mount";
import type { ClientService } from "@/lib/types";

export const dynamic = "force-dynamic";

const ESTADO_BADGE: Record<string, string> = {
  activo:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  propuesta:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

interface ClientWithTeam extends Client {
  cm?: { id: string; nombre: string } | null;
  disenador?: { id: string; nombre: string } | null;
  audiovisual?: { id: string; nombre: string } | null;
  fecha_activado?: string | null;
  fecha_inactivado?: string | null;
}

export default async function ClientDetail({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  const admin = createAdmin();
  const [
    { data: client },
    { data: tasks },
    { data: users },
    { data: services },
    { data: clientDocs },
    { data: calConns },
    { data: portalToken },
    { data: invoicesRaw },
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*, cm:users!clients_cm_id_fkey(id,nombre), disenador:users!clients_disenador_id_fkey(id,nombre), audiovisual:users!clients_audiovisual_id_fkey(id,nombre)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select(
        "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url), creador:users!tasks_creado_por_id_fkey(id,nombre)"
      )
      .eq("cliente_id", params.id)
      .order("fecha_limite", { ascending: true, nullsFirst: false }),
    supabase.from("users").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("client_services").select("*").eq("cliente_id", params.id).order("activo", { ascending: false }).order("tipo"),
    supabase
      .from("documents")
      .select(
        "id, titulo, descripcion, categoria, file_name, file_size, mime_type, created_at, cliente_id, texto_extraido, texto_extraido_at, subido_por:users!documents_subido_por_id_fkey(id,nombre)"
      )
      .eq("cliente_id", params.id)
      .order("created_at", { ascending: false }),
    admin
      .from("google_calendar_connections")
      .select("id")
      .or(`owner_user_id.eq.${me.id},visibility.eq.shared`)
      .limit(1),
    admin
      .from("client_portal_tokens")
      .select("token, last_seen_at")
      .eq("cliente_id", params.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Historial de cobros del cliente (últimos 12).
    admin
      .from("client_invoices")
      .select("id, periodo, concepto, monto, moneda, fecha_vencimiento, fecha_cobro")
      .eq("cliente_id", params.id)
      .order("periodo", { ascending: false })
      .order("fecha_emision", { ascending: false })
      .limit(12),
  ]);

  if (!client) notFound();

  // Eventos del Calendar que matcheen este cliente.
  let clientEvents: Awaited<ReturnType<typeof listEventsForUser>> = [];
  if ((calConns ?? []).length > 0) {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    try {
      const all = await listEventsForUser(me.id, now.toISOString(), in30.toISOString());
      const nameLc = (client as Client).nombre.toLowerCase();
      const emailLc = ((client as unknown as { contacto_email?: string }).contacto_email ?? "").toLowerCase();
      clientEvents = all.filter((e) => {
        if (e.status === "cancelled") return false;
        const title = (e.summary ?? "").toLowerCase();
        if (title.includes(nameLc)) return true;
        if (emailLc && (e.attendees ?? []).some((a) => a.email?.toLowerCase() === emailLc)) return true;
        return false;
      });
    } catch {
      /* silencioso */
    }
  }
  const c = client as ClientWithTeam;
  const allTasks = (tasks ?? []) as TaskWithRels[];
  const activas = allTasks.filter((t) => t.estado !== "completada");
  const completadas = allTasks.filter((t) => t.estado === "completada");
  // Solo el admin edita/elimina la ficha del cliente y sus servicios.
  const canEdit = me.rol === "admin";
  // canSeeFinancials = staff o cualquier persona asignada a la cuenta.
  // Las chicas que no esten asignadas pueden ver la ficha pero no datos privados
  // (contacto, monto, CBU, finanzas).
  const svcList = (services ?? []) as ClientService[];
  const assignedToMe =
    (c as unknown as { cm_id?: string | null }).cm_id === me.id ||
    (c as unknown as { disenador_id?: string | null }).disenador_id === me.id ||
    (c as unknown as { audiovisual_id?: string | null }).audiovisual_id === me.id ||
    svcList.some((s) => s.activo && (s.responsables ?? []).includes(me.id));

  // Los no-staff solo pueden abrir sus cuentas ACTIVAS asignadas. Si entran por
  // URL a una cuenta que no es suya (o inactiva), 404.
  if (!isStaff(me.rol) && (!assignedToMe || c.estado !== "activo")) {
    notFound();
  }

  const canSeeFinancials = isStaff(me.rol) || assignedToMe;

  // Historial de cobros normalizado para la card.
  const hoyStr = new Date().toISOString().slice(0, 10);
  const cobroRows: MovimientoRow[] = (
    (invoicesRaw ?? []) as {
      id: string;
      periodo: string;
      concepto: string;
      monto: number;
      moneda: string;
      fecha_vencimiento: string | null;
      fecha_cobro: string | null;
    }[]
  ).map((i) => ({
    id: i.id,
    concepto: i.concepto,
    periodo: i.periodo,
    monto: Number(i.monto),
    moneda: i.moneda,
    estado: i.fecha_cobro
      ? "pagado"
      : i.fecha_vencimiento && i.fecha_vencimiento < hoyStr
      ? "vencido"
      : "pendiente",
    fecha: i.fecha_cobro ?? i.fecha_vencimiento,
  }));

  // ── Acciones de navegación de la ficha (toolbar) ──
  const navBtn =
    "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border bg-card px-3 text-sm font-medium transition hover:bg-muted";
  const actions: { href: string; label: string; icon: typeof Sparkles; show: boolean; blank?: boolean }[] = [
    { href: `/clientes/${c.id}/onboarding`, label: "Onboarding", icon: Sparkles, show: me.rol === "admin" },
    {
      href: `/clientes/${c.id}/onboarding/redes`,
      label: "Onboarding redes",
      icon: Network,
      show: (me.rol === "admin" || me.rol === "coordinador") && svcList.some((s) => s.tipo === "gestion_redes"),
    },
    { href: `/clientes/${c.id}/diagnostico`, label: "Diagnóstico", icon: FileBarChart, show: true },
    { href: `/clientes/${c.id}/plan-mensual`, label: "Plan mensual", icon: CalendarDays, show: true },
    // El servicio de gestión de redes ya incluye el paid media básico en Meta Ads,
    // así que la sección de publicidad se muestra con gestión de redes O paid media.
    // Solo para staff / media buyer (los que gestionan pauta).
    {
      href: `/clientes/${c.id}/pauta`,
      label: "Onboarding publicidad",
      icon: Megaphone,
      show:
        ["admin", "coordinador", "paid_media"].includes(me.rol) &&
        svcList.some((s) => s.tipo === "paid_media" || s.tipo === "gestion_redes"),
    },
    {
      href: `/clientes/${c.id}/pauta/analisis`,
      label: "Análisis de pauta",
      icon: TrendingUp,
      show:
        ["admin", "coordinador", "paid_media"].includes(me.rol) &&
        svcList.some((s) => s.tipo === "paid_media" || s.tipo === "gestion_redes"),
    },
    // Resultados de Instagram (lo que el cliente ve como resultado final). Para
    // todo cliente con gestión de redes; visible a quien pueda abrir la ficha.
    {
      href: `/clientes/${c.id}/resultados`,
      label: "Resultados",
      icon: BarChart3,
      show: svcList.some((s) => s.tipo === "gestion_redes"),
    },
    { href: `/contenidos?cliente=${c.id}`, label: "Calendario", icon: CalendarDays, show: true },
    { href: `/reporte/cliente/${c.id}`, label: "Reporte", icon: FileBarChart, show: true, blank: true },
  ];

  // Links rápidos fijos del cliente.
  const quickLinks: { href: string; label: string; icon: typeof Globe; muted?: boolean }[] = [
    c.calendario_url ? { href: c.calendario_url, label: "Calendario de contenidos", icon: CalendarDays } : null,
    c.drive_url ? { href: c.drive_url, label: "Drive del cliente", icon: FolderOpen } : null,
    c.instagram_url ? { href: c.instagram_url, label: "Instagram", icon: ExternalLink } : null,
    c.web_url ? { href: c.web_url, label: "Web", icon: Globe } : null,
    c.facebook_url ? { href: c.facebook_url, label: "Facebook", icon: ExternalLink } : null,
    c.notion_url ? { href: c.notion_url, label: "Página vieja en Notion", icon: FileText, muted: true } : null,
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe; muted?: boolean }[];

  return (
    <div className="space-y-5">
      <ScrollTopOnMount />
      <Link
        href="/clientes"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver a clientes
      </Link>

      {/* ── Encabezado ── */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{c.nombre}</h1>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  ESTADO_BADGE[c.estado]
                )}
              >
                {CLIENT_STATUS_LABEL[c.estado]}
              </span>
              <HelpTrigger
                slug="clientes-ficha"
                label="¿Cómo funciona la ficha del cliente?"
              />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {c.rubro ?? "Sin rubro"}
              {c.cm ? ` · CM: ${c.cm.nombre}` : ""}
              {c.fecha_inicio ? ` · Cliente desde ${fmtDate(c.fecha_inicio)}` : ""}
            </p>
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              <ClientFormDialog
                mode="edit"
                client={c}
                users={users ?? []}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="mr-2 h-4 w-4" /> Editar
                  </Button>
                }
              />
              {me.rol === "admin" && <DeleteClientButton id={c.id} nombre={c.nombre} />}
            </div>
          )}
        </div>

        {/* Toolbar de acciones — fila que envuelve sin deformarse */}
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {actions
            .filter((a) => a.show)
            .map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  target={a.blank ? "_blank" : undefined}
                  className={navBtn}
                >
                  <Icon className="h-4 w-4" /> {a.label}
                </Link>
              );
            })}
        </div>

        {/* Banner de PROPUESTA: aún no es cliente real (no pagó). */}
        {c.estado === "propuesta" && (
          <div className="mt-4 rounded-lg border border-violet-300 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <div className="font-semibold text-violet-800 dark:text-violet-200">
                  Esto es una propuesta, todavía no es cliente.
                </div>
                <p className="mt-0.5 text-violet-700/80 dark:text-violet-300/80">
                  No cuenta en Finanzas ni en Sueldos. Editá los servicios y el
                  contrato, generá la{" "}
                  <Link
                    href={`/contrato/cliente/${c.id}`}
                    target="_blank"
                    className="font-medium underline underline-offset-2"
                  >
                    carta acuerdo
                  </Link>{" "}
                  y enviásela junto con los datos de transferencia. Cuando te
                  pague, tocá <strong>Activar cliente</strong>.
                </p>
              </div>
              {canEdit && (
                <ClientActivateButton id={c.id} nombre={c.nombre} size="sm" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Layout principal: contenido + columna lateral ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-5 lg:col-span-2">
          {/* Servicios contratados */}
          <Card>
            <CardContent className="pt-6">
              <ClientServicesEditor
                clienteId={c.id}
                services={svcList}
                users={users ?? []}
                canEdit={me.rol === "admin"}
              />
            </CardContent>
          </Card>

          {/* Historial de cobros */}
          {canSeeFinancials && (
            <MovimientosHistorialCard
              title="Historial de cobros"
              rows={cobroRows}
              estadoLabels={{ pagado: "Cobrado", pendiente: "Pendiente", vencido: "Vencido" }}
              emptyText="Todavía no hay cobros registrados para este cliente."
            />
          )}

          {/* Tareas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Tareas activas ({activas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin tareas activas para este cliente.
                </p>
              ) : (
                <TaskList tasks={activas} />
              )}
              {completadas.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Ver completadas ({completadas.length})
                  </summary>
                  <div className="mt-3">
                    <TaskList tasks={completadas} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          {/* Documentos del cliente (IA los usa como contexto) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos del cliente</CardTitle>
              <p className="text-xs text-muted-foreground">
                Subí acá el informe diagnóstico, manual de marca, brief o lo que sea
                específico de este cliente. La IA los va a usar como contexto al
                sugerir ideas de contenido para esta cuenta.
              </p>
            </CardHeader>
            <CardContent>
              <DocumentsManager
                initial={(clientDocs ?? []) as unknown as DocumentRow[]}
                canEdit={isStaff(me.rol)}
                clienteId={c.id}
              />
            </CardContent>
          </Card>

          {/* Links libres + Redes */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="pt-4">
                <ClientListEditor
                  clientId={c.id}
                  field="links_custom"
                  title="Links del cliente"
                  description="Lo que necesites: brief, brand book, calendario, lo que sea."
                  addLabel="Agregar link"
                  initial={
                    ((c as unknown as { links_custom?: Record<string, string>[] })
                      .links_custom ?? []) as Record<string, string>[]
                  }
                  itemFields={[
                    { name: "titulo", label: "Título", placeholder: "Ej: Brief inicial" },
                    { name: "url", label: "URL", type: "url", placeholder: "https://…" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <ClientListEditor
                  clientId={c.id}
                  field="redes_sociales"
                  title="Redes sociales"
                  description="Agregá las que use el cliente."
                  addLabel="Agregar red"
                  initial={
                    ((c as unknown as { redes_sociales?: Record<string, string>[] })
                      .redes_sociales ?? []) as Record<string, string>[]
                  }
                  itemFields={[
                    { name: "red", label: "Red", placeholder: "instagram / tiktok / web / linkedin…" },
                    { name: "url", label: "URL", type: "url", placeholder: "https://…" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {/* Credenciales — solo staff (admin/coordinación) */}
          {isStaff(me.rol) && (
            <Card>
              <CardContent className="pt-4">
                <ClientListEditor
                  clientId={c.id}
                  field="credenciales"
                  title="Credenciales del cliente"
                  description="Accesos que el cliente nos comparte (Meta, Google, plataformas). Solo admin/coordinación ven esto."
                  addLabel="Agregar credencial"
                  initial={
                    ((c as unknown as { credenciales?: Record<string, string>[] })
                      .credenciales ?? []) as Record<string, string>[]
                  }
                  itemFields={[
                    { name: "servicio", label: "Servicio", placeholder: "Ej: Meta Business" },
                    { name: "url", label: "URL (opcional)", type: "url", placeholder: "https://business.facebook.com" },
                    { name: "usuario", label: "Usuario / Email" },
                    { name: "password", label: "Contraseña", type: "password" },
                    { name: "notas", label: "Notas (opcional)" },
                  ]}
                />
              </CardContent>
            </Card>
          )}

          {/* Notas */}
          {c.notas && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown>{c.notas}</Markdown>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna lateral */}
        <div className="space-y-4">
          {/* Portal del cliente (link público) */}
          <ClientPortalLink
            clienteId={c.id}
            initialToken={(portalToken as { token?: string } | null)?.token ?? null}
            initialLastSeen={(portalToken as { last_seen_at?: string | null } | null)?.last_seen_at ?? null}
          />

          {/* Estado del cliente */}
          {c.estado === "propuesta" ? (
            <div className="rounded-lg border border-violet-300 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
              <div className="mb-2 text-xs text-violet-700 dark:text-violet-300">
                Estado: <b>Propuesta</b> · activala cuando pague
              </div>
              {canEdit && (
                <ClientActivateButton id={c.id} nombre={c.nombre} size="sm" />
              )}
            </div>
          ) : (
            <ClientStatusToggle
              id={c.id}
              currentStatus={c.estado}
              fechaActivado={c.fecha_activado ?? null}
              fechaInactivado={c.fecha_inactivado ?? null}
            />
          )}

          {/* Links rápidos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {quickLinks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin links cargados.</p>
              ) : (
                quickLinks.map((l) => {
                  const Icon = l.icon;
                  return (
                    <a
                      key={l.label}
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted",
                        l.muted && "text-xs text-muted-foreground"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 text-primary", l.muted && "h-3.5 w-3.5")} />
                      <span className="truncate">{l.label}</span>
                    </a>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Equipo asignado */}
          {(c.cm || c.disenador || c.audiovisual) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Equipo asignado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {c.cm && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Community Manager</span>
                    <span className="font-medium">{c.cm.nombre}</span>
                  </div>
                )}
                {c.disenador && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Diseñador/a</span>
                    <span className="font-medium">{c.disenador.nombre}</span>
                  </div>
                )}
                {c.audiovisual && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Editor/a audiovisual</span>
                    <span className="font-medium">{c.audiovisual.nombre}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contacto */}
          {canSeeFinancials &&
            (c.contacto_nombre || c.contacto_email || c.contacto_telefono) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {c.contacto_nombre && (
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      {c.contacto_nombre}
                    </div>
                  )}
                  {c.contacto_email && (
                    <a
                      href={`mailto:${c.contacto_email}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {c.contacto_email}
                    </a>
                  )}
                  {c.contacto_telefono && (
                    <a
                      href={`tel:${c.contacto_telefono}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {c.contacto_telefono}
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

          {/* Datos para facturar */}
          {canSeeFinancials && c.datos_facturacion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos para facturar</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="whitespace-pre-line">{c.datos_facturacion}</p>
              </CardContent>
            </Card>
          )}

          {/* Próximas reuniones */}
          <ClientMeetingsCard events={clientEvents} />
        </div>
      </div>
    </div>
  );
}
