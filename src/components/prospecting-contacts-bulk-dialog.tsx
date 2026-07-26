"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ClipboardPaste } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addContactsBulk, type BulkContact } from "@/app/(app)/prospeccion/actions";

/**
 * Parseo tolerante de filas pegadas desde Google Maps / Excel / Sheets.
 * - Una fila por línea; columnas separadas por TAB, ; o coma.
 * - El campo que parece teléfono (8+ dígitos) va a Teléfono, sin importar el orden.
 * - El primer campo que no es teléfono = Empresa; los siguientes = Contacto, Rol.
 * - Saltea una fila de encabezados si la detecta.
 */
function parsePastedRows(text: string): BulkContact[] {
  const out: BulkContact[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line
      .split(/\t|;|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;

    // Encabezado típico: saltearlo.
    if (i === 0 && /^(empresa|nombre|negocio|company|name)$/i.test(parts[0])) continue;

    let telefono: string | null = null;
    let instagram: string | null = null;
    const resto: string[] = [];
    for (const p of parts) {
      const digits = p.replace(/\D/g, "");
      const looksPhone =
        !telefono && digits.length >= 8 && digits.length <= 15 && /[\d+][\d\s()+-]{6,}/.test(p);
      const looksIg = !instagram && (p.startsWith("@") || /instagram\.com\//i.test(p));
      if (looksPhone) telefono = p;
      else if (looksIg) instagram = p;
      else resto.push(p);
    }
    const empresa = resto[0];
    if (!empresa) continue;
    out.push({
      empresa,
      contacto_nombre: resto[1] ?? null,
      contacto_rol: resto[2] ?? null,
      telefono,
      instagram,
    });
  }
  return out;
}

export function ProspectingContactsBulkDialog({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const preview = parsePastedRows(text);

  function submit() {
    if (preview.length === 0)
      return void toast.error("No detecté filas. Pegá una empresa por línea.");
    start(async () => {
      const res = await addContactsBulk(campaignId, preview);
      if ("error" in res) return void toast.error(res.error);
      const dup = res.skipped ? ` (${res.skipped} ya estaban)` : "";
      toast.success(`Se importaron ${res.created} contactos${dup}.`);
      setText("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardPaste className="mr-2 h-4 w-4" /> Pegar desde Excel/Maps
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contactos pegando (sin gastar IA)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Pegá <b>una empresa por línea</b>. Si separás las columnas con TAB o coma,
          las ordena en <b>Empresa · Contacto · Rol · Teléfono</b>. El teléfono lo
          detecta solo esté donde esté. Ideal para copiar desde una planilla o
          Google Maps.
        </p>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Gimnasio Olimpo\tJuan Pérez\tDueño\t+54 351 1234567\nEstética Bella\t\t\t+54 351 7654321\nPanadería La Espiga"}
          className="font-mono text-xs"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {preview.length > 0
              ? `${preview.length} filas detectadas`
              : "Pegá filas para ver la previsualización"}
          </span>
          {preview.length > 0 && (
            <span>
              con teléfono: {preview.filter((p) => p.telefono).length}
            </span>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || preview.length === 0}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Importar {preview.length > 0 ? `${preview.length}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
