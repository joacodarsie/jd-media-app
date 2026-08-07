"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Eye, Sparkles, Trash2, Loader2, ImagePlus, X, Plus } from "lucide-react";
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
import { fmtDate } from "@/lib/dates";
import {
  crearPropuesta,
  actualizarPropuesta,
  quitarPersonalizacion,
  borrarPropuesta,
} from "@/app/(app)/prospeccion/propuestas/actions";

export interface PropuestaFila {
  id: string;
  token: string;
  empresa: string;
  contactoNombre: string | null;
  rubroSlug: string | null;
  rubroTexto: string | null;
  packSugerido: string | null;
  personalizada: boolean;
  aperturas: number;
  ultimaApertura: string | null;
  creadaEl: string;
}

interface Opcion {
  slug: string;
  nombre: string;
}

/** Máximo por imagen antes de mandarla al modelo (una captura pesa mucho menos). */
const MAX_IMG_MB = 4;

export function PropuestasPanel({
  filas,
  rubros,
  packs,
}: {
  filas: PropuestaFila[];
  rubros: Opcion[];
  packs: Opcion[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [persona, setPersona] = useState("");
  const [rubro, setRubro] = useState(rubros[0]?.slug ?? "generico");
  const [afinando, setAfinando] = useState<PropuestaFila | null>(null);

  async function crear() {
    if (!empresa.trim()) {
      toast.error("Poné el nombre de la empresa.");
      return;
    }
    setCreando(true);
    const r = await crearPropuesta({
      empresa,
      contactoNombre: persona || null,
      rubroSlug: rubro,
    });
    setCreando(false);
    if ("error" in r && r.error) {
      toast.error(r.error);
      return;
    }
    if ("url" in r && r.url) {
      await navigator.clipboard.writeText(r.url).catch(() => {});
      toast.success("Propuesta lista. El link ya está copiado.");
    }
    setEmpresa("");
    setPersona("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      {/* Alta rápida */}
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-medium">Nueva propuesta</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Empresa (ej. Posada de Rosas)"
            className="h-9 w-full sm:w-64"
          />
          <Input
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="Persona (opcional)"
            className="h-9 w-full sm:w-48"
          />
          <select
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm [color-scheme:light] dark:[color-scheme:dark]"
          >
            {rubros.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.nombre}
              </option>
            ))}
          </select>
          <Button onClick={crear} disabled={creando} size="sm">
            {creando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Crear y copiar link
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Desde <b>Contactos</b> también sale con un clic: agarra la empresa, la persona
          y el rubro de la campaña.
        </p>
      </div>

      {filas.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="font-medium">Todavía no armaste ninguna propuesta</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            La primera que mandes ya te va a decir si la abrieron.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filas.map((f) => (
            <Fila
              key={f.id}
              fila={f}
              rubros={rubros}
              packs={packs}
              onAfinar={() => setAfinando(f)}
            />
          ))}
        </div>
      )}

      <DialogAfinar
        fila={afinando}
        onClose={(cambio) => {
          setAfinando(null);
          if (cambio) startTransition(() => router.refresh());
        }}
      />
    </div>
  );
}

function Fila({
  fila: f,
  rubros,
  packs,
  onAfinar,
}: {
  fila: PropuestaFila;
  rubros: Opcion[];
  packs: Opcion[];
  onAfinar: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/propuesta/${f.token}` : "";

  async function copiar() {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  async function correr(fn: () => Promise<{ error?: string }>, msg: string) {
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    toast.success(msg);
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {f.empresa}
            {f.personalizada && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                afinada con IA
              </span>
            )}
            {f.aperturas > 0 ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                abierta {f.aperturas}×{f.ultimaApertura ? ` · ${fmtDate(f.ultimaApertura, "dd/MM HH:mm")}` : ""}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                sin abrir
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {f.contactoNombre ? `${f.contactoNombre} · ` : ""}
            {rubros.find((r) => r.slug === f.rubroSlug)?.nombre ?? "sin rubro"} · creada{" "}
            {fmtDate(f.creadaEl)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={f.rubroSlug ?? "generico"}
            disabled={ocupado}
            onChange={(e) =>
              correr(
                () => actualizarPropuesta(f.id, { rubroSlug: e.target.value }),
                "Rubro actualizado.",
              )
            }
            className="h-8 rounded-md border bg-background px-2 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          >
            {rubros.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.nombre}
              </option>
            ))}
          </select>
          <select
            value={f.packSugerido ?? ""}
            disabled={ocupado}
            onChange={(e) =>
              correr(
                () => actualizarPropuesta(f.id, { packSugerido: e.target.value }),
                "Pack recomendado actualizado.",
              )
            }
            className="h-8 rounded-md border bg-background px-2 text-xs [color-scheme:light] dark:[color-scheme:dark]"
          >
            {packs.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nombre}
              </option>
            ))}
          </select>

          <button
            onClick={copiar}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-accent"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? "Copiado" : "Copiar link"}
          </button>
          <a
            href={`/propuesta/${f.token}?preview=1`}
            target="_blank"
            rel="noreferrer"
            title="Verla sin que cuente como apertura"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
          >
            <Eye className="h-3.5 w-3.5" /> Ver
          </a>
          <button
            onClick={onAfinar}
            className="inline-flex items-center gap-1 rounded-md border border-violet-300 px-2 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-950"
          >
            <Sparkles className="h-3.5 w-3.5" /> Afinar con IA
          </button>
          {f.personalizada && (
            <button
              onClick={() => correr(() => quitarPersonalizacion(f.id), "Volvió al texto del rubro.")}
              disabled={ocupado}
              title="Volver al texto general del rubro"
              className="rounded-md border px-2 py-1.5 text-xs hover:bg-accent"
            >
              Deshacer IA
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`¿Borrar la propuesta de ${f.empresa}? El link deja de funcionar.`))
                correr(() => borrarPropuesta(f.id), "Propuesta borrada.");
            }}
            disabled={ocupado}
            className="rounded-md border p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * "Afinar con IA": se pega lo que dijo el prospecto o se sube la captura del
 * chat. El caso real que lo motivó: un hotel contestó que lo único que le
 * importa es la segmentación porque el 85% de sus huéspedes son extranjeros y
 * no repiten. Una propuesta de rubro no responde eso; esta sí.
 */
function DialogAfinar({
  fila,
  onClose,
}: {
  fila: PropuestaFila | null;
  onClose: (huboCambio: boolean) => void;
}) {
  const [notas, setNotas] = useState("");
  const [imgs, setImgs] = useState<{ name: string; media_type: string; data: string }[]>([]);
  const [cargando, setCargando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function agregarImagenes(files: FileList | null) {
    if (!files?.length) return;
    const nuevas: { name: string; media_type: string; data: string }[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (file.size > MAX_IMG_MB * 1024 * 1024) {
        toast.error(`${file.name} pesa más de ${MAX_IMG_MB} MB.`);
        continue;
      }
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      nuevas.push({ name: file.name, media_type: file.type, data: b64 });
    }
    setImgs((prev) => [...prev, ...nuevas].slice(0, 4));
  }

  async function generar() {
    if (!fila) return;
    if (!notas.trim() && imgs.length === 0) {
      toast.error("Pegá lo que te dijo o subí la captura del chat.");
      return;
    }
    setCargando(true);
    try {
      const res = await fetch("/api/propuestas/afinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propuestaId: fila.id,
          notas,
          images: imgs.map(({ media_type, data }) => ({ media_type, data })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "No se pudo generar.");
        return;
      }
      toast.success("Propuesta afinada. Abrila para verla.");
      setNotas("");
      setImgs([]);
      onClose(true);
    } catch {
      toast.error("No se pudo generar.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Dialog open={!!fila} onOpenChange={(v) => !v && onClose(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Afinar la propuesta de {fila?.empresa}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pegá <b>lo que te contestó</b> el prospecto (o subí la captura del chat). La
            IA reescribe el diagnóstico y agrega cómo se lo resolvemos puntualmente.
          </p>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={5}
            placeholder={
              'Ej: "Para mí lo más importante es la segmentación. El 85% de nuestros huéspedes son extranjeros y no repiten compra."'
            }
          />

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                void agregarImagenes(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <ImagePlus className="h-3.5 w-3.5" /> Subir captura del chat
            </button>
            {imgs.length > 0 && (
              <ul className="mt-2 space-y-1">
                {imgs.map((im, i) => (
                  <li
                    key={`${im.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                  >
                    <span className="truncate">{im.name}</span>
                    <button
                      onClick={() => setImgs((prev) => prev.filter((_, x) => x !== i))}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Cuesta menos de US$0,02.</span>
            <Button onClick={generar} disabled={cargando}>
              {cargando ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1 h-4 w-4" />
              )}
              Afinar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
