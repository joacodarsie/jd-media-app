"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, ExternalLink } from "lucide-react";
import {
  upsertMonthlyReport,
  setPublicationLink,
  type MonthlyMetrics,
} from "@/app/reporte/cliente/[id]/actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MonthlyReportEditor({
  clienteId,
  yearMonth,
  initialNota,
  initialMetricas,
}: {
  clienteId: string;
  yearMonth: string;
  initialNota: string | null;
  initialMetricas: MonthlyMetrics;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nota, setNota] = useState(initialNota ?? "");
  const [m, setM] = useState<MonthlyMetrics>(initialMetricas ?? {});

  function field<K extends keyof MonthlyMetrics>(key: K, val: MonthlyMetrics[K]) {
    setM((curr) => ({ ...curr, [key]: val }));
  }

  function submit() {
    start(async () => {
      const res = await upsertMonthlyReport({
        cliente_id: clienteId,
        year_month: yearMonth,
        nota,
        metricas: m,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Reporte actualizado");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar reporte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar reporte mensual</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Nota */}
          <div className="space-y-2">
            <Label>Nota destacada del mes (Markdown)</Label>
            <Textarea
              rows={4}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Resumen del mes, hitos importantes, contexto que quieras destacar para el cliente…"
            />
          </div>

          {/* Métricas orgánicas */}
          <fieldset className="space-y-2 rounded-lg border bg-card/40 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Métricas orgánicas (Instagram / TikTok / etc.)
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Num label="Seguidores nuevos" value={m.seguidores_nuevos ?? null} onChange={(v) => field("seguidores_nuevos", v)} />
              <Num label="Reach total" value={m.reach ?? null} onChange={(v) => field("reach", v)} />
              <Num label="Impresiones" value={m.impresiones ?? null} onChange={(v) => field("impresiones", v)} />
              <Num label="Interacciones" value={m.interacciones ?? null} onChange={(v) => field("interacciones", v)} />
              <Num label="Visitas al perfil" value={m.visitas_perfil ?? null} onChange={(v) => field("visitas_perfil", v)} />
            </div>
          </fieldset>

          {/* Meta Ads */}
          <fieldset className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/30 p-3 dark:border-blue-900 dark:bg-blue-950/20">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Meta Ads (paid media)
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Inversión total</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="any"
                    value={m.ads_inversion ?? ""}
                    onChange={(e) =>
                      field("ads_inversion", e.target.value === "" ? null : Number(e.target.value))
                    }
                    placeholder="0"
                  />
                  <select
                    value={m.ads_moneda ?? "ARS"}
                    onChange={(e) => field("ads_moneda", e.target.value)}
                    className="rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <Num label="Impresiones" value={m.ads_impresiones ?? null} onChange={(v) => field("ads_impresiones", v)} />
              <Num label="Clicks" value={m.ads_clicks ?? null} onChange={(v) => field("ads_clicks", v)} />
              <Num label="CTR (%)" value={m.ads_ctr ?? null} onChange={(v) => field("ads_ctr", v)} step="any" />
              <Num label="CPM" value={m.ads_cpm ?? null} onChange={(v) => field("ads_cpm", v)} step="any" />
              <Num label="Conversiones" value={m.ads_conversiones ?? null} onChange={(v) => field("ads_conversiones", v)} />
              <Num label="ROAS" value={m.ads_roas ?? null} onChange={(v) => field("ads_roas", v)} step="any" />
            </div>
            <div className="space-y-1 pt-1">
              <Label className="text-xs">Notas de Paid Media</Label>
              <Textarea
                rows={2}
                value={m.ads_notas ?? ""}
                onChange={(e) => field("ads_notas", e.target.value)}
                placeholder="Mejor campaña, segmentación destacada, aprendizajes…"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Próximamente vamos a poder traer estas métricas automáticamente desde tu cuenta de Meta Ads.
            </p>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar reporte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Num({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        placeholder="—"
      />
    </div>
  );
}

/** Botón pequeño junto a una publicación para cargar/editar el link público. */
export function PublicationLinkEditor({
  publicationId,
  currentLink,
}: {
  publicationId: string;
  currentLink: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(currentLink ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await setPublicationLink(publicationId, val);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          title={currentLink ? "Editar link" : "Cargar link de publicación"}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link de la publicación</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">URL pública (Instagram, TikTok, etc.)</Label>
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="https://www.instagram.com/p/..."
            autoFocus
          />
          {currentLink && (
            <a
              href={currentLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Abrir actual
            </a>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
