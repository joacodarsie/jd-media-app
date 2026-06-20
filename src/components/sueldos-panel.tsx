"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Check,
  Percent,
} from "lucide-react";
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
import {
  addPayrollItem,
  deletePayrollItem,
  registerSalaryPayment,
} from "@/app/(app)/coordinacion/sueldos/actions";
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
}: {
  periodo: string;
  people: PersonPayroll[];
  totalNomina: number;
  salaryConcepto: string;
  clientOptions: ClientOption[];
  teamOptions: TeamOption[];
  commission: CommissionConfig;
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
          <div className="min-w-[140px] text-center text-sm font-semibold capitalize">
            {periodLabel(periodo)}
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
          <div className="flex items-center gap-2">
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
          <div className="text-xl font-bold tabular-nums">{fmt(person.total)}</div>
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
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-muted-foreground">
                  {l.cliente && l.cliente !== "—" && (
                    <span className="text-foreground">{l.cliente}</span>
                  )}{" "}
                  <span className="text-xs">{l.concepto}</span>
                </span>
                <span className="shrink-0 tabular-nums">{fmt(l.monto)}</span>
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
        <Button
          size="sm"
          className="ml-auto gap-1.5"
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

  function submit() {
    if (!concepto.trim()) return void toast.error("Escribí un concepto.");
    if (!monto) return void toast.error("El monto no puede ser cero.");
    start(async () => {
      const res = await addPayrollItem({
        userId,
        periodo,
        tipo,
        concepto: concepto.trim(),
        monto,
        clienteId: clienteId || null,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Ítem agregado.");
      setConcepto("");
      setMonto(0);
      setClienteId("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" /> Extra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ítem para {firstName(nombre)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["extra", "ajuste"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-1.5 text-sm capitalize",
                  tipo === t ? "border-primary bg-primary/10" : "text-muted-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div>
            <Label>Concepto</Label>
            <Input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={tipo === "ajuste" ? "Ej: descuento adelanto" : "Ej: carruseles extra"}
            />
          </div>
          <div>
            <Label>Monto {tipo === "ajuste" && "(puede ser negativo)"}</Label>
            <Input type="number" value={monto || ""} onChange={(e) => setMonto(Number(e.target.value))} placeholder="$" />
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
            Agregar
          </Button>
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
