import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileBarChart,
  FileText,
  FolderOpen,
  Globe,
  Mail,
  Phone,
  Pencil,
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
import { TaskList } from "@/components/task-list";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { DeleteClientButton } from "@/components/delete-client-button";
import { ClientServicesEditor } from "@/components/client-services-editor";
import { ApprovalLink } from "@/components/approval-link";
import { ClientStatusToggle } from "@/components/client-status-toggle";
import { ClientListEditor } from "@/components/client-list-editor";
import { DocumentsManager, type DocumentRow } from "@/components/documents-manager";
import { ClientMeetingsCard } from "@/components/client-meetings-card";
import type { ClientService } from "@/lib/types";

export const dynamic = "force-dynamic";

const ESTADO_BADGE: Record<string, string> = {
  activo:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  at_risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

interface ClientWithCreativa extends Client {
  creativa: { id: string; nombre: string } | null;
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
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*, creativa:users!clients_creativa_asignada_id_fkey(id,nombre), cm:users!clients_cm_id_fkey(id,nombre), disenador:users!clients_disenador_id_fkey(id,nombre), audiovisual:users!clients_audiovisual_id_fkey(id,nombre)")
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
  const c = client as ClientWithCreativa;
  const allTasks = (tasks ?? []) as TaskWithRels[];
  const activas = allTasks.filter((t) => t.estado !== "completada");
  const completadas = allTasks.filter((t) => t.estado === "completada");
  const canEdit = isStaff(me.rol) || c.creativa_asignada_id === me.id;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/clientes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a clientes
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/clientes/${c.id}/calendario`}
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <CalendarDays className="mr-2 h-4 w-4" /> Calendario de contenidos
          </Link>
          <Link
            href={`/reporte/cliente/${c.id}`}
            target="_blank"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <FileBarChart className="mr-2 h-4 w-4" /> Reporte mensual
          </Link>
          {canEdit && (
          <>
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
            {isStaff(me.rol) && (
              <DeleteClientButton id={c.id} nombre={c.nombre} />
            )}
          </>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{c.nombre}</h1>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  ESTADO_BADGE[c.estado]
                )}
              >
                {CLIENT_STATUS_LABEL[c.estado]}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {c.rubro ?? "Sin rubro"}
              {c.creativa ? ` · Responsable: ${c.creativa.nombre}` : ""}
            </p>
          </div>
          {c.fecha_inicio && (
            <div className="text-right text-xs text-muted-foreground">
              Cliente desde {fmtDate(c.fecha_inicio)}
            </div>
          )}
        </div>

      </div>

      {/* Estado del cliente */}
      <ClientStatusToggle
        id={c.id}
        currentStatus={c.estado}
        fechaActivado={c.fecha_activado ?? null}
        fechaInactivado={c.fecha_inactivado ?? null}
      />

      {/* Servicios contratados */}
      <Card>
        <CardContent className="pt-6">
          <ClientServicesEditor clienteId={c.id} services={(services ?? []) as ClientService[]} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
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

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {c.calendario_url ? (
                <a
                  href={c.calendario_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted"
                >
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="truncate">Calendario de contenidos</span>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sin calendario cargado.
                </p>
              )}
              {c.drive_url && (
                <a
                  href={c.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted"
                >
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="truncate">Drive del cliente</span>
                </a>
              )}
              {c.instagram_url && (
                <a
                  href={c.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="truncate">Instagram</span>
                </a>
              )}
              {c.web_url && (
                <a
                  href={c.web_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted"
                >
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="truncate">Web</span>
                </a>
              )}
              {c.facebook_url && (
                <a
                  href={c.facebook_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4 text-primary" />
                  <span className="truncate">Facebook</span>
                </a>
              )}
              {c.notion_url && (
                <a
                  href={c.notion_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground hover:bg-muted"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="truncate">Página vieja en Notion</span>
                </a>
              )}
            </CardContent>
          </Card>

          {(c as unknown as { approval_token?: string }).approval_token && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Portal de aprobación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ApprovalLink
                  token={(c as unknown as { approval_token: string }).approval_token}
                />
              </CardContent>
            </Card>
          )}

          {c.datos_facturacion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos para facturar</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="whitespace-pre-line">{c.datos_facturacion}</p>
              </CardContent>
            </Card>
          )}

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

          <ClientMeetingsCard events={clientEvents} />

          {(c.contacto_nombre || c.contacto_email || c.contacto_telefono) && (
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
        </div>
      </div>

      {/* Documentos del cliente (IA los usa como contexto) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Documentos del cliente
          </CardTitle>
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

      {/* Links libres + Redes + Credenciales */}
      <div className="grid gap-4 md:grid-cols-2">
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

        <Card className="md:col-span-2">
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
      </div>

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
  );
}
