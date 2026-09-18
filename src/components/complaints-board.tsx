"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  createComplaint,
  deleteComplaint,
  setComplaintEstado,
} from "@/app/(app)/quejas/actions";
import { AREAS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ComplaintRow {
  id: string;
  cliente_id: string;
  area: string;
  gravedad: "baja" | "media" | "alta";
  estado: "abierta" | "en_proceso" | "resuelta";
  detalle: string;
  resolucion: string | null;
  fecha: string;
  cliente: { id: string; nombre: string } | null;
  autor: { id: string; nombre: string } | null;
}

const TODOS = "__all__";

const ESTADO_LABEL: Record<ComplaintRow["estado"], string> = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  resuelta: "Resuelta",
};

const GRAVEDAD_LABEL: Record<ComplaintRow["gravedad"], string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

const GRAVEDAD_CHIP: Record<ComplaintRow["gravedad"], string> = {
  baja: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  alta: "bg-red-500/15 text-red-600 dark:text-red-400",
};

/** Las áreas que se reclaman de verdad: las que tocan el trabajo del cliente. */
const AREAS_QUEJA: string[] = [
  ...AREAS.filter((a) => !["Prospecting", "Comercial", "Estrategia/Dirección"].includes(a)),
  "Otra",
];

export function ComplaintsBoard({
  rows,
  clients,
}: {
  rows: ComplaintRow[];
  clients: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fCliente, setFCliente] = useState(TODOS);
  const [fArea, setFArea] = useState(TODOS);
  const [verResueltas, setVerResueltas] = useState(false);

  const filtradas = useMemo(
    () =>
      rows.filter((r) => {
        if (fCliente !== TODOS && r.cliente_id !== fCliente) return false;
        if (fArea !== TODOS && r.area !== fArea) return false;
        if (!verResueltas && r.estado === "resuelta") return false;
        return true;
      }),
    [rows, fCliente, fArea, verResueltas]
  );

  // El resumen que contesta la pregunta de fondo: qué cuentas se quejan y de
  // qué área. Cuenta TODAS (también las resueltas): una queja resuelta igual
  // pasó.
  const porCuenta = useMemo(() => {
    const m = new Map<
      string,
      { nombre: string; total: number; abiertas: number; areas: Map<string, number> }
    >();
    for (const r of rows) {
      const k = r.cliente_id;
      if (!m.has(k))
        m.set(k, {
          nombre: r.cliente?.nombre ?? "—",
          total: 0,
          abiertas: 0,
          areas: new Map(),
        });
      const v = m.get(k)!;
      v.total++;
      if (r.estado !== "resuelta") v.abiertas++;
      v.areas.set(r.area, (v.areas.get(r.area) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const resueltasOcultas = rows.filter((r) => r.estado === "resuelta").length;

  function cambiarEstado(r: ComplaintRow, estado: ComplaintRow["estado"]) {
    start(async () => {
      const res = await setComplaintEstado(r.id, estado);
      if (res?.error) return void toast.error("No se pudo guardar: " + res.error);
      router.refresh();
    });
  }

  function borrar(r: ComplaintRow) {
    if (!confirm(`¿Borrar la queja de ${r.cliente?.nombre ?? "esta cuenta"}?`)) return;
    start(async () => {
      const res = await deleteComplaint(r.id);
      if (res?.error) return void toast.error("No se pudo borrar: " + res.error);
      toast.success("Queja borrada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Resumen por cuenta */}
      {porCuenta.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {porCuenta.slice(0, 6).map((c) => (
            <button
              key={c.id}
              onClick={() => setFCliente(c.id === fCliente ? TODOS : c.id)}
              className={cn(
                "rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40",
                fCliente === c.id && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{c.nombre}</span>
                <span className="text-sm text-muted-foreground">
                  {c.total} queja{c.total === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {c.abiertas > 0 ? `${c.abiertas} sin resolver · ` : "Todas resueltas · "}
                {[...c.areas.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([a, n]) => `${a} (${n})`)
                  .join(" · ")}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filtros + alta */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={fCliente}
          onChange={(e) => setFCliente(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value={TODOS}>Todas las cuentas</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          value={fArea}
          onChange={(e) => setFArea(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value={TODOS}>Todas las áreas</option>
          {AREAS_QUEJA.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        {resueltasOcultas > 0 && (
          <Button
            variant={verResueltas ? "secondary" : "outline"}
            size="sm"
            onClick={() => setVerResueltas((v) => !v)}
          >
            {verResueltas ? "Ocultar resueltas" : `Ver ${resueltasOcultas} resueltas`}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {filtradas.length} queja{filtradas.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto">
          <NuevaQueja clients={clients} />
        </div>
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay quejas cargadas con estos filtros.
        </p>
      ) : (
        <div className="space-y-2">
          {filtradas.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.cliente?.nombre ?? "—"}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{r.area}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[11px] font-medium",
                    GRAVEDAD_CHIP[r.gravedad]
                  )}
                >
                  {GRAVEDAD_LABEL[r.gravedad]}
                </span>
                <span className="text-xs text-muted-foreground">{r.fecha}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <select
                    value={r.estado}
                    disabled={pending}
                    onChange={(e) =>
                      cambiarEstado(r, e.target.value as ComplaintRow["estado"])
                    }
                    className="h-7 rounded-md border bg-background px-2 text-xs"
                  >
                    {Object.entries(ESTADO_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={pending}
                    onClick={() => borrar(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{r.detalle}</p>
              {r.resolucion && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <b>Se resolvió:</b> {r.resolucion}
                </p>
              )}
              {r.autor && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  La cargó {r.autor.nombre}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NuevaQueja({ clients }: { clients: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [cliente, setCliente] = useState("");
  const [area, setArea] = useState(AREAS_QUEJA[0]);
  const [gravedad, setGravedad] = useState<ComplaintRow["gravedad"]>("media");
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState("");

  function submit() {
    start(async () => {
      const res = await createComplaint({
        cliente_id: cliente,
        area,
        gravedad,
        detalle,
        fecha: fecha || null,
      });
      if (res?.error) return void toast.error("No se pudo guardar: " + res.error);
      toast.success("Queja registrada.");
      setCliente("");
      setDetalle("");
      setFecha("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nueva queja
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva queja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Elegí la cuenta" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS_QUEJA.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gravedad</Label>
              <Select
                value={gravedad}
                onValueChange={(v) => setGravedad(v as ComplaintRow["gravedad"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GRAVEDAD_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="queja-fecha">Cuándo pasó</Label>
            <Input
              id="queja-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Si lo dejás vacío, queda hoy.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="queja-detalle">Qué pasó</Label>
            <Textarea
              id="queja-detalle"
              rows={4}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="Lo que dijo el cliente, en concreto."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !cliente || !detalle.trim()}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
