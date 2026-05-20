import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_BADGE,
  STATUS_LABEL,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
} from "@/lib/constants";
import { fmtDate, dueState } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Comment, TaskLink, TaskWithRels } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { TaskStatusSelect } from "@/components/task-status-select";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { TaskLinks } from "@/components/task-links";
import { TaskComments } from "@/components/task-comments";
import { Pencil } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaskDetail({
  params,
}: {
  params: { id: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  const [{ data: task }, { data: comments }, { data: users }, { data: clients }] =
    await Promise.all([
      supabase
        .from("tasks")
        .select(
          "*, cliente:clients(id,nombre), asignado:users!tasks_asignado_a_id_fkey(id,nombre,avatar_url), creador:users!tasks_creado_por_id_fkey(id,nombre)"
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("comments")
        .select("*, autor:users(id,nombre,avatar_url)")
        .eq("task_id", params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("users")
        .select("id,nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase.from("clients").select("id,nombre").order("nombre"),
    ]);

  if (!task) notFound();
  const t = task as TaskWithRels;
  const due = dueState(t.fecha_limite, t.estado);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/tareas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a tareas
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t.titulo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                STATUS_BADGE[t.estado]
              )}
            >
              {STATUS_LABEL[t.estado]}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                PRIORITY_BADGE[t.prioridad]
              )}
            >
              {PRIORITY_LABEL[t.prioridad]}
            </span>
            <span className="text-muted-foreground">{t.area}</span>
            {t.cliente && (
              <span className="text-muted-foreground">
                · {t.cliente.nombre}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TaskStatusSelect
            id={t.id}
            estado={t.estado}
            className="h-9 w-40"
          />
          <TaskFormDialog
            mode="edit"
            task={t}
            users={users ?? []}
            clients={clients ?? []}
            trigger={
              <Button variant="ghost" size="icon" title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteTaskButton id={t.id} redirectTo="/tareas" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Info label="Asignada a" value={t.asignado?.nombre ?? "Sin asignar"} />
        <Info label="Creada por" value={t.creador?.nombre ?? "—"} />
        <Info
          label="Fecha límite"
          value={t.fecha_limite ? fmtDate(t.fecha_limite) : "Sin fecha"}
          highlight={
            due === "vencida"
              ? "text-red-600"
              : due === "hoy"
                ? "text-orange-600"
                : undefined
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          {t.descripcion ? (
            <Markdown>{t.descripcion}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Sin descripción.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Links</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskLinks
            taskId={t.id}
            links={(t.links ?? []) as TaskLink[]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Comentarios ({comments?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaskComments
            taskId={t.id}
            comments={(comments ?? []) as Comment[]}
            users={users ?? []}
            currentUserId={me.id}
            isStaff={isStaff(me.rol)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Info({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-medium", highlight)}>
        {value}
      </div>
    </div>
  );
}
