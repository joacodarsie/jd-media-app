"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote,
  X,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Plus,
  Search,
  ChevronsUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORIES } from "@/components/expense-form-dialog";
import {
  quickClientPending,
  quickUserPending,
  quickIncome,
  quickTeamPay,
  quickExpensePaid,
  markInvoicePaid,
  markPaymentPaid,
  type QuickPendingItem,
  type ExpenseCategory,
} from "@/app/(app)/finanzas/actions";
import { cn } from "@/lib/utils";

type Mini = { id: string; nombre: string };

type Direccion = "in" | "out";
type Salida = "equipo" | "gasto";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(n: number, moneda: string) {
  return `${moneda} ${Math.round(n).toLocaleString("es-AR")}`;
}

/** Selector con búsqueda (combobox) para listas que pueden crecer. */
function Combo({
  items,
  value,
  onChange,
  placeholder,
  clearable,
}: {
  items: Mini[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = items.find((i) => i.id === value);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((i) => i.nombre.toLowerCase().includes(qq));
  }, [items, q]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.nombre : placeholder}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar…"
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {clearable && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/50"
            >
              Sin cliente
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Sin coincidencias.
            </div>
          ) : (
            filtered.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => {
                  onChange(i.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="truncate">{i.nombre}</span>
                {i.id === value && <Check className="h-3.5 w-3.5 text-emerald-600" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function QuickCashLauncher({
  clients,
  users,
}: {
  clients: Mini[];
  users: Mini[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  const [dir, setDir] = useState<Direccion>("in");
  const [salida, setSalida] = useState<Salida>("gasto");

  // Selección de contraparte
  const [clienteId, setClienteId] = useState("");
  const [userId, setUserId] = useState("");
  const [pendientes, setPendientes] = useState<QuickPendingItem[] | null>(null);
  const [loadingPend, setLoadingPend] = useState(false);

  // Form genérico
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState("ARS");
  const [concepto, setConcepto] = useState("");
  const [fecha, setFecha] = useState(today());
  // Solo gasto
  const [categoria, setCategoria] = useState<ExpenseCategory>("plataformas");
  const [proveedor, setProveedor] = useState("");
  const [gastoClienteId, setGastoClienteId] = useState(""); // imputar a cliente (opcional)

  // Cerrar al clickear afuera / Esc
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    // pequeño delay para no capturar el click que abre el panel
    const t = setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Cargar pendientes al elegir contraparte
  useEffect(() => {
    const id = dir === "in" ? clienteId : salida === "equipo" ? userId : "";
    if (!id) {
      setPendientes(null);
      return;
    }
    let cancel = false;
    setLoadingPend(true);
    (dir === "in" ? quickClientPending(id) : quickUserPending(id))
      .then((rows) => {
        if (!cancel) setPendientes(rows);
      })
      .finally(() => {
        if (!cancel) setLoadingPend(false);
      });
    return () => {
      cancel = true;
    };
  }, [dir, salida, clienteId, userId]);

  function resetForm() {
    setMonto("");
    setConcepto("");
    setProveedor("");
    setGastoClienteId("");
    setFecha(today());
  }

  function afterSave(msg: string) {
    toast.success(msg);
    resetForm();
    // refrescamos pendientes y datos de finanzas
    router.refresh();
    const id = dir === "in" ? clienteId : userId;
    if (id) {
      (dir === "in" ? quickClientPending(id) : quickUserPending(id)).then(
        setPendientes
      );
    }
  }

  function settle(item: QuickPendingItem) {
    start(async () => {
      const res =
        dir === "in"
          ? await markInvoicePaid(item.id, today())
          : await markPaymentPaid(item.id, today());
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      afterSave(dir === "in" ? "Cobro registrado ✓" : "Pago registrado ✓");
    });
  }

  function saveNew() {
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) return toast.error("Poné un monto válido.");

    if (dir === "in") {
      if (!clienteId) return toast.error("Elegí de quién cobraste.");
      start(async () => {
        const res = await quickIncome({
          cliente_id: clienteId,
          monto: m,
          moneda,
          concepto,
          fecha,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        afterSave("Cobro registrado ✓");
      });
      return;
    }

    // Salida
    if (salida === "equipo") {
      if (!userId) return toast.error("Elegí a quién le pagaste.");
      start(async () => {
        const res = await quickTeamPay({
          user_id: userId,
          monto: m,
          moneda,
          concepto,
          fecha,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        afterSave("Pago al equipo registrado ✓");
      });
    } else {
      if (!concepto.trim() && !proveedor.trim())
        return toast.error("Poné al menos el proveedor o el concepto.");
      start(async () => {
        const res = await quickExpensePaid({
          categoria,
          proveedor: proveedor || null,
          concepto: concepto || proveedor,
          monto: m,
          moneda,
          fecha,
          cliente_id: gastoClienteId || null,
        });
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        afterSave("Gasto registrado ✓");
      });
    }
  }

  const entrada = dir === "in";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Carga rápida de plata"
        title="Carga rápida: cobré / pagué"
        className="fixed bottom-[4.75rem] right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105"
      >
        <Banknote className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-5 right-5 z-50 flex max-h-[80vh] w-[min(360px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <Banknote className="h-4 w-4 text-emerald-600" /> Carga rápida
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Toggle entró / salió */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <button
          onClick={() => setDir("in")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors",
            entrada
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <ArrowDownCircle className="h-4 w-4" /> Cobré
        </button>
        <button
          onClick={() => setDir("out")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors",
            !entrada
              ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <ArrowUpCircle className="h-4 w-4" /> Pagué
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto px-3 pb-4">
        {/* Sub-toggle de salida */}
        {!entrada && (
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setSalida("gasto")}
              className={cn(
                "flex-1 rounded-md border py-1.5 font-medium",
                salida === "gasto" ? "border-primary bg-primary/10" : "text-muted-foreground"
              )}
            >
              Gasto / proveedor
            </button>
            <button
              onClick={() => setSalida("equipo")}
              className={cn(
                "flex-1 rounded-md border py-1.5 font-medium",
                salida === "equipo" ? "border-primary bg-primary/10" : "text-muted-foreground"
              )}
            >
              Al equipo
            </button>
          </div>
        )}

        {/* Contraparte: cliente (cobré) o persona (pagué al equipo) */}
        {entrada && (
          <div>
            <Label className="text-xs">¿Quién te pagó?</Label>
            <Combo
              items={clients}
              value={clienteId}
              onChange={setClienteId}
              placeholder="Elegí cliente"
            />
          </div>
        )}
        {!entrada && salida === "equipo" && (
          <div>
            <Label className="text-xs">¿A quién le pagaste?</Label>
            <Combo
              items={users}
              value={userId}
              onChange={setUserId}
              placeholder="Elegí persona"
            />
          </div>
        )}

        {/* Pendientes para saldar en un toque */}
        {(entrada ? clienteId : salida === "equipo" && userId) && (
          <div className="rounded-lg border bg-muted/30 p-2">
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {loadingPend
                ? "Buscando pendientes…"
                : pendientes && pendientes.length > 0
                  ? entrada
                    ? "Facturas pendientes — tocá para saldar"
                    : "Pagos pendientes — tocá para saldar"
                  : "Sin pendientes cargados"}
            </div>
            {pendientes && pendientes.length > 0 && (
              <ul className="space-y-1">
                {pendientes.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => settle(it)}
                      disabled={pending}
                      className="flex w-full items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-left text-sm transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/20"
                    >
                      <span className="min-w-0 flex-1 truncate">{it.concepto}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {fmt(it.monto, it.moneda)}
                      </span>
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Gasto: categoría + proveedor */}
        {!entrada && salida === "gasto" && (
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Label className="text-xs">Categoría</Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as ExpenseCategory)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Proveedor</Label>
              <Input
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Ej: Notion, AFIP, Estudio contable"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Imputar a cliente (opcional)</Label>
              <Combo
                items={clients}
                value={gastoClienteId}
                onChange={setGastoClienteId}
                placeholder="Sin cliente (gasto general)"
                clearable
              />
              {gastoClienteId && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Se descuenta de la rentabilidad de ese cliente.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Bloque "nuevo": monto + concepto + fecha */}
        <div className="rounded-lg border border-dashed p-2">
          <div className="mb-1.5 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Plus className="h-3 w-3" />
            {entrada ? "Otro cobro" : salida === "equipo" ? "Otro pago" : "Cargar gasto"}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Monto</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className="h-9 text-right tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Concepto</Label>
              <Input
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder={entrada ? "Ej: seña" : "Ej: plan mensual"}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <Button
            onClick={saveNew}
            disabled={pending}
            className={cn(
              "mt-2 w-full",
              entrada
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            )}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {entrada ? "Registrar cobro" : "Registrar pago"}
          </Button>
        </div>

        <p className="px-1 text-[10px] text-muted-foreground">
          Lo que cargás acá entra directo al cashflow del día y queda ordenado en su
          sección (Cobros / Pagos / Gastos).
        </p>
      </div>
    </div>
  );
}
