"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  File as FileIcon,
  Image as ImageIcon,
  FileText,
  Download,
  Trash2,
  Search,
  Loader2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentSignedUrl,
  type DocumentCategory,
} from "@/app/(app)/documentos/actions";

export const DOC_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "onboarding", label: "Onboarding" },
  { value: "manual_marca", label: "Manual de marca" },
  { value: "procesos", label: "Procesos / SOPs" },
  { value: "contratos", label: "Contratos" },
  { value: "plantillas", label: "Plantillas" },
  { value: "propuesta", label: "Propuestas" },
  { value: "otros", label: "Otros" },
];

export interface DocumentRow {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: DocumentCategory;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  subido_por: { id: string; nombre: string } | null;
}

const MAX_MB = 50;

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(mime: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileText;
  return FileIcon;
}

export function DocumentsManager({
  initial,
  canEdit,
}: {
  initial: DocumentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  // Usamos `initial` directo — Next nos re-renderiza con datos nuevos en cada router.refresh().
  // (Si pusiéramos useState, congelaríamos el array y no veríamos los cambios.)
  const docs = initial;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<DocumentCategory | "all">("all");
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Trackeo cuántos elementos están en "drag enter" para no parpadear cuando
  // el cursor cruza un hijo. Cuando vuelve a 0 → ocultamos overlay.
  const dragCountRef = useRef(0);

  function onDragEnter(e: React.DragEvent) {
    if (!canEdit) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCountRef.current += 1;
    setDragOver(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (!canEdit) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e: React.DragEvent) {
    if (!canEdit) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCountRef.current = Math.max(0, dragCountRef.current - 1);
    if (dragCountRef.current === 0) setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    dragCountRef.current = 0;
    setDragOver(false);
    if (!canEdit) return;
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo no puede pesar más de ${MAX_MB}MB.`);
      return;
    }
    setPendingFile(f);
    setUploadOpen(true);
  }

  // Salvavidas: si el drag termina en cualquier parte (incluso fuera de la ventana),
  // limpiamos el overlay. Evita el "overlay pegado".
  useEffect(() => {
    function clear() {
      dragCountRef.current = 0;
      setDragOver(false);
    }
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    window.addEventListener("mouseup", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
      window.removeEventListener("mouseup", clear);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (cat !== "all" && d.categoria !== cat) return false;
      if (term) {
        const hay = `${d.titulo} ${d.descripcion ?? ""} ${d.file_name}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [docs, q, cat]);

  return (
    <div
      className="relative space-y-4"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-dashed border-primary bg-card px-8 py-6 text-center shadow-xl">
            <Upload className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-semibold">Soltá el archivo para subirlo</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar título o nombre…"
            className="h-9 w-72 pl-8"
          />
        </div>
        <Select value={cat} onValueChange={(v) => setCat(v as DocumentCategory | "all")}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {DOC_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <UploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            initialFile={pendingFile}
            clearInitial={() => setPendingFile(null)}
            onDone={() => router.refresh()}
          />
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} doc(s)
        </div>
      </div>

      {canEdit && docs.length === 0 && (
        <div className="rounded-md border-2 border-dashed bg-muted/20 p-8 text-center">
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">
            Arrastrá un archivo acá para subirlo
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            o usá el botón <b>Subir documento</b> arriba
          </p>
        </div>
      )}

      {filtered.length === 0 && docs.length > 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Sin resultados con esos filtros.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DocCard key={d.id} doc={d} canEdit={canEdit} />
          ))}
        </div>
      )}

      {canEdit && docs.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          💡 Arrastrá un archivo a cualquier parte de esta pantalla para subir.
        </p>
      )}
    </div>
  );
}

function DocCard({ doc, canEdit }: { doc: DocumentRow; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const Icon = iconFor(doc.mime_type);
  const catLabel = DOC_CATEGORIES.find((c) => c.value === doc.categoria)?.label ?? doc.categoria;
  const isImage = doc.mime_type?.startsWith("image/");
  const isPdf = doc.mime_type === "application/pdf";
  const previewable = isImage || isPdf;

  function open() {
    start(async () => {
      const res = await getDocumentSignedUrl(doc.id);
      if (res.error || !res.url) {
        toast.error(res.error ?? "Error");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("¿Eliminar este documento?")) return;
    start(async () => {
      const res = await deleteDocument(doc.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Eliminado");
      router.refresh();
    });
  }

  return (
    <div
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      title={previewable ? "Click para abrir en pestaña nueva" : "Click para descargar"}
      className="group cursor-pointer rounded-lg border bg-card p-3 transition-all hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{doc.titulo}</h3>
          <p className="truncate text-[10px] text-muted-foreground">
            {doc.file_name} · {fmtSize(doc.file_size)}
          </p>
          {doc.descripcion && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.descripcion}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {catLabel}
        </span>
        <div
          className="flex items-center gap-1 opacity-60 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={open}
            disabled={pending}
            title={previewable ? "Abrir" : "Descargar"}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
          {canEdit && (
            <>
              <EditDialog doc={doc} />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-red-600 hover:text-red-700"
                onClick={remove}
                disabled={pending}
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadDialog({
  open: openProp,
  onOpenChange,
  onDone,
  initialFile,
  clearInitial,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  onDone: () => void;
  initialFile?: File | null;
  clearInitial?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
    if (!v) clearInitial?.();
  };
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<DocumentCategory>("otros");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Si llega un archivo arrastrado, lo precargamos y sugerimos título.
  useMemo(() => {
    if (initialFile && initialFile !== file) {
      setFile(initialFile);
      if (!titulo) {
        // sugerir título a partir del nombre del archivo sin extensión
        const base = initialFile.name.replace(/\.[^.]+$/, "");
        setTitulo(base);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  function reset() {
    setTitulo("");
    setDescripcion("");
    setCategoria("otros");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    clearInitial?.();
  }

  async function submit() {
    if (!file) {
      toast.error("Elegí un archivo.");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Ponele un título.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo no puede pesar más de ${MAX_MB}MB.`);
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${categoria}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) {
        toast.error("Error subiendo: " + upErr.message);
        setUploading(false);
        return;
      }
      const res = await createDocument({
        titulo,
        descripcion: descripcion || null,
        categoria,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Subido");
      reset();
      setOpen(false);
      onDone();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Upload className="h-4 w-4" />
          Subir documento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Archivo</Label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-md border bg-background p-2 text-sm"
            />
            {file && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {file.name} · {fmtSize(file.size)}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Onboarding cliente v3"
              className="h-9"
            />
          </div>
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as DocumentCategory)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Descripción (opcional)</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="h-9"
            />
          </div>
          <Button onClick={submit} disabled={uploading} className="w-full gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Subir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ doc }: { doc: DocumentRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState(doc.titulo);
  const [descripcion, setDescripcion] = useState(doc.descripcion ?? "");
  const [categoria, setCategoria] = useState<DocumentCategory>(doc.categoria);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await updateDocument(doc.id, { titulo, descripcion, categoria });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Guardado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as DocumentCategory)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="h-9"
            />
          </div>
          <Button onClick={save} disabled={pending} className="w-full">
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
