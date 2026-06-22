"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Carga de CVs en lote (PDFs) para una búsqueda. Sube los archivos a la ruta de
 * análisis, que extrae el texto + analiza con IA. Procesa de a tandas para no
 * pasarse del tiempo de respuesta.
 */
const BATCH = 6;

export function RecruitmentUploader({ searchId }: { searchId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    let ok = 0;
    let skipped = 0;
    const errs: string[] = [];

    try {
      for (let i = 0; i < files.length; i += BATCH) {
        const slice = files.slice(i, i + BATCH);
        const fd = new FormData();
        slice.forEach((f) => fd.append("files", f));
        const res = await fetch(`/api/reclutamiento/${searchId}/upload`, {
          method: "POST",
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          errs.push(json.error ?? `Error ${res.status}`);
        } else {
          ok += json.ok ?? 0;
          skipped += json.skipped ?? 0;
          if (Array.isArray(json.errors)) errs.push(...json.errors);
        }
        setProgress({ done: Math.min(i + BATCH, files.length), total: files.length });
      }

      if (ok > 0) toast.success(`${ok} CV${ok === 1 ? "" : "s"} analizado${ok === 1 ? "" : "s"}.`);
      if (skipped > 0) toast.message(`${skipped} ya estaban cargados (saltados).`);
      if (errs.length > 0) {
        toast.error(`${errs.length} con problemas. Ej: ${errs[0]}`);
        console.warn("Reclutamiento upload errors:", errs);
      }
      router.refresh();
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={busy} className="gap-1.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy && progress
          ? `Analizando ${progress.done}/${progress.total}…`
          : "Cargar CVs (PDF)"}
      </Button>
    </div>
  );
}
