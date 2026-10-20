"use client";

/**
 * «Estoy trabado» en las tareas vencidas (19/10/2026): un toque, se elige qué
 * la frena (el cliente o un compañero) y le llega el aviso a quien destraba.
 * Si ya está trabada, muestra a quién espera y se puede destrabar.
 * Va dentro de filas que son links: corta la propagación del clic.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { etiquetaTrabada, type TipoTraba } from "@/lib/tareas/trabada";
import { destrabar, marcarTrabada, personasParaTraba } from "@/app/(app)/tareas/trabada-actions";

const frenar = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function TrabadaBoton({
  taskId,
  titulo,
  bloqueo,
  bloqueoQuien,
  className,
}: {
  taskId: string;
  titulo: string;
  bloqueo?: TipoTraba | null;
  bloqueoQuien?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoTraba | null>(null);
  const [personas, setPersonas] = useState<{ id: string; nombre: string }[] | null>(null);
  const [esperando, setEsperando] = useState<string>("");
  const [detalle, setDetalle] = useState("");
  const [enviando, setEnviando] = useState(false);
  const etiqueta = etiquetaTrabada(bloqueo, bloqueoQuien);

  async function abrir(e: React.MouseEvent) {
    frenar(e);
    setAbierto(true);
    if (!personas) setPersonas(await personasParaTraba().catch(() => []));
  }

  async function enviar() {
    if (!tipo) return;
    setEnviando(true);
    const r = await marcarTrabada({ taskId, tipo, esperandoId: tipo === "persona" ? esperando : null, detalle });
    setEnviando(false);
    if ("error" in r && r.error) return void toast.error(r.error);
    toast.success(tipo === "cliente" ? "En pausa: el reloj se frena, el cliente lo ve en su portal y le avisamos a la PM." : "Listo: ya le avisamos que lo estás esperando.");
    setAbierto(false);
    setTipo(null);
    setDetalle("");
    router.refresh();
  }

  async function soltar(e: React.MouseEvent) {
    frenar(e);
    const r = await destrabar(taskId);
    if ("error" in r && r.error) return void toast.error(r.error);
    toast.success("nuevaFecha" in r && r.nuevaFecha ? `¡Sigue! La fecha límite se corrió al ${r.nuevaFecha.slice(8, 10)}/${r.nuevaFecha.slice(5, 7)} por los días en pausa.` : "¡Destrabada! A seguir.");
    router.refresh();
  }

  return (
    <>
      {etiqueta ? (
        <button
          type="button"
          onClick={soltar}
          title="Ya me destrabé"
          aria-label={`${etiqueta}. Tocá si ya te destrabaste`}
          className={cn(
            "group/tr inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800 transition hover:bg-emerald-100 hover:text-emerald-800 dark:bg-orange-500/15 dark:text-orange-300",
            className
          )}
        >
          <span>🧱 {etiqueta}</span>
          <span aria-hidden="true" className="opacity-0 transition group-hover/tr:opacity-100">✓</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={abrir}
          title="Estoy trabado: avisar a quién espero"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-orange-300 px-2 py-0.5 text-[11px] font-medium text-orange-700 opacity-80 transition hover:-translate-y-px hover:bg-orange-50 hover:opacity-100 dark:border-orange-500/40 dark:text-orange-300 dark:hover:bg-orange-500/10",
            className
          )}
        >
          🧱 <span className="hidden sm:inline">¿Trabada?</span>
        </button>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué te frena?</DialogTitle>
          </DialogHeader>
          <p className="-mt-2 truncate text-sm text-muted-foreground">{titulo}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["cliente", "⏸️ Espera al cliente", "Material, aprobación, accesos. Se pausa el reloj"],
                ["persona", "👥 Espero a alguien del equipo", "Otra parte que no está lista"],
              ] as const
            ).map(([k, t, s]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTipo(k)}
                className={cn(
                  "rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
                  tipo === k ? "border-orange-400 bg-orange-50 ring-2 ring-orange-300/60 dark:bg-orange-500/10" : "bg-card"
                )}
              >
                <div className="text-sm font-semibold">{t}</div>
                <div className="text-xs text-muted-foreground">{s}</div>
              </button>
            ))}
          </div>
          {tipo === "persona" && (
            <select
              value={esperando}
              onChange={(e) => setEsperando(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">¿A quién esperás?</option>
              {(personas ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          )}
          {tipo && (
            <Textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder={tipo === "cliente" ? "Qué necesitamos del cliente: lo va a leer en su portal" : "Qué te falta, en una línea (opcional)"}
              rows={2}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {tipo === "cliente" ? "Le avisamos a la PM y el cliente lo ve en su portal. Mientras tanto no cuenta como atraso, y al reanudar la fecha límite se corre los días en pausa." : "Le avisamos a esa persona. Mientras espera, la tarea no cuenta como atraso de la cuenta."}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={!tipo || enviando || (tipo === "persona" && !esperando)}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tipo === "cliente" ? "Pausar y avisar" : "Avisar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
