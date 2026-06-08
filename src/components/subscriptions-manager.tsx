"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, CheckCircle2, ExternalLink, Pencil } from "lucide-react";
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
import { EXPENSE_CATEGORIES } from "@/components/expense-form-dialog";
import type { ExpenseCategory } from "@/app/(app)/finanzas/actions";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  registerSubscriptionPayment,
  type SubscriptionCiclo,
  type SubscriptionInput,
} from "@/app/(app)/finanzas/suscripciones/actions";
import { fmtARS, fmtCurrency } from "@/lib/finanzas";
import { cn } from "@/lib/utils";

export interface SubscriptionRow {
  id: string;
  nombre: string;
  categoria: ExpenseCategory;
  costo: number;
  moneda: string;
  ciclo: SubscriptionCiclo;
  proxima_renovacion: string | null;
  metodo_pago: string | null;
  administrador_id: string | null;
  url: string | null;
  activa: boolean;
  notas: string | null;
}

const CICLOS: { value: SubscriptionCiclo; label: string; div: number }[] = [
  { value: "mensual", label: "Mensual", div: 1 },
  { value: "trimestral", label: "Trimestral", div: 3 },
  { value: "anual", label: "Anual", div: 12 },
];

/** Costo normalizado a mensual, en la moneda de la suscripción. */
export function monthlyARS(s: { costo: number; ciclo: SubscriptionCiclo }): number {
  const div = CICLOS.find((c) => c.value === s.ciclo)?.div ?? 1;
  return s.costo / div;
}

export function SubscriptionsManager({
  subs,
  users,
  usdRate,
  eurRate,
}: {
  subs: SubscriptionRow[];
  users: { id: string; nombre: string }[];
  usdRate: number;
  eurRate: number;
}) {
  const toARS = (monto: number, moneda: string) =>
    monto * (moneda === "USD" ? usdRate : moneda === "EUR" ? eurRate : 1);
  const uname = (id: string | null) => (id ? users.find((u) => u.id === id)?.nombre ?? "—" : "—");

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SubscriptionDialog
          mode="create"
          users={users}
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nueva suscripción
            </Button>
          }
        />
      </div>

      {subs.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Todavía no cargaste ninguna suscripción.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Plataforma</th>
                <th className="px-3 py-2 font-medium">Costo</th>
                <th className="px-3 py-2 text-right font-medium">Mensual (ARS)</th>
                <th className="px-3 py-2 font-medium">Renovación</th>
                <th className="px-3 py-2 font-medium">Medio / admin</th>
                <th className="px-3 py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => {
                const venc = s.proxima_renovacion;
                const overdue = !!venc && venc < today && s.activa;
                const soon = !!venc && !overdue && venc <= in7 && s.activa;
                return (
                  <tr key={s.id} className={cn("border-b last:border-0", !s.activa && "opacity-50")}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        {s.nombre}
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {!s.activa && (
                          <span className="rounded bg-muted px-1 text-[9px] uppercase">inactiva</span>
                        )}
                      </div>
                      <div className="text-[11px] capitalize text-muted-foreground">
                        {s.categoria} · {s.ciclo}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{fmtCurrency(s.costo, s.moneda)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtARS(toARS(monthlyARS(s), s.moneda))}
                    </td>
                    <td className="px-3 py-2">
                      {venc ? (
                        <span
                          className={cn(
                            "tabular-nums",
                            overdue && "font-semibold text-red-600",
                            soon && "font-semibold text-amber-600"
                          )}
                        >
                          {new Date(venc + "T00:00:00").toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })}
                          {overdue && " · vencida"}
                          {soon && " · pronto"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {s.metodo_pago || "—"}
                      <div>{uname(s.administrador_id)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <RegisterPaymentButton id={s.id} nombre={s.nombre} disabled={!s.activa} />
                        <SubscriptionDialog
                          mode="edit"
                          sub={s}
                          users={users}
                          trigger={
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RegisterPaymentButton({
  id,
  nombre,
  disabled,
}: {
  id: string;
  nombre: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run() {
    start(async () => {
      const res = await registerSubscriptionPayment(id);
      if (res?.error) return void toast.error(res.error);
      toast.success(
        res?.dup
          ? `${nombre}: ya estaba registrado este mes. Renovación actualizada.`
          : `Pago de ${nombre} registrado en gastos.`
      );
      router.refresh();
    });
  }
  return (
    <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={run} disabled={pending || disabled}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      Pagué
    </Button>
  );
}

type DialogProps =
  | { mode: "create"; users: { id: string; nombre: string }[]; trigger: React.ReactNode }
  | {
      mode: "edit";
      sub: SubscriptionRow;
      users: { id: string; nombre: string }[];
      trigger: React.ReactNode;
    };

const NO_ADMIN = "__none__";

function SubscriptionDialog(props: DialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const init: SubscriptionRow | null = props.mode === "edit" ? props.sub : null;
  const [nombre, setNombre] = useState(init?.nombre ?? "");
  const [categoria, setCategoria] = useState<ExpenseCategory>(init?.categoria ?? "plataformas");
  const [costo, setCosto] = useState<string>(init ? String(init.costo) : "");
  const [moneda, setMoneda] = useState(init?.moneda ?? "ARS");
  const [ciclo, setCiclo] = useState<SubscriptionCiclo>(init?.ciclo ?? "mensual");
  const [renovacion, setRenovacion] = useState(init?.proxima_renovacion ?? "");
  const [metodo, setMetodo] = useState(init?.metodo_pago ?? "");
  const [adminId, setAdminId] = useState(init?.administrador_id ?? NO_ADMIN);
  const [url, setUrl] = useState(init?.url ?? "");
  const [activa, setActiva] = useState(init?.activa ?? true);
  const [notas, setNotas] = useState(init?.notas ?? "");

  function submit() {
    const c = Number(costo);
    if (!nombre.trim()) return void toast.error("Poné un nombre.");
    if (!Number.isFinite(c) || c <= 0) return void toast.error("Costo inválido.");
    const payload: SubscriptionInput = {
      nombre,
      categoria,
      costo: c,
      moneda,
      ciclo,
      proxima_renovacion: renovacion || null,
      metodo_pago: metodo || null,
      administrador_id: adminId === NO_ADMIN ? null : adminId,
      url: url || null,
      activa,
      notas: notas || null,
    };
    start(async () => {
      const res =
        props.mode === "create"
          ? await createSubscription(payload)
          : await updateSubscription(props.sub.id, payload);
      if (res?.error) return void toast.error(res.error);
      toast.success(props.mode === "create" ? "Suscripción creada." : "Actualizada.");
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (props.mode !== "edit") return;
    if (!confirm("¿Eliminar esta suscripción? (no borra los gastos ya registrados)")) return;
    start(async () => {
      const res = await deleteSubscription(props.sub.id);
      if (res?.error) return void toast.error(res.error);
      toast.success("Eliminada.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "Nueva suscripción" : "Editar suscripción"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Plataforma</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Notion, Adobe CC, Canva Pro" className="h-9" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Costo</Label>
              <Input type="number" step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} className="h-9 text-right tabular-nums" />
            </div>
            <div>
              <Label className="text-xs">Moneda</Label>
              <Select value={moneda} onValueChange={setMoneda}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Ciclo</Label>
              <Select value={ciclo} onValueChange={(v) => setCiclo(v as SubscriptionCiclo)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CICLOS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Próxima renovación</Label>
              <Input type="date" value={renovacion} onChange={(e) => setRenovacion(e.target.value)} className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as ExpenseCategory)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Medio de pago</Label>
              <Input value={metodo} onChange={(e) => setMetodo(e.target.value)} placeholder="Ej: Visa ·1234" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Administra</Label>
              <Select value={adminId} onValueChange={setAdminId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ADMIN}>Sin asignar</SelectItem>
                  {props.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">URL (opcional)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" className="h-9" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} className="rounded" />
            Activa
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {props.mode === "edit" && (
            <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-red-600 hover:text-red-700">
              <Trash2 className="mr-1 h-4 w-4" /> Eliminar
            </Button>
          )}
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {props.mode === "create" ? "Crear" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
