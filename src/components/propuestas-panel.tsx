"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Eye, Sparkles, Trash2, Loader2, ImagePlus, X, Plus, Upload, Mic, Square } from "lucide-react";
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

// Tipos mínimos de la Web Speech API (no están en lib.dom estándar).
interface SRAlt { transcript: string }
interface SRRes { isFinal: boolean; 0: SRAlt }
interface SRList { length: number; [i: number]: SRRes }
interface SREvent { resultIndex: number; results: SRList }
interface SRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}
function getSR(): (new () => SRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SRec;
    webkitSpeechRecognition?: new () => SRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
  const [rubroLibre, setRubroLibre] = useState("");
  const [web, setWeb] = useState("");
  const [ig, setIg] = useState("");
  const [contexto, setContexto] = useState("");
  const [imgsCtx, setImgsCtx] = useState<{ name: string; media_type: string; data: string }[]>([]);
  const [conContexto, setConContexto] = useState(false);
  const [afinando, setAfinando] = useState<PropuestaFila | null>(null);
  const fileCtxRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [leyendoPdf, setLeyendoPdf] = useState(false);
  const [pdfNombre, setPdfNombre] = useState<string | null>(null);
  const [dictando, setDictando] = useState(false);
  const recRef = useRef<SRec | null>(null);
  const dictandoRef = useRef(false);

  const hayContexto = contexto.trim().length > 0 || imgsCtx.length > 0 || web.trim().length > 0;

  function limpiar() {
    setEmpresa("");
    setPersona("");
    setRubroLibre("");
    setWeb("");
    setIg("");
    setContexto("");
    setImgsCtx([]);
  }

  /**
   * Crea la propuesta y, si hay contexto cargado, la afina EN LA MISMA PASADA.
   *
   * Antes eran dos pasos: se creaba con la ficha del rubro y después había que
   * volver a pedirle a la IA que la afinara, muchas veces dos o tres veces
   * hasta que quedaba. Dándole el contexto de entrada (qué hace el negocio, su
   * web, su Instagram, lo que se dijo en la reunión) sale bien de una: una
   * sola llamada en vez de tres.
   */
  async function crear() {
    if (!empresa.trim()) {
      toast.error("Poné el nombre de la empresa.");
      return;
    }
    if (rubro === "generico" && !rubroLibre.trim()) {
      toast.error("Contame qué hace el negocio para que la propuesta no salga genérica.");
      return;
    }
    setCreando(true);
    const r = await crearPropuesta({
      empresa,
      contactoNombre: persona || null,
      rubroSlug: rubro,
      rubroTexto: rubroLibre || null,
      sitioWeb: web || null,
      instagram: ig || null,
    });
    if ("error" in r && r.error) {
      setCreando(false);
      toast.error(r.error);
      return;
    }

    let afinada = false;
    if ("id" in r && r.id && hayContexto) {
      try {
        const res = await fetch("/api/propuestas/afinar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propuestaId: r.id,
            notas: contexto,
            images: imgsCtx.map(({ media_type, data }) => ({ media_type, data })),
          }),
        });
        afinada = res.ok;
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast.error(j.error ?? "La propuesta se creó, pero no se pudo afinar.");
        }
      } catch {
        toast.error("La propuesta se creó, pero no se pudo afinar.");
      }
    }

    setCreando(false);
    if ("url" in r && r.url) {
      await navigator.clipboard.writeText(r.url).catch(() => {});
      toast.success(
        afinada
          ? "Propuesta escrita para este prospecto. El link ya está copiado."
          : "Propuesta lista. El link ya está copiado.",
      );
    }
    limpiar();
    startTransition(() => router.refresh());
  }

  /** Sube el PDF de la transcripción y lo deja como contexto. Mismo lector que post-meet. */
  async function subirPdf(file: File | null | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Tiene que ser un PDF.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("El PDF es muy grande (máx 15 MB).");
      return;
    }
    setLeyendoPdf(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/post-meet/extract-pdf", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo leer el PDF.");
        return;
      }
      setContexto((prev) => (prev.trim() ? prev.trim() + "\n\n" : "") + (data.text ?? ""));
      setPdfNombre(file.name);
      toast.success("Transcripción cargada.");
    } catch {
      toast.error("No se pudo leer el PDF.");
    } finally {
      setLeyendoPdf(false);
    }
  }

  /** Dictado por voz al cuadro de contexto: contar la reunión es más rápido que escribirla. */
  function alternarDictado() {
    if (dictando) {
      dictandoRef.current = false;
      setDictando(false);
      try {
        recRef.current?.stop();
      } catch {}
      return;
    }
    const SR = getSR();
    if (!SR) {
      toast.error("Tu navegador no soporta dictado por voz. Probá con Chrome.");
      return;
    }
    const rec = new SR();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
      }
      if (final.trim()) {
        setContexto((prev) => (prev ? prev.replace(/\s*$/, "") + " " : "") + final.trim());
      }
    };
    rec.onerror = (ev) => {
      if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") {
        toast.error("Permití el acceso al micrófono para dictar.");
        dictandoRef.current = false;
        setDictando(false);
      }
    };
    // Chrome corta tras un silencio; si sigue dictando, se reinicia solo.
    rec.onend = () => {
      if (dictandoRef.current) {
        try {
          rec.start();
        } catch {}
      } else {
        setDictando(false);
      }
    };
    recRef.current = rec;
    dictandoRef.current = true;
    setDictando(true);
    try {
      rec.start();
    } catch {}
  }

  async function agregarCtx(files: FileList | null) {
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
    setImgsCtx((prev) => [...prev, ...nuevas].slice(0, 4));
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
          {/* "Otro rubro" sin decir cuál deja la propuesta genérica, que es
              justo lo que no sirve. Si elige otro, se pide en palabras. */}
          {rubro === "generico" && (
            <Input
              value={rubroLibre}
              onChange={(e) => setRubroLibre(e.target.value)}
              placeholder="¿Qué hace el negocio? (ej. vivero y paisajismo)"
              className="h-9 w-full sm:w-72"
            />
          )}
          <Button onClick={crear} disabled={creando} size="sm">
            {creando ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : hayContexto ? (
              <Sparkles className="mr-1 h-4 w-4" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            {hayContexto ? "Crear con IA y copiar link" : "Crear y copiar link"}
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            value={web}
            onChange={(e) => setWeb(e.target.value)}
            placeholder="Su sitio web (opcional)"
            className="h-9 w-full sm:w-64"
          />
          <Input
            value={ig}
            onChange={(e) => setIg(e.target.value)}
            placeholder="Su Instagram (opcional)"
            className="h-9 w-full sm:w-52"
          />
          <button
            type="button"
            onClick={() => setConContexto((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {conContexto ? "Ocultar el contexto" : "Sumar contexto de la reunión"}
            {hayContexto && !conContexto && (
              <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                cargado
              </span>
            )}
          </button>
        </div>

        {/* El contexto va ANTES de generar: con esto la propuesta sale escrita
            para el prospecto en una sola pasada, en vez de crear una genérica y
            después pedirle a la IA que la arregle dos o tres veces. */}
        {conContexto && (
          <div className="mt-3 rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">
              Pegá la <b>transcripción de la reunión</b>, tus notas o lo que te contestó
              por WhatsApp. Cuanto más concreto, menos genérica sale — y se genera una
              sola vez en vez de tres.
            </p>
            <Textarea
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              rows={6}
              className="mt-2 text-sm"
              placeholder={
                'Ej: "Tiene dos locales, el fuerte es el fin de semana. Probó con otra agencia y no le gustó que no le mostraran nada antes de publicar. Le preocupa el precio y quiere ver resultados en 3 meses."'
              }
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                ref={fileCtxRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  void agregarCtx(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  void subirPdf(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => pdfRef.current?.click()}
                disabled={leyendoPdf}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                {leyendoPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Subir transcripción en PDF
              </button>
              <button
                type="button"
                onClick={alternarDictado}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
                  dictando
                    ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "hover:bg-accent"
                }`}
              >
                {dictando ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {dictando ? "Parar de dictar" : "Contarlo hablando"}
              </button>
              <button
                type="button"
                onClick={() => fileCtxRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <ImagePlus className="h-3.5 w-3.5" /> Subir capturas del chat
              </button>
              {pdfNombre && (
                <span className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                  📄 {pdfNombre}
                </span>
              )}
              {imgsCtx.map((im, i) => (
                <span
                  key={`${im.name}-${i}`}
                  className="inline-flex max-w-[180px] items-center gap-1 rounded-md border px-2 py-1 text-xs"
                >
                  <span className="truncate">{im.name}</span>
                  <button
                    onClick={() => setImgsCtx((prev) => prev.filter((_, x) => x !== i))}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {contexto.trim().length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {contexto.trim().length.toLocaleString("es-AR")} caracteres
                </span>
              )}
            </div>
          </div>
        )}

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
