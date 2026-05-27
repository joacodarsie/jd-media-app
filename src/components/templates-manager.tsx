"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  Edit,
  Eye,
  FileText,
  Globe,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABEL,
  type TemplateCategory,
} from "@/app/(app)/templates/actions";
import { EmptyState } from "@/components/empty-state";

export interface TemplateRow {
  id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  tags: string[];
  scope: "propio" | "global";
  creado_por_id: string | null;
  creador_nombre?: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

const ALL = "__all__";

export function TemplatesManager({
  initial,
  currentUserId,
  isAdmin,
}: {
  initial: TemplateRow[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState(ALL);
  const [scope, setScope] = useState(ALL);

  // Defensiva: si initial llega no-array (caso raro), tratamos como vacio.
  const safeInitial: TemplateRow[] = Array.isArray(initial) ? initial : [];

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return safeInitial.filter((t) => {
      if (categoria !== ALL && t.categoria !== categoria) return false;
      if (scope !== ALL && t.scope !== scope) return false;
      const tags = Array.isArray(t.tags) ? t.tags : [];
      if (
        qq &&
        !t.titulo.toLowerCase().includes(qq) &&
        !t.contenido.toLowerCase().includes(qq) &&
        !tags.some((tag) => tag.toLowerCase().includes(qq))
      )
        return false;
      return true;
    });
  }, [safeInitial, q, categoria, scope]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, contenido o tag…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las categorías</SelectItem>
            {TEMPLATE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {TEMPLATE_CATEGORY_LABEL[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Alcance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value="propio">Solo míos</SelectItem>
            <SelectItem value="global">Globales</SelectItem>
          </SelectContent>
        </Select>
        <TemplateFormDialog
          mode="create"
          isAdmin={isAdmin}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          }
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={
            safeInitial.length === 0 ? "Sin templates" : "Sin coincidencias"
          }
          description={
            safeInitial.length === 0
              ? "Creá tu primer template para reutilizarlo en chat, comercial o copy."
              : "Probá con otros filtros o palabras."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template: t,
  currentUserId,
  isAdmin,
}: {
  template: TemplateRow;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const canEdit = t.creado_por_id === currentUserId || isAdmin;
  const [pending, start] = useTransition();
  const router = useRouter();

  function copy() {
    navigator.clipboard.writeText(t.contenido).then(
      () => toast.success("Copiado al portapapeles"),
      () => toast.error("No se pudo copiar")
    );
  }
  function onDelete() {
    if (!confirm(`¿Eliminar "${t.titulo}"?`)) return;
    start(async () => {
      const res = await deleteTemplate(t.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Eliminado");
        router.refresh();
      }
    });
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug">{t.titulo}</h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              t.scope === "global"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
            title={t.scope === "global" ? "Visible para toda la agencia" : "Solo lo ves vos"}
          >
            {t.scope === "global" ? (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-2.5 w-2.5" /> Global
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-2.5 w-2.5" /> Propio
              </span>
            )}
          </span>
        </div>
        <p className="line-clamp-4 whitespace-pre-wrap text-xs text-foreground/80">
          {t.contenido}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[10px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">
            {TEMPLATE_CATEGORY_LABEL[t.categoria as TemplateCategory] ?? t.categoria}
          </span>
          {(Array.isArray(t.tags) ? t.tags : []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded bg-muted px-1.5 py-0.5 font-mono"
            >
              #{tag}
            </span>
          ))}
          {t.use_count > 0 && (
            <span title="Veces usado">· usado {t.use_count}×</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 border-t pt-2">
          <span className="truncate text-[10px] text-muted-foreground">
            {t.creador_nombre ? `Por ${t.creador_nombre}` : "—"}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              onClick={copy}
              title="Copiar contenido"
              className="h-7 w-7"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {canEdit && (
              <>
                <TemplateFormDialog
                  mode="edit"
                  isAdmin={isAdmin}
                  template={t}
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Editar"
                      className="h-7 w-7"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDelete}
                  disabled={pending}
                  title="Eliminar"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateFormDialog({
  mode,
  template,
  trigger,
}: {
  mode: "create" | "edit";
  template?: TemplateRow;
  isAdmin: boolean;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState(template?.titulo ?? "");
  const [contenido, setContenido] = useState(template?.contenido ?? "");
  const [categoria, setCategoria] = useState<TemplateCategory>(
    (template?.categoria as TemplateCategory) ?? "otro"
  );
  const [scope, setScope] = useState<"propio" | "global">(
    template?.scope ?? "propio"
  );
  const [tagsRaw, setTagsRaw] = useState(
    Array.isArray(template?.tags) ? template!.tags.join(", ") : ""
  );
  const [pending, start] = useTransition();

  function save() {
    const tags = tagsRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    start(async () => {
      const input = {
        titulo,
        contenido,
        categoria,
        scope,
        tags,
      };
      const res =
        mode === "edit" && template
          ? await updateTemplate(template.id, input)
          : await createTemplate(input);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "edit" ? "Actualizado" : "Template creado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar template" : "Nuevo template"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Saludo inicial cliente nuevo"
              maxLength={80}
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Contenido</Label>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={6}
              placeholder="El texto que se va a insertar al usar este template…"
              className="min-h-[140px] w-full resize-y rounded-md border bg-card p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Tip: usá <code>[NOMBRE]</code>, <code>[CLIENTE]</code>, etc. como
              placeholders. Editá después de pegar.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Categoría</Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as TemplateCategory)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {TEMPLATE_CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Alcance</Label>
              <Select
                value={scope}
                onValueChange={(v) =>
                  setScope(v as "propio" | "global")
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="propio">
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="h-3 w-3" /> Propio (solo vos)
                    </span>
                  </SelectItem>
                  <SelectItem value="global">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> Global (toda la agencia)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Tags (separados por coma)</Label>
            <Input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="ej: follow-up, primera-meet, gestion-redes"
              className="h-9"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending || !titulo || !contenido}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
