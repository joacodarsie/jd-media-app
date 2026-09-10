"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  ImagePlus,
  X,
  Upload,
  Sparkles,
  Building2,
  Layers,
  MessageSquareText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AudioATexto } from "@/components/audio-a-texto";
import { crearPropuesta } from "@/app/(app)/prospeccion/propuestas/actions";
import { cn } from "@/lib/utils";

interface Opcion {
  slug: string;
  nombre: string;
}

/** Máximo por imagen antes de mandarla al modelo. */
const MAX_IMG_MB = 4;

interface CuentaForm {
  handle: string;
  packSlug: string;
  nota: string;
}

/**
 * Alta de propuesta.
 *
 * Por qué es un formulario por pasos y no cuatro campos sueltos: la calidad de
 * la propuesta depende casi por completo de lo que se carga acá. Cuando el
 * formulario pedía poco, la IA rellenaba con generalidades del rubro y después
 * había que corregir la propuesta tres veces —gastando una llamada cada vez—.
 *
 * Los tres bloques piden, en orden, lo que el documento necesita para salir
 * bien de una: quién es, qué le vamos a llevar y con qué precio, y el contexto
 * real (la reunión, el chat, la nota de voz).
 */
export function NuevaPropuesta({ rubros, packs }: { rubros: Opcion[]; packs: Opcion[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creando, setCreando] = useState(false);

  // ── 1. El prospecto ──
  const [empresa, setEmpresa] = useState("");
  const [persona, setPersona] = useState("");
  const [ciudad, setCiudad] = useState("Córdoba");
  const [rubro, setRubro] = useState(rubros[0]?.slug ?? "generico");
  const [rubroLibre, setRubroLibre] = useState("");
  const [web, setWeb] = useState("");

  // ── 2. Qué le llevamos ──
  const packBase = packs[0]?.slug ?? "presencia";
  const [cuentas, setCuentas] = useState<CuentaForm[]>([
    { handle: "", packSlug: packBase, nota: "" },
  ]);
  const [descuento, setDescuento] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");

  // ── 3. Contexto ──
  const [contexto, setContexto] = useState("");
  const [imgs, setImgs] = useState<{ name: string; media_type: string; data: string }[]>([]);
  const [pdfNombre, setPdfNombre] = useState<string | null>(null);
  const [leyendoPdf, setLeyendoPdf] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const variasCuentas = cuentas.filter((c) => c.handle.trim()).length > 1;
  const hayContexto = contexto.trim().length > 0 || imgs.length > 0 || web.trim().length > 0;

  function limpiar() {
    setEmpresa("");
    setPersona("");
    setRubroLibre("");
    setWeb("");
    setCuentas([{ handle: "", packSlug: packBase, nota: "" }]);
    setDescuento("");
    setFechaInicio("");
    setContexto("");
    setImgs([]);
    setPdfNombre(null);
  }

  function setCuenta(i: number, patch: Partial<CuentaForm>) {
    setCuentas((prev) => prev.map((c, x) => (x === i ? { ...c, ...patch } : c)));
  }

  async function agregarImagenes(files: FileList | null) {
    if (!files?.length) return;
    const nuevas: typeof imgs = [];
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

  /** El PDF de la transcripción se lee con el mismo extractor que post-meet. */
  async function subirPdf(file: File | null | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return toast.error("Tiene que ser un PDF.");
    if (file.size > 15 * 1024 * 1024) return toast.error("El PDF es muy grande (máx 15 MB).");
    setLeyendoPdf(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/post-meet/extract-pdf", { method: "POST", body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) return toast.error(data.error ?? "No se pudo leer el PDF.");
      setContexto((prev) => (prev.trim() ? prev.trim() + "\n\n" : "") + (data.text ?? ""));
      setPdfNombre(file.name);
      toast.success("Transcripción cargada.");
    } catch {
      toast.error("No se pudo leer el PDF.");
    } finally {
      setLeyendoPdf(false);
    }
  }

  /**
   * Crea y afina EN LA MISMA PASADA. Antes eran dos pasos y había que pedirle a
   * la IA que la afinara dos o tres veces hasta que quedaba: una llamada cada
   * vez. Con todo el contexto de entrada sale bien de una.
   */
  async function crear() {
    if (!empresa.trim()) return toast.error("Poné el nombre de la empresa.");
    if (rubro === "generico" && !rubroLibre.trim()) {
      return toast.error("Contame qué hace el negocio para que la propuesta no salga genérica.");
    }
    const cuentasOk = cuentas
      .map((c) => ({ handle: c.handle.trim(), packSlug: c.packSlug, nota: c.nota.trim() || null }))
      .filter((c) => c.handle);
    if (cuentasOk.length === 0) {
      return toast.error("Cargá al menos una cuenta con su pack.");
    }

    setCreando(true);
    const r = await crearPropuesta({
      empresa,
      contactoNombre: persona || null,
      rubroSlug: rubro,
      rubroTexto: rubroLibre || null,
      sitioWeb: web || null,
      instagram: cuentasOk[0].handle,
      ciudad: ciudad || null,
      cuentas: cuentasOk,
      descuentoMonto: variasCuentas ? Number(descuento) || 0 : 0,
      fechaInicio: fechaInicio || null,
      contexto: contexto || null,
      packSugerido: cuentasOk[0].packSlug,
    });
    if ("error" in r && r.error) {
      setCreando(false);
      return toast.error(r.error);
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
            images: imgs.map(({ media_type, data }) => ({ media_type, data })),
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
          : "Propuesta lista. El link ya está copiado."
      );
    }
    limpiar();
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <Paso icono={<Building2 className="h-4 w-4" />} n="1" titulo="Quién es el prospecto" />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Empresa" req>
          <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ej: Catch" />
        </Campo>
        <Campo label="Persona con la que hablás">
          <Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Ej: Francisco" />
        </Campo>
        <Campo
          label="Ciudad"
          ayuda="Define si las jornadas de producción llevan traslado. En Córdoba no se cobra."
        >
          <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Córdoba" />
        </Campo>
        <Campo label="Sitio web" ayuda="Lo leemos y se lo damos a la IA como contexto real.">
          <Input value={web} onChange={(e) => setWeb(e.target.value)} placeholder="jdmedia.com.ar" />
        </Campo>
        <Campo label="Rubro">
          <Select value={rubro} onValueChange={setRubro}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rubros.map((r) => (
                <SelectItem key={r.slug} value={r.slug}>
                  {r.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo
          label={rubro === "generico" ? "Qué hace el negocio" : "Detalle del rubro"}
          req={rubro === "generico"}
        >
          <Input
            value={rubroLibre}
            onChange={(e) => setRubroLibre(e.target.value)}
            placeholder="Ej: resto bar y productora de eventos"
          />
        </Campo>
      </div>

      <Paso icono={<Layers className="h-4 w-4" />} n="2" titulo="Qué le vamos a llevar" />

      <div className="space-y-2">
        {cuentas.map((c, i) => (
          <div key={i} className="grid gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[1.1fr_1fr_1.4fr_auto]">
            <Input
              value={c.handle}
              onChange={(e) => setCuenta(i, { handle: e.target.value })}
              placeholder={i === 0 ? "@cuenta principal" : "@segunda cuenta"}
            />
            <Select value={c.packSlug} onValueChange={(v) => setCuenta(i, { packSlug: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {packs.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={c.nota}
              onChange={(e) => setCuenta(i, { nota: e.target.value })}
              placeholder="Para qué es esta cuenta (opcional)"
            />
            <button
              type="button"
              onClick={() => setCuentas((prev) => prev.filter((_, x) => x !== i))}
              disabled={cuentas.length === 1}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              title="Quitar cuenta"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setCuentas((prev) => [...prev, { handle: "", packSlug: packBase, nota: "" }])}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar otra cuenta
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {variasCuentas && (
          <Campo label="Descuento por llevar varias cuentas" ayuda="Mensual, en pesos. Se muestra en el cuadro de inversión.">
            <Input
              value={descuento}
              onChange={(e) => setDescuento(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="50000"
            />
          </Campo>
        )}
        <Campo
          label="Fecha de arranque"
          ayuda="Si no es el 1°, la propuesta muestra el proporcional del primer mes."
        >
          <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </Campo>
      </div>

      <Paso
        icono={<MessageSquareText className="h-4 w-4" />}
        n="3"
        titulo="Contexto para que la IA escriba bien"
      />

      <p className="text-xs text-muted-foreground">
        Es lo que más cambia el resultado. Contá <b>qué hace el negocio, qué te dijo en la reunión y
        qué está buscando</b>. Podés pegar la transcripción, subirla en PDF, mandar la nota de voz
        que te pasó o dictarla.
      </p>

      <Textarea
        value={contexto}
        onChange={(e) => setContexto(e.target.value)}
        rows={6}
        placeholder={
          "Ej: Resto bar con 13 años en Córdoba. Tiene dos cuentas: la principal de la marca y otra de un ciclo semanal. Viene de una agencia que no le funcionó y necesita orden y que le devuelvan tiempo. Entra temporada de eventos de fin de año..."
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <AudioATexto
          disabled={creando}
          onTexto={(t) => setContexto((prev) => (prev.trim() ? `${prev.trim()}\n\n${t}` : t))}
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
          {leyendoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Transcripción en PDF
        </button>

        <input
          ref={imgRef}
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
          onClick={() => imgRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Capturas del chat
        </button>
      </div>

      {(pdfNombre || imgs.length > 0) && (
        <ul className="space-y-1">
          {pdfNombre && (
            <li className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs">
              <span className="truncate">{pdfNombre}</span>
              <button onClick={() => setPdfNombre(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          )}
          {imgs.map((im, i) => (
            <li key={`${im.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {hayContexto
            ? "Se crea y se escribe con IA en una sola pasada. Cuesta menos de US$0,02."
            : "Sin contexto sale con el texto del rubro, sin personalizar."}
        </span>
        <Button onClick={crear} disabled={creando} className="gap-1.5">
          {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Crear y copiar link
        </Button>
      </div>
    </div>
  );
}

function Paso({ n, titulo, icono }: { n: string; titulo: string; icono: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b pb-2 pt-1">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
        {icono}
      </span>
      <span className="text-[10px] font-bold tracking-widest text-muted-foreground">{n}</span>
      <h3 className="text-sm font-semibold">{titulo}</h3>
    </div>
  );
}

function Campo({
  label,
  ayuda,
  req,
  children,
}: {
  label: string;
  ayuda?: string;
  req?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-xs", req && "after:ml-0.5 after:text-destructive after:content-['*']")}>
        {label}
      </Label>
      {children}
      {ayuda && <p className="text-[11px] leading-snug text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
