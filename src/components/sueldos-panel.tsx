"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Copy,
  ChevronLeft,
  ChevronRight,
  Check,
  Percent,
  Sparkles,
  X,
  Users,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fmtARS, periodLabel, prevPeriod, nextPeriod } from "@/lib/finanzas";
import { ROLE_LABEL } from "@/lib/constants";
import { encodeCommissionNote, type PersonPayroll } from "@/lib/payroll";

export type { PersonPayroll } from "@/lib/payroll";

export interface CommissionConfig {
  /** Fracción por cierre (ej: 0.10). */
  cierre: number;
  /** Fracción extra si es lead propio (ej: 0.05). */
  leadPropio: number;
}

export interface CoordinacionConfig {
  /** Comisión base de coordinación (ej: 0.10). */
  pct: number;
  /** Reparto excepcional del mes (vacío = default: todo a cada coordinadora). */
  split: { userId: string; pct: number }[];
}
import {
  addPayrollItem,
  updatePayrollItem,
  deletePayrollItem,
  registerSalaryPayment,
  proposeAdjustments,
  applyAdjustments,
  setCoordinationSplit,
  setPayrollTotal,
} from "@/app/(app)/coordinacion/sueldos/actions";
import type { ProposedAdjustment } from "@/lib/payroll-adjustments";
import { cn } from "@/lib/utils";

interface ClientOption {
  id: string;
  nombre: string;
  abono: number;
}
interface TeamOption {
  id: string;
  nombre: string;
  rol: string;
}

const fmt = (n: number) => fmtARS(n);
const firstName = (n: string) => n.split(" ")[0];

export function SueldosPanel({
  periodo,
  people,
  totalNomina,
  salaryConcepto,
  clientOptions,
  teamOptions,
  commission,
  coordinacion,
}: {
  periodo: string;
  people: PersonPayroll[];
  totalNomina: number;
  salaryConcepto: string;
  clientOptions: ClientOption[];
  teamOptions: TeamOption[];
  commission: CommissionConfig;
  coordinacion: CoordinacionConfig;
}) {
  const router = useRouter();

  function goPeriod(p: string) {
    router.push(`/coordinacion/sueldos?periodo=${p}`);
  }

  return (
    <div className="space-y-5 pb-12">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goPeriod(prevPeriod(periodo))}
            className="rounded-md border p-1.5 hover:bg-muted"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[150px] text-center leading-tight">
            <div className="text-sm font-semibold capitalize">{periodLabel(periodo)}</div>
            <div className="text-[10px] text-muted-foreground">
              trabajado · se paga en{" "}
              <span className="font-medium capitalize">{periodLabel(nextPeriod(periodo))}</span>
            </div>
          </div>
          <button
            onClick={() => goPeriod(nextPeriod(periodo))}
            className="rounded-md border p-1.5 hover:bg-muted"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total nómina
            </div>
            <div className="text-xl font-bold tabular-nums">{fmt(totalNomina)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/finanzas/cobros"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted"
              title="Cuánto te deben los clientes y a quién"
            >
              <Wallet className="h-4 w-4" /> Cuentas por cobrar
            </Link>
            <CoordinacionMesDialog
              periodo={periodo}
              teamOptions={teamOptions}
              coordinacion={coordinacion}
            />
            <AjustesIADialog periodo={periodo} />
            <CommissionDialog periodo={periodo} clientOptions={clientOptions} teamOptions={teamOptions} commission={commission} />
          </div>
        </div>
      </div>

      {/* ── Personas ── */}
      {people.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No hay sueldos para este mes.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {people.map((p) => (
            <PersonCard
              key={p.userId}
              person={p}
              periodo={periodo}
              salaryConcepto={salaryConcepto}
              clientOptions={clientOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tarjeta por persona
// ─────────────────────────────────────────────────────────────────────────
function PersonCard({
  person,
  periodo,
  salaryConcepto,
  clientOptions,
}: {
  person: PersonPayroll;
  periodo: string;
  salaryConcepto: string;
  clientOptions: ClientOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function buildMessage(): string {
    const lines: string[] = [];
    for (const l of person.autoLines) {
      const pref = l.cliente && l.cliente !== "—" ? `${l.cliente} — ` : "";
      lines.push(`• ${pref}${l.concepto}: ${fmt(l.monto)}`);
    }
    for (const it of person.manualItems) {
      const pref = it.cliente ? `${it.cliente} — ` : "";
      lines.push(`• ${pref}${it.concepto}: ${fmt(it.monto)}`);
    }
    return (
      `Hola ${firstName(person.nombre)}! Te paso el detalle de tu pago de ` +
      `${periodLabel(periodo)}:\n\n` +
      lines.join("\n") +
      `\n\nTotal: ${fmt(person.total)}` +
      (person.alias ? `\n\nTransferencia a: ${person.alias}` : "")
    );
  }

  function generarYRegistrar() {
    const msg = buildMessage();
    navigator.clipboard?.writeText(msg).catch(() => {});
    start(async () => {
      const res = await registerSalaryPayment({
        userId: person.userId,
        periodo,
        monto: person.total,
        concepto: salaryConcepto,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Mensaje copiado y pago registrado en Finanzas.");
      router.refresh();
    });
  }

  function removeItem(id: string) {
    start(async () => {
      const res = await deletePayrollItem(id);
      if (res?.error) return void toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="font-semibold">{person.nombre}</div>
          <div className="text-xs text-muted-foreground">{roleLabel(person.rol)}</div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <div className="text-xl font-bold tabular-nums">{fmt(person.total)}</div>
            <SetTotalDialog person={person} periodo={periodo} />
          </div>
          {person.registrado && (
            <span
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                person.pagado
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              )}
            >
              <Check className="h-3 w-3" />
              {person.pagado ? "Pagado" : "Registrado"}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 px-4 py-3">
        {person.autoLines.length > 0 && (
          <ul className="space-y-1 text-sm">
            {person.autoLines.map((l, i) => (
              <li key={i} className="group flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground">
                  {l.cliente && l.cliente !== "—" && (
                    <span className="text-foreground">{l.cliente}</span>
                  )}{" "}
                  <span className="text-xs">{l.concepto}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular-nums">{fmt(l.monto)}</span>
                  <AutoLineAdjust userId={person.userId} periodo={periodo} line={l} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {person.manualItems.length > 0 && (
          <ul className="space-y-1 border-t pt-2 text-sm">
            {person.manualItems.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 text-[9px] font-semibold uppercase",
                      it.tipo === "comision"
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                        : it.tipo === "ajuste"
                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                    )}
                  >
                    {it.tipo}
                  </span>
                  <span className="truncate text-xs">
                    {it.cliente ? `${it.cliente} — ` : ""}
                    {it.concepto}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className={cn("tabular-nums", it.monto < 0 && "text-red-600")}>
                    {fmt(it.monto)}
                  </span>
                  <EditItemDialog item={it} clientOptions={clientOptions} />
                  <button
                    onClick={() => removeItem(it.id)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label="Eliminar ítem"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 border-t px-4 py-2.5">
        <ExtraItemDialog
          userId={person.userId}
          nombre={person.nombre}
          periodo={periodo}
          clientOptions={clientOptions}
        />
        <Link
          href={`/recibo/${person.userId}?periodo=${periodo}`}
          target="_blank"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted"
          title="Ver recibo imprimible / PDF"
        >
          <Receipt className="h-4 w-4" /> Recibo
        </Link>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={generarYRegistrar}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          {person.registrado ? "Copiar y actualizar" : "Mensaje + registrar"}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Diálogo: comisión de cierre (closer / referido)
// ─────────────────────────────────────────────────────────────────────────
function CommissionDialog({
  periodo,
  clientOptions,
  teamOptions,
  commission,
}: {
  periodo: string;
  clientOptions: ClientOption[];
  teamOptions: TeamOption[];
  commission: CommissionConfig;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [clienteId, setClienteId] = useState("");
  const [base, setBase] = useState(0);
  const [closerId, setCloserId] = useState("");
  const [referidoId, setReferidoId] = useState("");

  const pctCierre = commission.cierre;
  const pctLead = commission.leadPropio;
  const pctAmbos = pctCierre + pctLead;
  const lblCierre = Math.round(pctCierre * 100);
  const lblLead = Math.round(pctLead * 100);
  const lblAmbos = Math.round(pctAmbos * 100);

  const cliente = clientOptions.find((c) => c.id === clienteId);
  const sameSame = closerId && referidoId && closerId === referidoId;
  const closerMonto = closerId ? Math.round(base * (sameSame ? pctAmbos : pctCierre)) : 0;
  const referidoMonto = referidoId && !sameSame ? Math.round(base * pctLead) : 0;

  function reset() {
    setClienteId("");
    setBase(0);
    setCloserId("");
    setReferidoId("");
  }

  function submit() {
    if (!closerId && !referidoId) return void toast.error("Elegí al menos un beneficiario.");
    if (base <= 0) return void toast.error("La base (primer mes de abono) debe ser mayor a cero.");
    const cName = cliente?.nombre ?? "cliente";
    start(async () => {
      const calls: Promise<{ error?: string } | { ok: boolean }>[] = [];
      if (sameSame) {
        calls.push(
          addPayrollItem({
            userId: closerId,
            periodo,
            tipo: "comision",
            concepto: `Comisión ${lblAmbos}% (cierre + lead propio) · ${cName}`,
            monto: closerMonto,
            clienteId: clienteId || null,
            notas: encodeCommissionNote("both", base),
          })
        );
      } else {
        if (closerId)
          calls.push(
            addPayrollItem({
              userId: closerId,
              periodo,
              tipo: "comision",
              concepto: `Comisión ${lblCierre}% (cierre) · ${cName}`,
              monto: closerMonto,
              clienteId: clienteId || null,
              notas: encodeCommissionNote("closer", base),
            })
          );
        if (referidoId)
          calls.push(
            addPayrollItem({
              userId: referidoId,
              periodo,
              tipo: "comision",
              concepto: `Comisión ${lblLead}% (lead propio) · ${cName}`,
              monto: referidoMonto,
              clienteId: clienteId || null,
              notas: encodeCommissionNote("ref", base),
            })
          );
      }
      const results = await Promise.all(calls);
      const err = results.find((r) => "error" in r && r.error);
      if (err && "error" in err) return void toast.error(err.error!);
      toast.success("Comisión cargada.");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Percent className="h-4 w-4" /> Comisión
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comisión de cierre</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
            Las comisiones del <strong className="text-foreground">primer mes</strong> se
            cargan <strong className="text-foreground">solas</strong> según quién figura como{" "}
            &ldquo;Cerrado por&rdquo; en la ficha de cada cliente nuevo. Usá esto solo para
            casos especiales: comisión a quien <em>refirió</em> el lead, un cierre que no
            quedó taggeado, o un ajuste manual.
          </div>
          <div>
            <Label>Cliente nuevo</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => {
                setClienteId(v);
                const c = clientOptions.find((x) => x.id === v);
                if (c) setBase(c.abono);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elegí el cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                    {c.abono > 0 ? ` · ${fmt(c.abono)}/mes` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Base (primer mes de abono)</Label>
            <Input
              type="number"
              value={base || ""}
              onChange={(e) => setBase(Number(e.target.value))}
              placeholder="$"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              El % se calcula sobre este monto. Se prellena con el abono mensual
              del cliente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cerró ({lblCierre}%)</Label>
              <PersonSelect value={closerId} onChange={setCloserId} options={teamOptions} />
            </div>
            <div>
              <Label>Lead propio ({lblLead}%)</Label>
              <PersonSelect value={referidoId} onChange={setReferidoId} options={teamOptions} />
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            {!closerId && !referidoId ? (
              <span className="text-muted-foreground">Elegí beneficiario(s).</span>
            ) : sameSame ? (
              <div className="flex items-center justify-between">
                <span>{lblAmbos}% (cierre + lead propio)</span>
                <span className="font-semibold tabular-nums">{fmt(closerMonto)}</span>
              </div>
            ) : (
              <div className="space-y-1">
                {closerId && (
                  <div className="flex items-center justify-between">
                    <span>{lblCierre}% cierre · {nameOf(teamOptions, closerId)}</span>
                    <span className="font-semibold tabular-nums">{fmt(closerMonto)}</span>
                  </div>
                )}
                {referidoId && (
                  <div className="flex items-center justify-between">
                    <span>{lblLead}% lead propio · {nameOf(teamOptions, referidoId)}</span>
                    <span className="font-semibold tabular-nums">{fmt(referidoMonto)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            El <strong>bonus por volumen</strong> (+2% cada 2 cierres del mes,
            tope 6%) se calcula y suma solo al cerrar el mes, automáticamente,
            según los cierres cargados acá.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cargar comisión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Diálogo: reparto de coordinación del mes (excepción)
// ─────────────────────────────────────────────────────────────────────────
function CoordinacionMesDialog({
  periodo,
  teamOptions,
  coordinacion,
}: {
  periodo: string;
  teamOptions: TeamOption[];
  coordinacion: CoordinacionConfig;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // Modo: false = default (todo a cada coordinadora); true = reparto del mes.
  const [reparte, setReparte] = useState(coordinacion.split.length > 0);
  // Filas como % (share) del pool de coordinación; arranca con el split guardado.
  const [rows, setRows] = useState<{ userId: string; share: number }[]>(
    coordinacion.split.length > 0
      ? coordinacion.split.map((s) => ({ userId: s.userId, share: Math.round(s.pct * 100) }))
      : [{ userId: "", share: 50 }, { userId: "", share: 50 }]
  );

  const basePct = Math.round(coordinacion.pct * 100);
  const sumShare = rows.reduce((a, r) => a + (Number(r.share) || 0), 0);

  function resync() {
    setReparte(coordinacion.split.length > 0);
    setRows(
      coordinacion.split.length > 0
        ? coordinacion.split.map((s) => ({ userId: s.userId, share: Math.round(s.pct * 100) }))
        : [{ userId: "", share: 50 }, { userId: "", share: 50 }]
    );
  }

  function save() {
    const split = reparte
      ? rows
          .filter((r) => r.userId && r.share > 0)
          .map((r) => ({ userId: r.userId, pct: r.share / 100 }))
      : [];
    if (reparte) {
      if (split.length === 0)
        return void toast.error("Agregá al menos una persona con su porcentaje.");
      const ids = split.map((s) => s.userId);
      if (new Set(ids).size !== ids.length)
        return void toast.error("Hay una persona repetida en el reparto.");
    }
    start(async () => {
      const res = await setCoordinationSplit({ periodo, split });
      if (res?.error) return void toast.error(res.error);
      toast.success(
        reparte ? "Reparto de coordinación guardado para el mes." : "Coordinación vuelta al default."
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) resync();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Users className="h-4 w-4" /> Coordinación
          {coordinacion.split.length > 0 && (
            <span className="ml-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              reparto
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Coordinación de {periodLabel(periodo)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            La comisión de coordinación es el <strong>{basePct}%</strong> del abono
            de cada cuenta con gestión de redes. Normalmente la cobra entera la
            coordinadora de cada cuenta. Si este mes el rol se repartió, indicá cómo
            se divide ese {basePct}% (solo afecta a {periodLabel(periodo)}).
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setReparte(false)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-sm",
                !reparte ? "border-primary bg-primary/10" : "text-muted-foreground"
              )}
            >
              Default ({basePct}% a c/coordinadora)
            </button>
            <button
              onClick={() => setReparte(true)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-sm",
                reparte ? "border-primary bg-primary/10" : "text-muted-foreground"
              )}
            >
              Repartir este mes
            </button>
          </div>

          {reparte && (
            <div className="space-y-2">
              {rows.map((row, i) => {
                const efectivo = ((coordinacion.pct * (Number(row.share) || 0)) / 100) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <PersonSelect
                        value={row.userId}
                        onChange={(v) =>
                          setRows(rows.map((r, j) => (j === i ? { ...r, userId: v } : r)))
                        }
                        options={teamOptions}
                      />
                    </div>
                    <div className="flex w-24 items-center gap-1">
                      <Input
                        type="number"
                        value={row.share || ""}
                        onChange={(e) =>
                          setRows(
                            rows.map((r, j) =>
                              j === i ? { ...r, share: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="h-9"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                      ={efectivo % 1 === 0 ? efectivo : efectivo.toFixed(1)}%
                    </span>
                    {rows.length > 1 && (
                      <button
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-red-600"
                        aria-label="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs"
                  onClick={() => setRows([...rows, { userId: "", share: 0 }])}
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar persona
                </Button>
                <span
                  className={cn(
                    "text-xs",
                    sumShare === 100 ? "text-emerald-600" : "text-amber-600"
                  )}
                >
                  Suma: {sumShare}% {sumShare !== 100 && "(ideal 100%)"}
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Diálogo: extra / ajuste manual para una persona
// ─────────────────────────────────────────────────────────────────────────
function ExtraItemDialog({
  userId,
  nombre,
  periodo,
  clientOptions,
}: {
  userId: string;
  nombre: string;
  periodo: string;
  clientOptions: ClientOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [tipo, setTipo] = useState<"extra" | "ajuste">("extra");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState(0);
  const [clienteId, setClienteId] = useState("");

  function reset() {
    setConcepto("");
    setMonto(0);
    setClienteId("");
  }

  // seguir=true → deja el diálogo abierto para cargar otro ítem (útil para
  // desgloses largos: coordinación + varias cuentas + manuales, de corrido).
  function submit(seguir: boolean) {
    if (!concepto.trim()) return void toast.error("Escribí un concepto.");
    if (!monto) return void toast.error("El monto no puede ser cero.");
    // "Descuento" resta: guardamos el monto en negativo. "Suma" en positivo.
    const signed = tipo === "ajuste" ? -Math.abs(monto) : Math.abs(monto);
    start(async () => {
      const res = await addPayrollItem({
        userId,
        periodo,
        tipo,
        concepto: concepto.trim(),
        monto: signed,
        clienteId: clienteId || null,
      });
      if (res?.error) return void toast.error(res.error);
      const cli = clientOptions.find((c) => c.id === clienteId);
      toast.success(`Sumado: ${concepto.trim()}${cli ? ` (${cli.nombre})` : ""}.`);
      reset();
      if (!seguir) setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" /> Agregar ítem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar ítem a {firstName(nombre)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block">¿Suma o descuenta?</Label>
            <div className="flex gap-2">
              {(
                [
                  { t: "extra" as const, label: "Suma (+)" },
                  { t: "ajuste" as const, label: "Descuento (−)" },
                ]
              ).map(({ t, label }) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm",
                    tipo === t ? "border-primary bg-primary/10" : "text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {tipo === "extra"
                ? "Se suma al sueldo (ej: un manual, videos extra, comisión de una cuenta)."
                : "Se resta del sueldo (ej: un adelanto que ya le diste)."}
            </p>
          </div>
          <div>
            <Label>¿Por qué? (concepto)</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={tipo === "ajuste" ? "Ej: adelanto de sueldo" : "Ej: manual de marca · coordinación · 2 reels"}
            />
          </div>
          <div>
            <Label>Monto (siempre en positivo)</Label>
            <Input type="number" value={monto || ""} onChange={(e) => setMonto(Math.abs(Number(e.target.value)))} placeholder="$" />
          </div>
          <div>
            <Label>¿A qué cuenta se atribuye? (opcional)</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin cuenta (general)" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sirve para saber qué cuenta te cuesta cuánto (Rentabilidad). Dejalo
              en &quot;general&quot; si no aplica a una cuenta puntual.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => submit(true)} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar y seguir
          </Button>
          <Button onClick={() => submit(false)} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agregar y cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Ajustar una línea AUTOMÁTICA (calculada): corregir su monto o quitarla.
// No edita el cálculo: crea un ajuste manual que compensa la diferencia, así
// queda trazable y solo afecta este período.
// ─────────────────────────────────────────────────────────────────────────
function AutoLineAdjust({
  userId,
  periodo,
  line,
}: {
  userId: string;
  periodo: string;
  line: { clienteId: string | null; cliente: string; concepto: string; monto: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nuevo, setNuevo] = useState<string>(String(line.monto));
  const [pending, start] = useTransition();

  function aplicar(nuevoMonto: number) {
    const delta = Math.round(nuevoMonto - line.monto);
    if (delta === 0) {
      setOpen(false);
      return;
    }
    const concepto =
      nuevoMonto === 0
        ? `Se quita: ${line.concepto}`
        : `Corrección: ${line.concepto}`;
    start(async () => {
      const res = await addPayrollItem({
        userId,
        periodo,
        tipo: "ajuste",
        concepto,
        monto: delta,
        clienteId: line.clienteId,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success(nuevoMonto === 0 ? "Línea quitada (ajuste)." : "Monto corregido (ajuste).");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          aria-label="Ajustar esta línea"
          title="Corregir o quitar esta línea"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2">
        <div className="text-xs font-semibold">Ajustar línea automática</div>
        <p className="text-[11px] text-muted-foreground">
          {line.concepto}
          {line.cliente && line.cliente !== "—" ? ` · ${line.cliente}` : ""} —
          calculada en <b>{fmt(line.monto)}</b>. Corregí el monto o quitala; se
          registra como un ajuste de este mes.
        </p>
        <Label className="text-xs">Monto correcto</Label>
        <Input
          type="number"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
            disabled={pending}
            onClick={() => aplicar(0)}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Quitar
          </Button>
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={pending || nuevo === ""}
            onClick={() => aplicar(Number(nuevo))}
          >
            {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Corregir
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Fijar el TOTAL final del sueldo de una persona (forma fácil de "editar el
// sueldo entero"). No pisa el cálculo: crea/actualiza un único ajuste de
// conciliación que cierra la diferencia. Volver a fijarlo lo recalcula.
// ─────────────────────────────────────────────────────────────────────────
function SetTotalDialog({
  person,
  periodo,
}: {
  person: PersonPayroll;
  periodo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [valor, setValor] = useState<string>(String(Math.round(person.total)));

  const target = Number(valor);
  const valido = valor !== "" && Number.isFinite(target) && target >= 0;
  const delta = valido ? Math.round(target - person.total) : 0;

  function guardar() {
    if (!valido) return void toast.error("Poné un total válido.");
    start(async () => {
      const res = await setPayrollTotal({
        userId: person.userId,
        periodo,
        currentTotal: person.total,
        target: Math.round(target),
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Total del sueldo fijado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValor(String(Math.round(person.total)));
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground"
          aria-label="Fijar el total del sueldo"
          title="Fijar el total del sueldo"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-2">
        <div className="text-xs font-semibold">Fijar total del sueldo</div>
        <p className="text-[11px] text-muted-foreground">
          Poné el total que le vas a pagar a <b>{firstName(person.nombre)}</b> este mes.
          No se toca el cálculo: se agrega un ajuste que cierra la diferencia.
          Calculado hoy: <b>{fmt(person.total)}</b>.
        </p>
        <Label className="text-xs">Total a pagar</Label>
        <Input
          type="number"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="h-8 text-sm"
        />
        {valido && delta !== 0 && (
          <p className="text-[11px] text-muted-foreground">
            Se cargará un ajuste de{" "}
            <span className={cn("font-medium tabular-nums", delta < 0 && "text-red-600")}>
              {delta > 0 ? "+" : ""}
              {fmt(delta)}
            </span>{" "}
            para llegar a {fmt(target)}.
          </p>
        )}
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            disabled={pending || !valido}
            onClick={guardar}
          >
            {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Fijar total
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Diálogo: editar un ítem manual existente
// ─────────────────────────────────────────────────────────────────────────
function EditItemDialog({
  item,
  clientOptions,
}: {
  item: PersonPayroll["manualItems"][number];
  clientOptions: ClientOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [concepto, setConcepto] = useState(item.concepto);
  const [monto, setMonto] = useState(item.monto);
  const [clienteId, setClienteId] = useState(item.clienteId ?? "");

  function submit() {
    if (!concepto.trim()) return void toast.error("Escribí un concepto.");
    if (!monto) return void toast.error("El monto no puede ser cero.");
    start(async () => {
      const res = await updatePayrollItem({
        id: item.id,
        concepto: concepto.trim(),
        monto,
        clienteId: clienteId || null,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Ítem actualizado.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          // Re-sincronizar al abrir, por si el ítem cambió.
          setConcepto(item.concepto);
          setMonto(item.monto);
          setClienteId(item.clienteId ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-primary"
          aria-label="Editar ítem"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar ítem ({item.tipo})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Concepto</Label>
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} />
          </div>
          <div>
            <Label>Monto {item.tipo === "ajuste" && "(puede ser negativo)"}</Label>
            <Input
              type="number"
              value={monto || ""}
              onChange={(e) => setMonto(Number(e.target.value))}
              placeholder="$"
            />
          </div>
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
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Diálogo: ajustes del mes con IA (criollo → ítems → preview → aplicar)
// ─────────────────────────────────────────────────────────────────────────
function AjustesIADialog({ periodo }: { periodo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [texto, setTexto] = useState("");
  const [items, setItems] = useState<ProposedAdjustment[] | null>(null);
  const [nota, setNota] = useState("");

  function reset() {
    setTexto("");
    setItems(null);
    setNota("");
  }

  function proponer() {
    if (!texto.trim()) return void toast.error("Escribí qué ajustes querés cargar.");
    start(async () => {
      const res = await proposeAdjustments({ periodo, instrucciones: texto });
      if (res?.error) return void toast.error(res.error);
      if (res?.ok) {
        setItems(res.items);
        setNota(res.nota ?? "");
      }
    });
  }

  function aplicar() {
    if (!items || items.length === 0) return;
    start(async () => {
      const res = await applyAdjustments({ periodo, items });
      if (res?.error) return void toast.error(res.error);
      toast.success(`${res?.count ?? items.length} ítem(s) cargado(s).`);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  const total = items?.reduce((a, it) => a + it.monto, 0) ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Sparkles className="h-4 w-4" /> Ajustes con IA
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustes del mes con IA</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Escribí en criollo los extras y ajustes del mes y la IA los arma. Ej:
            <em>
              {" "}
              &ldquo;a Brisa sumale 20 mil por carruseles extra, a Guille
              descontale un adelanto de 50 mil&rdquo;
            </em>
            . Revisás antes de aplicar.
          </p>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder="Ej: a Luz un premio de 30 mil por el cierre de mes…"
            disabled={pending}
          />

          {items && (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-2">
              {nota && (
                <p className="px-1 text-[11px] italic text-muted-foreground">{nota}</p>
              )}
              {items.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">
                  No quedaron ítems. Editá el texto y proponé de nuevo.
                </p>
              ) : (
                <ul className="space-y-1">
                  {items.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 rounded bg-card px-2 py-1.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "shrink-0 rounded px-1 text-[9px] font-semibold uppercase",
                            it.tipo === "ajuste"
                              ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                          )}
                        >
                          {it.tipo}
                        </span>
                        <span className="truncate">
                          <span className="font-medium">{firstName(it.nombre)}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            {it.cliente ? `${it.cliente} — ` : ""}
                            {it.concepto}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className={cn("tabular-nums", it.monto < 0 && "text-red-600")}>
                          {fmt(it.monto)}
                        </span>
                        <button
                          onClick={() => setItems(items.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-red-600"
                          aria-label="Quitar de la propuesta"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {items.length > 0 && (
                <div className="flex items-center justify-between border-t px-1 pt-1.5 text-sm font-semibold">
                  <span>Total a cargar</span>
                  <span className="tabular-nums">{fmt(total)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {items && items.length > 0 ? (
            <>
              <Button variant="outline" onClick={() => setItems(null)} disabled={pending}>
                Volver
              </Button>
              <Button onClick={aplicar} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aplicar {items.length} ítem(s)
              </Button>
            </>
          ) : (
            <Button onClick={proponer} disabled={pending}>
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Proponer ítems
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────
function PersonSelect({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: TeamOption[];
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function nameOf(options: TeamOption[], id: string): string {
  return options.find((o) => o.id === id)?.nombre ?? "—";
}

function roleLabel(rol: string): string {
  return ROLE_LABEL[rol as keyof typeof ROLE_LABEL] ?? rol;
}
