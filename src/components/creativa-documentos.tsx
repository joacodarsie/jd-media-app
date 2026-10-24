"use client";

/**
 * Los documentos de campaña de una cuenta (23/10/2026, boceto de Santi): cada
 * uno con su inicio, su duración y el vencimiento calculado; 7 días antes se
 * pinta de rojo para replantear la estrategia. Quedan disponibles para JDmedIA.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { hoyYmd } from "@/lib/dates";
import { ENTREGABLES, textoVigencia, type Entregable } from "@/lib/creativa/creativa";
import type { DocCampana } from "@/lib/creativa/cargar";
import { borrarDocumentoCampana, editarVigencia, linkDocumento, subirDocumentoCampana, usarEnJdmedia } from "@/app/(app)/creativa/actions";

const fecha = (ymd: string | null) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : "—");
const DURACIONES = [30, 60, 90, 180];
const MAX_MB = 50;

export function CreativaDocumentos({ clienteId, docs, tipos }: { clienteId: string; docs: DocCampana[]; tipos?: Entregable[] }) {
  const [abierto, setAbierto] = useState(false);
  const faltan = tipos?.filter((t) => !docs.some((d) => d.entregable === t)) ?? [];
  return (
    <div className="space-y-2.5">
      {docs.map((d) => (
        <Documento key={d.id} d={d} />
      ))}
      {tipos && faltan.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {faltan.map((t) => (
            <span key={t} className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground">
              {ENTREGABLES[t].emoji} Falta: {ENTREGABLES[t].label}
            </span>
          ))}
        </div>
      )}
      {abierto ? (
        <Subir clienteId={clienteId} tipoInicial={faltan[0] ?? "plataforma_campana"} onClose={() => setAbierto(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Cargar documento de campaña
        </button>
      )}
    </div>
  );
}

function Documento({ d }: { d: DocCampana }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const [inicio, setInicio] = useState(d.inicio ?? hoyYmd());
  const [dias, setDias] = useState(String(d.dias ?? 90));
  const alerta = textoVigencia(d.vigencia);
  const rojo = d.vigencia.estado === "por_vencer" || d.vigencia.estado === "vencido";
  const correr = (fn: () => Promise<{ ok?: true; error?: string; url?: string } | undefined>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) return void toast.error(r.error);
      if (ok) toast.success(ok);
      router.refresh();
    });

  return (
    <div id={`doc-${d.id}`} className={cn("scroll-mt-24 rounded-xl border bg-card p-3 sm:p-4", rojo && "border-red-500/60 bg-red-500/5")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-lg", rojo && "bg-red-500/15")} aria-hidden="true">
          {ENTREGABLES[d.entregable].emoji}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block max-w-full truncate text-left text-sm font-semibold hover:underline"
            onClick={() =>
              start(async () => {
                const r = await linkDocumento(d.id);
                if ("url" in r && r.url) window.open(r.url, "_blank", "noopener");
                else toast.error(("error" in r && r.error) || "No se pudo abrir.");
              })
            }
          >
            {d.titulo}
          </button>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {ENTREGABLES[d.entregable].label} · subido {fecha(d.subido)}
            {d.subidoPor ? ` por ${d.subidoPor}` : ""}
          </div>
          {alerta ? (
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {alerta}
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => correr(() => usarEnJdmedia(d.id, !d.usarEnIa), d.usarEnIa ? "JDmedIA ya no lo usa." : "Disponible para JDmedIA.")}
              className={cn("mt-1 inline-flex items-center gap-1 text-xs", d.usarEnIa ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}
              title="Tocá para cambiarlo"
            >
              <Sparkles className="h-3 w-3" /> {d.usarEnIa ? "Disponible para JDmedIA" : "JDmedIA no lo usa"}
            </button>
          )}
        </div>
        <button type="button" onClick={() => setEditando((v) => !v)} className="flex gap-1.5" title="Cambiar inicio o duración">
          <Chip titulo="Inicio" valor={fecha(d.inicio)} />
          <Chip titulo="Duración" valor={d.dias ? `${d.dias} días` : "—"} />
          <Chip titulo="Vence" valor={fecha(d.vigencia.vence)} tono={rojo ? "rojo" : d.vigencia.vence ? "verde" : undefined} />
        </button>
      </div>

      {editando && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
          <div>
            <Label className="text-xs">Inicio</Label>
            <Input type="date" className="h-8 w-40" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Duración (días)</Label>
            <Input inputMode="numeric" className="h-8 w-24" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Button size="sm" className="h-8" disabled={pending} onClick={() => correr(() => editarVigencia(d.id, inicio || null, dias ? Number(dias) : null), "Vigencia actualizada.")}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 gap-1 text-muted-foreground hover:text-red-600"
            disabled={pending}
            onClick={() => confirm(`¿Borrar «${d.titulo}»?`) && correr(() => borrarDocumentoCampana(d.id), "Documento borrado.")}
          >
            <Trash2 className="h-4 w-4" /> Borrar
          </Button>
        </div>
      )}
    </div>
  );
}

function Chip({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "rojo" | "verde" }) {
  return (
    <span className="rounded-lg border bg-background px-2.5 py-1 text-center">
      <span className="block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</span>
      <span
        className={cn(
          "block text-xs font-semibold tabular-nums",
          tono === "rojo" && "text-red-600 dark:text-red-400",
          tono === "verde" && "text-emerald-700 dark:text-emerald-300"
        )}
      >
        {valor}
      </span>
    </span>
  );
}

function Subir({ clienteId, tipoInicial, onClose }: { clienteId: string; tipoInicial: Entregable; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState<Entregable>(tipoInicial);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState(hoyYmd());
  const [dias, setDias] = useState("90");

  function subir() {
    if (!archivo) return void toast.error("Elegí el archivo.");
    if (archivo.size > MAX_MB * 1024 * 1024) return void toast.error(`El archivo no puede pesar más de ${MAX_MB} MB.`);
    start(async () => {
      const ext = (archivo.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `campana/${clienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: up } = await createClient().storage.from("documents").upload(path, archivo, { contentType: archivo.type || "application/octet-stream", upsert: false });
      if (up) return void toast.error("No se pudo subir: " + up.message);
      const r = await subirDocumentoCampana({
        clienteId,
        entregable: tipo,
        titulo: titulo.trim() || archivo.name.replace(/\.[^.]+$/, ""),
        storagePath: path,
        fileName: archivo.name,
        fileSize: archivo.size,
        mimeType: archivo.type || null,
        inicio: inicio || null,
        dias: dias ? Number(dias) : null,
      });
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Documento cargado: ya lo puede usar JDmedIA.");
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ENTREGABLES) as Entregable[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", tipo === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {ENTREGABLES[t].emoji} {ENTREGABLES[t].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{ENTREGABLES[tipo].ayuda}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => ref.current?.click()}>
          <FileText className="h-4 w-4" /> {archivo ? "Cambiar archivo" : "Elegir archivo"}
        </Button>
        <span className="min-w-0 truncate text-xs text-muted-foreground">{archivo?.name ?? "PDF, Word o lo que uses"}</span>
        <input
          ref={ref}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setArchivo(f);
            if (f && !titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Label className="text-xs">Nombre</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Estrategia de contenidos — Q4 2026" />
        </div>
        <div>
          <Label className="text-xs">Inicio</Label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Duración</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {DURACIONES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDias(String(n))}
                className={cn("rounded-full border px-2.5 py-1 text-xs", dias === String(n) ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted")}
              >
                {n} días
              </button>
            ))}
            <Input inputMode="numeric" className="h-8 w-20" value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))} aria-label="Días" />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button size="sm" onClick={subir} disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cargar
        </Button>
      </div>
    </div>
  );
}
