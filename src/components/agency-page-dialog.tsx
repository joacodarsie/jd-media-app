"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertAgencyPage } from "@/app/(app)/agencia/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgencyPageInit {
  slug: string;
  title: string;
  kind: string;
  orden: number;
  content: string;
  notion_url: string | null;
}

const KIND_LABEL: Record<string, string> = {
  fundamentos: "Fundamentos",
  buyer_persona: "Buyer persona",
  proceso: "Proceso / SOP",
  plantilla: "Plantilla",
  otro: "Otro",
};

export function AgencyPageDialog({
  mode,
  page,
  defaultKind,
  trigger,
}: {
  mode: "create" | "edit";
  page?: AgencyPageInit;
  defaultKind?: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const original = page?.slug;

  const [slug, setSlug] = useState(page?.slug ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [kind, setKind] = useState<string>(page?.kind ?? defaultKind ?? "proceso");
  const [orden, setOrden] = useState<number>(page?.orden ?? 0);
  const [content, setContent] = useState(page?.content ?? "");
  const [notionUrl, setNotionUrl] = useState(page?.notion_url ?? "");

  function submit() {
    if (!title.trim()) {
      toast.error("Falta título.");
      return;
    }
    const finalSlug =
      (slug || title)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    start(async () => {
      const res = await upsertAgencyPage(
        {
          slug: finalSlug,
          title,
          kind,
          orden,
          content,
          notion_url: notionUrl,
        },
        original
      );
      if (res?.error) {
        toast.error("No se pudo guardar: " + res.error);
        return;
      }
      toast.success("Guardado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nueva página" : "Editar página"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Se autogenera del título"
              />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                type="number"
                value={orden}
                onChange={(e) => setOrden(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Link Notion (opcional)</Label>
              <Input
                value={notionUrl}
                onChange={(e) => setNotionUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contenido (Markdown)</Label>
            <Textarea
              rows={18}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"# Título\n\nContenido…"}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
