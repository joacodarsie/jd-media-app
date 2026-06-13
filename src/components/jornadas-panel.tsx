"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, Users, MapPin, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtARS } from "@/lib/finanzas";
import {
  createProductionSession,
  updateProductionSession,
  deleteProductionSession,
  type JornadaInput,
} from "@/app/(app)/coordinacion/jornadas/actions";
import { cn } from "@/lib/utils";

export interface Jornada {
  id: string;
  fecha: string;
  periodo: string;
  monto: number;
  clienteId: string | null;
  cliente: string | null;
  lugar: string | null;
  notas: string | null;
  asistentes: string[];
}
interface TeamOption {
  id: string;
  nombre: string;
  rol: string;
}
interface ClientOption {
  id: string;
  nombre: string;
}

const fmt = (n: number) => fmtARS(n);
const firstName = (n: string) => n.split(" ")[0];

function fmtFecha(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function JornadasPanel({
  jornadas,
  team,
  clientOptions,
}: {
  jornadas: Jornada[];
  team: TeamOption[];
  clientOptions: ClientOption[];
}) {
  const nameById = new Map(team.map((t) => [t.id, t.nombre]));
  const total = jornadas.reduce((a, j) => a + j.monto, 0);

  return (
    <div className="space-y-5 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {jornadas.length} {jornadas.length === 1 ? "jornada" : "jornadas"} · total cobrado
          </div>
          <div className="text-xl font-bold tabular-nums">{fmt(total)}</div>
        </div>
        <JornadaDialog team={team} clientOptions={clientOptions} />
      </div>

      {jornadas.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Todavía no cargaste ninguna jornada. Tocá “Nueva jornada”.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jornadas.map((j) => (
            <JornadaCard key={j.id} jornada={j} nameById={nameById} team={team} clientOptions={clientOptions} />
          ))}
        </div>
      )}
    </div>
  );
}

function JornadaCard({
  jornada,
  nameById,
  team,
  clientOptions,
}: {
  jornada: Jornada;
  nameById: Map<string, string>;
  team: TeamOption[];
  clientOptions: ClientOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const n = jornada.asistentes.length;
  const porPersona = n > 0 ? Math.round(jornada.monto / n) : 0;

  function remove() {
    if (!confirm("¿Eliminar esta jornada? Se descontará de la nómina del mes.")) return;
    start(async () => {
      const res = await deleteProductionSession(jornada.id);
      if (res?.error) return void toast.error(res.error);
      toast.success("Jornada eliminada.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            {fmtFecha(jornada.fecha)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {jornada.cliente && <span>{jornada.cliente}</span>}
            {jornada.lugar && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {jornada.lugar}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums">{fmt(jornada.monto)}</div>
          <div className="text-[11px] text-muted-foreground">{fmt(porPersona)} c/u</div>
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Asistentes ({n})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {jornada.asistentes.map((id) => (
            <span
              key={id}
              className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
            >
              {firstName(nameById.get(id) ?? "—")}
            </span>
          ))}
        </div>
        {jornada.notas && (
          <p className="mt-2 text-xs italic text-muted-foreground">{jornada.notas}</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-2.5">
        <JornadaDialog team={team} clientOptions={clientOptions} jornada={jornada} />
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto gap-1.5 text-muted-foreground hover:text-red-600"
          onClick={remove}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Eliminar
        </Button>
      </div>
    </div>
  );
}

function JornadaDialog({
  team,
  clientOptions,
  jornada,
}: {
  team: TeamOption[];
  clientOptions: ClientOption[];
  jornada?: Jornada;
}) {
  const router = useRouter();
  const editing = !!jornada;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const [fecha, setFecha] = useState(jornada?.fecha ?? today);
  const [monto, setMonto] = useState(jornada?.monto ?? 50000);
  const [clienteId, setClienteId] = useState(jornada?.clienteId ?? "");
  const [lugar, setLugar] = useState(jornada?.lugar ?? "");
  const [notas, setNotas] = useState(jornada?.notas ?? "");
  const [asistentes, setAsistentes] = useState<string[]>(jornada?.asistentes ?? []);

  const porPersona = asistentes.length > 0 ? Math.round(monto / asistentes.length) : 0;

  function toggle(id: string) {
    setAsistentes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function submit() {
    const input: JornadaInput = {
      fecha,
      monto,
      clienteId: clienteId || null,
      lugar: lugar || null,
      notas: notas || null,
      asistentes,
    };
    start(async () => {
      const res = editing
        ? await updateProductionSession(jornada!.id, input)
        : await createProductionSession(input);
      if (res?.error) return void toast.error(res.error);
      toast.success(editing ? "Jornada actualizada." : "Jornada cargada.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant="outline" className="gap-1.5">
            <Pencil className="h-4 w-4" /> Editar
          </Button>
        ) : (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nueva jornada
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar jornada" : "Nueva jornada de producción"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Monto cobrado</Label>
              <Input
                type="number"
                value={monto || ""}
                onChange={(e) => setMonto(Number(e.target.value))}
                placeholder="$"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente (opcional)</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lugar (opcional)</Label>
              <Input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej: Córdoba" />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label>Asistentes</Label>
              {asistentes.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {fmt(porPersona)} por persona
                </span>
              )}
            </div>
            <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border p-2">
              {team.map((t) => (
                <label
                  key={t.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm",
                    asistentes.includes(t.id) ? "bg-primary/10" : "hover:bg-muted"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={asistentes.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="truncate">{firstName(t.nombre)}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Notas (opcional)</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Detalle de la jornada" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Guardar" : "Cargar jornada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
