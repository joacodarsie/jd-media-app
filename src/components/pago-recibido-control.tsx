"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { setPagoRecibido } from "@/app/(app)/clientes/[id]/onboarding/actions";

function fmt(n: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${moneda} ${n.toLocaleString("es-AR")}`;
  }
}

export function PagoRecibidoControl({
  clientId,
  esperado,
  moneda = "ARS",
  initialMonto,
  initialNota,
}: {
  clientId: string;
  /** Monto esperado del primer pago (mensual completo + 50% de los únicos). */
  esperado: number;
  moneda?: string;
  initialMonto: number | null;
  initialNota: string | null;
}) {
  const router = useRouter();
  const [monto, setMonto] = useState<string>(
    initialMonto != null ? String(initialMonto) : ""
  );
  const [nota, setNota] = useState<string>(initialNota ?? "");
  const [pending, start] = useTransition();

  const montoNum = Number(monto) || 0;
  const debe = esperado > 0 ? Math.max(esperado - montoNum, 0) : 0;
  const parcial = montoNum > 0 && esperado > 0 && montoNum < esperado;

  function save() {
    start(async () => {
      const res = await setPagoRecibido(
        clientId,
        montoNum > 0 ? montoNum : null,
        nota
      );
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pago registrado.");
      router.refresh();
    });
  }

  return (
    <div className="w-full rounded-md border bg-muted/20 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">
            ¿Cuánto pagó?
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border bg-card px-2 py-1.5 text-sm tabular-nums outline-none focus:border-primary"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">
            Aclaración (opcional)
          </span>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="ej. señó, abona el resto el 15"
            className="w-full rounded-md border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {esperado > 0 && (
          <span className="text-muted-foreground">
            Esperado: <strong className="tabular-nums">{fmt(esperado, moneda)}</strong>
          </span>
        )}
        {montoNum > 0 && (
          <span className="text-emerald-700 dark:text-emerald-400">
            Pagado: <strong className="tabular-nums">{fmt(montoNum, moneda)}</strong>
          </span>
        )}
        {parcial && (
          <span className="font-medium text-amber-700 dark:text-amber-400">
            Debe: <strong className="tabular-nums">{fmt(debe, moneda)}</strong>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        Registrar pago
      </button>
    </div>
  );
}
