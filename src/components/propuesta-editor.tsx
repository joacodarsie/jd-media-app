"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Download, Loader2, Plus, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { guardarTextoPropuesta } from "@/app/(app)/prospeccion/propuestas/actions";

export interface TextoPropuesta {
  titular: string;
  diagnostico: string;
  puntos: string[];
  ideas: string[];
}

/**
 * Barra que ve SOLO alguien del equipo con sesión abierta: el prospecto que
 * recibe el link no la ve ni sabe que existe.
 *
 * Está en la propia propuesta y no en el panel porque el momento en que uno
 * quiere corregir algo es justo cuando la está mirando antes de mandarla.
 */
export function BarraPropuesta({
  propuestaId,
  texto,
  personalizada,
}: {
  propuestaId: string;
  texto: TextoPropuesta;
  personalizada: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <div className="no-print sticky top-3 z-20 mx-auto mb-6 flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-black/80 p-1.5 pl-4 text-sm backdrop-blur">
        <span className="text-xs text-white/50">Solo vos ves esto</span>
        <button
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD400] px-3 py-1.5 text-xs font-bold text-black transition-opacity hover:opacity-90"
        >
          <Download className="h-3.5 w-3.5" /> Descargar PDF
        </button>
      </div>

      <EditorDialog
        abierto={abierto}
        onClose={() => setAbierto(false)}
        propuestaId={propuestaId}
        texto={texto}
        personalizada={personalizada}
      />
    </>
  );
}

function EditorDialog({
  abierto,
  onClose,
  propuestaId,
  texto,
  personalizada,
}: {
  abierto: boolean;
  onClose: () => void;
  propuestaId: string;
  texto: TextoPropuesta;
  personalizada: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [titular, setTitular] = useState(texto.titular);
  const [diagnostico, setDiagnostico] = useState(texto.diagnostico);
  const [puntos, setPuntos] = useState<string[]>(texto.puntos.length ? texto.puntos : []);
  const [ideas, setIdeas] = useState<string[]>(texto.ideas);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const r = await guardarTextoPropuesta(propuestaId, { titular, diagnostico, puntos, ideas });
    setGuardando(false);
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    toast.success("Guardado. Ya podés descargar el PDF.");
    onClose();
    startTransition(() => router.refresh());
  }

  async function volverAlRubro() {
    if (!confirm("¿Volver al texto general del rubro? Se pierde lo editado.")) return;
    setGuardando(true);
    const r = await guardarTextoPropuesta(propuestaId, {});
    setGuardando(false);
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    toast.success("Volvió al texto del rubro.");
    onClose();
    startTransition(() => router.refresh());
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar la propuesta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lo que dejes vacío vuelve al texto general del rubro. Los precios y los
            servicios no se editan acá: salen de la web.
          </p>

          <Campo label="Titular" ayuda="La frase grande de la portada.">
            <Input value={titular} onChange={(e) => setTitular(e.target.value)} />
          </Campo>

          <Campo label="Diagnóstico" ayuda="El párrafo de arriba de todo, después del titular.">
            <Textarea
              rows={4}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
            />
          </Campo>

          <Lista
            label="Cómo lo resolvemos en su caso"
            ayuda="El recuadro amarillo. Si está vacío, no aparece."
            items={puntos}
            onChange={setPuntos}
            placeholder="Ej: Campañas geolocalizadas a los países que más te reservan"
          />

          <Lista
            label="Ideas del primer mes"
            ayuda="Las ideas de contenido numeradas."
            items={ideas}
            onChange={setIdeas}
            placeholder="Ej: Recorrido en video de cada tipo de habitación"
          />

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            {personalizada ? (
              <button
                onClick={volverAlRubro}
                disabled={guardando}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Volver al texto del rubro
              </button>
            ) : (
              <span />
            )}
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  label,
  ayuda,
  children,
}: {
  label: string;
  ayuda: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <p className="mb-1.5 text-xs text-muted-foreground">{ayuda}</p>
      {children}
    </div>
  );
}

/** Lista de textos con agregar/quitar y orden, sin dependencias. */
function Lista({
  label,
  ayuda,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  ayuda: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <p className="mb-1.5 text-xs text-muted-foreground">{ayuda}</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Textarea
              rows={2}
              value={it}
              placeholder={placeholder}
              onChange={(e) => {
                const copia = [...items];
                copia[i] = e.target.value;
                onChange(copia);
              }}
              className="min-h-0"
            />
            <button
              onClick={() => onChange(items.filter((_, x) => x !== i))}
              title="Quitar"
              className="mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      {items.length < 8 && (
        <button
          onClick={() => onChange([...items, ""])}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar
        </button>
      )}
    </div>
  );
}
