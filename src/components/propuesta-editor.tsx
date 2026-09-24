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
import { guardarTextoPropuesta, ajustarPropuesta } from "@/app/(app)/prospeccion/propuestas/actions";
import { SECCIONES_OCULTABLES } from "@/lib/propuestas/build";
import { EXTRAS } from "@/lib/propuestas/extras";

export interface TextoPropuesta {
  titular: string;
  diagnostico: string;
  puntos: string[];
  ideas: string[];
  /** "Cómo te podemos ayudar" (propuesta en frío). */
  valor: string;
  frio: boolean;
  ocultas: string[];
}

interface Ajustes {
  packs: { slug: string; nombre: string }[];
  packActual: string;
  variasCuentas: boolean;
  extras: { slug: string; precio: number }[];
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
  ...ajustes
}: {
  propuestaId: string;
  texto: TextoPropuesta;
  personalizada: boolean;
} & Ajustes) {
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
        ajustes={ajustes}
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
  ajustes,
}: {
  abierto: boolean;
  onClose: () => void;
  propuestaId: string;
  texto: TextoPropuesta;
  personalizada: boolean;
  ajustes: Ajustes;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [titular, setTitular] = useState(texto.titular);
  const [diagnostico, setDiagnostico] = useState(texto.diagnostico);
  const [puntos, setPuntos] = useState<string[]>(texto.puntos.length ? texto.puntos : []);
  const [ideas, setIdeas] = useState<string[]>(texto.ideas);
  const [valor, setValor] = useState(texto.valor);
  const [ocultas, setOcultas] = useState<string[]>(texto.ocultas);
  const [pack, setPack] = useState(ajustes.packActual);
  // Extras: slug → precio (texto del input).
  const [extras, setExtras] = useState<Record<string, string>>(
    Object.fromEntries(ajustes.extras.map((x) => [x.slug, String(x.precio)]))
  );
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const r = await guardarTextoPropuesta(propuestaId, {
      titular,
      diagnostico,
      puntos,
      ideas,
      valor,
      frio: texto.frio,
      ocultas,
    });
    const r2 = await ajustarPropuesta(propuestaId, {
      packSlug: ajustes.variasCuentas ? null : pack,
      extras: Object.entries(extras).map(([slug, precio]) => ({ slug, precio: Number(precio) || 0 })),
    });
    setGuardando(false);
    const err = ("error" in r && r.error) || ("error" in r2 && r2.error);
    if (err) {
      toast.error(err);
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
            Lo que dejes vacío vuelve al texto general del rubro. Los precios de los packs
            salen de la web.
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

          {(texto.frio || valor) && (
            <Campo
              label="Cómo te podemos ayudar"
              ayuda="Solo en las propuestas en frío (sin reunión): el recuadro de la primera hoja."
            >
              <Textarea rows={3} value={valor} onChange={(e) => setValor(e.target.value)} />
            </Campo>
          )}

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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Pack</label>
              <p className="mb-1.5 text-xs text-muted-foreground">
                {ajustes.variasCuentas
                  ? "Con varias cuentas, el pack de cada una se cambia desde Propuestas."
                  : "El que se recomienda y se cotiza."}
              </p>
              <select
                value={pack}
                onChange={(e) => setPack(e.target.value)}
                disabled={ajustes.variasCuentas}
                className="w-full rounded-md border bg-background px-2 py-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
              >
                {ajustes.packs.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Secciones</label>
              <p className="mb-1.5 text-xs text-muted-foreground">Destildá las que no quieras mostrar.</p>
              <div className="space-y-1">
                {SECCIONES_OCULTABLES.map((sec) => (
                  <label key={sec.key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!ocultas.includes(sec.key)}
                      onChange={(e) =>
                        setOcultas((prev) =>
                          e.target.checked ? prev.filter((x) => x !== sec.key) : [...prev, sec.key]
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    {sec.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Extras para ofrecer</label>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Aparecen como opcionales, con el total con y sin ellos.
            </p>
            <div className="space-y-1.5">
              {EXTRAS.map((x) => {
                const on = x.slug in extras;
                return (
                  <div key={x.slug} className="flex items-center gap-2">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setExtras((prev) => {
                            const n = { ...prev };
                            if (e.target.checked) n[x.slug] = String(x.precioSugerido);
                            else delete n[x.slug];
                            return n;
                          })
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      {x.nombre}
                    </label>
                    {on && (
                      <Input
                        value={extras[x.slug]}
                        onChange={(e) =>
                          setExtras((prev) => ({ ...prev, [x.slug]: e.target.value.replace(/\D/g, "") }))
                        }
                        inputMode="numeric"
                        className="h-8 w-28 text-right"
                        aria-label={`Precio de ${x.nombre}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
