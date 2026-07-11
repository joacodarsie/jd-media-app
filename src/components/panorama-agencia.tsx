"use client";

// Panorama de la agencia: el Excel de Leo hecho pantalla. Arriba el resumen
// (entra / sale / queda), abajo la planilla editable de cuentas y costos fijos.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, TrendingUp, Info } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtARS, periodLabel } from "@/lib/finanzas";
import { cn } from "@/lib/utils";
import { updateClientAbono } from "@/app/(app)/finanzas/panorama/actions";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  type SubscriptionInput,
} from "@/app/(app)/finanzas/suscripciones/actions";

export interface PanoramaData {
  periodo: string;
  usd: number;
  usdSource: "live" | "fallback";
  ingresosRecurrentes: number;
  ingresosExtraordinarios: number;
  costosOperativos: number;
  costosFijos: number;
  cuentas: {
    clienteId: string;
    nombre: string;
    serviceId: string | null;
    abono: number;
    extra: number;
    coordinador: string | null;
    acuerdoFijo: boolean;
  }[];
  fijos: {
    id: string;
    nombre: string;
    categoria: string;
    costo: number;
    moneda: string;
    ciclo: string;
    activa: boolean;
    montoMensualARS: number;
  }[];
}

const CATEGORIA_LABEL: Record<string, string> = {
  plataformas: "Plataformas",
  ads: "Publicidad propia",
  servicios: "Servicios",
  impuestos: "Impuestos",
  bancos: "Bancos",
  oficina: "Oficina",
  equipamiento: "Equipamiento",
  otros: "Otros",
};

const fmt = (n: number) => fmtARS(n);

export function PanoramaAgencia({ data }: { data: PanoramaData }) {
  const ingresosTotal = data.ingresosRecurrentes + data.ingresosExtraordinarios;
  const costosTotal = data.costosOperativos + data.costosFijos;
  const neto = ingresosTotal - costosTotal;
  const margen = ingresosTotal > 0 ? (neto / ingresosTotal) * 100 : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* ── PANEL RESUMEN ── */}
      <section className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Resumen del mes</h2>
            <p className="text-xs capitalize text-muted-foreground">{periodLabel(data.periodo)}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
            Dólar cripto {fmt(data.usd)}{" "}
            {data.usdSource === "fallback" ? "(estimado)" : "(USDC en vivo)"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Entra (abonos)" value={fmt(data.ingresosRecurrentes)} tone="good" />
          <Stat
            label="Extraordinarios"
            value={fmt(data.ingresosExtraordinarios)}
            sub="proyectos / branding"
          />
          <Stat label="Equipo (nómina)" value={fmt(data.costosOperativos)} tone="bad" />
          <Stat label="Costos fijos" value={fmt(data.costosFijos)} tone="bad" />
          <Stat
            label="Te queda (neto)"
            value={fmt(neto)}
            sub={`margen ${Math.round(margen)}%`}
            tone={neto >= 0 ? "good" : "bad"}
            strong
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>
            Ingresos {fmt(ingresosTotal)} − Equipo {fmt(data.costosOperativos)} − Fijos{" "}
            {fmt(data.costosFijos)} = <b className="text-foreground">{fmt(neto)}</b>
          </span>
          <Link
            href="/finanzas/rentabilidad"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Ver margen por cuenta
          </Link>
        </div>
      </section>

      {/* ── PLANILLA: CUENTAS ── */}
      <CuentasGrid cuentas={data.cuentas} recurrentes={data.ingresosRecurrentes} />

      {/* ── PLANILLA: COSTOS FIJOS ── */}
      <FijosGrid fijos={data.fijos} total={data.costosFijos} usd={data.usd} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function CuentasGrid({
  cuentas,
  recurrentes,
}: {
  cuentas: PanoramaData["cuentas"];
  recurrentes: number;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Cuentas · gestión de redes</h2>
        <p className="text-xs text-muted-foreground">
          El abono de cada cuenta. Tocá el número para editarlo — se guarda solo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Cuenta</th>
              <th className="px-2 py-2 text-right font-medium">Abono / mes</th>
              <th className="px-2 py-2 text-right font-medium">Extra (único)</th>
              <th className="px-4 py-2 font-medium">Coordina</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((c) => (
              <tr key={c.clienteId} className="border-b last:border-0 odd:bg-muted/20">
                <td className="px-4 py-1.5 font-medium">
                  {c.nombre}
                  {c.acuerdoFijo && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1 text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      acuerdo fijo
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AbonoCell serviceId={c.serviceId} abono={c.abono} />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {c.extra > 0 ? fmt(c.extra) : "—"}
                </td>
                <td className="px-4 py-1.5 text-muted-foreground">{c.coordinador ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-4 py-2">Total abonos</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmt(recurrentes)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function AbonoCell({ serviceId, abono }: { serviceId: string | null; abono: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(abono));

  if (!serviceId) {
    return <span className="tabular-nums text-muted-foreground">{fmt(abono)}</span>;
  }

  function guardar() {
    const monto = Number(valor);
    if (!Number.isFinite(monto) || monto < 0) {
      setValor(String(abono));
      setEditing(false);
      return;
    }
    if (Math.round(monto) === Math.round(abono)) {
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await updateClientAbono(serviceId!, monto);
      if (res?.error) {
        toast.error(res.error);
        setValor(String(abono));
      } else {
        toast.success("Abono actualizado.");
        router.refresh();
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <Input
          type="number"
          value={valor}
          autoFocus
          disabled={pending}
          onChange={(e) => setValor(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") {
              setValor(String(abono));
              setEditing(false);
            }
          }}
          className="h-7 w-28 text-right text-sm tabular-nums"
        />
        {pending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        setValor(String(abono));
        setEditing(true);
      }}
      className="rounded px-1.5 py-0.5 tabular-nums hover:bg-primary/10 hover:ring-1 hover:ring-primary/30"
      title="Editar abono"
    >
      {fmt(abono)}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function FijosGrid({
  fijos,
  total,
  usd,
}: {
  fijos: PanoramaData["fijos"];
  total: number;
  usd: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle(f: PanoramaData["fijos"][number]) {
    start(async () => {
      const res = await updateSubscription(f.id, subInput(f, { activa: !f.activa }));
      if (res?.error) return void toast.error(res.error);
      router.refresh();
    });
  }
  function remove(f: PanoramaData["fijos"][number]) {
    start(async () => {
      const res = await deleteSubscription(f.id);
      if (res?.error) return void toast.error(res.error);
      toast.success("Costo fijo eliminado.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Costos fijos</h2>
          <p className="text-xs text-muted-foreground">
            Suscripciones e impuestos que salen todos los meses. Los de dólar se
            convierten a {fmt(usd)} c/u.
          </p>
        </div>
        <FijoDialog />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Concepto</th>
              <th className="px-2 py-2 font-medium">Rubro</th>
              <th className="px-2 py-2 text-right font-medium">Costo</th>
              <th className="px-2 py-2 text-right font-medium">/ mes (ARS)</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {fijos.map((f) => (
              <tr
                key={f.id}
                className={cn(
                  "group border-b last:border-0 odd:bg-muted/20",
                  !f.activa && "opacity-50"
                )}
              >
                <td className="px-4 py-1.5 font-medium">{f.nombre}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground">
                  {CATEGORIA_LABEL[f.categoria] ?? f.categoria}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                  {f.moneda === "USD" ? "US$" : "$"}
                  {f.costo.toLocaleString("es-AR")}
                  {f.ciclo !== "mensual" && (
                    <span className="ml-1 text-[10px]">/{f.ciclo === "anual" ? "año" : "trim"}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                  {f.activa ? fmt(f.montoMensualARS) : "—"}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => toggle(f)}
                      disabled={pending}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      title={f.activa ? "Pausar" : "Activar"}
                    >
                      {f.activa ? "Pausar" : "Activar"}
                    </button>
                    <button
                      onClick={() => remove(f)}
                      disabled={pending}
                      className="text-muted-foreground hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="px-4 py-2" colSpan={3}>
                Total fijos / mes
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{fmt(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Estos costos ya se descuentan de la ganancia real en la pantalla de
        Finanzas.
      </p>
    </section>
  );
}

/** Arma el SubscriptionInput completo desde una fila, con overrides opcionales. */
function subInput(
  f: PanoramaData["fijos"][number],
  over: Partial<SubscriptionInput> = {}
): SubscriptionInput {
  return {
    nombre: f.nombre,
    categoria: f.categoria as SubscriptionInput["categoria"],
    costo: f.costo,
    moneda: f.moneda,
    ciclo: f.ciclo as SubscriptionInput["ciclo"],
    activa: f.activa,
    ...over,
  };
}

function FijoDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [nombre, setNombre] = useState("");
  const [costo, setCosto] = useState(0);
  const [moneda, setMoneda] = useState("ARS");
  const [categoria, setCategoria] = useState("plataformas");

  function reset() {
    setNombre("");
    setCosto(0);
    setMoneda("ARS");
    setCategoria("plataformas");
  }

  function submit() {
    if (!nombre.trim()) return void toast.error("Poné un nombre.");
    if (!costo || costo <= 0) return void toast.error("Costo inválido.");
    start(async () => {
      const res = await createSubscription({
        nombre: nombre.trim(),
        categoria: categoria as SubscriptionInput["categoria"],
        costo,
        moneda,
        ciclo: "mensual",
        activa: true,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Costo fijo agregado.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" /> Agregar fijo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar costo fijo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Concepto</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Notion" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Costo mensual</Label>
              <Input
                type="number"
                value={costo || ""}
                onChange={(e) => setCosto(Number(e.target.value))}
                placeholder="$"
              />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">Pesos (ARS)</SelectItem>
                  <SelectItem value="USD">Dólares (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Rubro</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIA_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Stat({
  label,
  value,
  sub,
  tone,
  strong,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
  strong?: boolean;
}) {
  return (
    <div className={cn("bg-card p-3", strong && "bg-primary/5")}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-bold tabular-nums",
          strong ? "text-xl" : "text-lg",
          tone === "good" && "text-emerald-600",
          tone === "bad" && "text-red-600"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
