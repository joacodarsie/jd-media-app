"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  MessageCircle,
  Receipt,
} from "lucide-react";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import { fmtARS, fmtCurrency } from "@/lib/finanzas";
import { whatsappLink } from "@/lib/payment-reminder";
import {
  buildTeamPaymentMessage,
  buildInvoiceReminder,
  resumirMes,
  type LineaPago,
} from "@/lib/finanzas/mes";
import {
  markInvoicesPaidBulk,
  pagarSueldoDelMes,
  desmarcarSueldoDelMes,
  generarGastosFijos,
} from "@/app/(app)/finanzas/actions";

export interface FilaCobro {
  clienteId: string;
  cliente: string;
  contactoNombre: string | null;
  telefono: string | null;
  monto: number;
  moneda: string;
  /** ids de las facturas del mes de esta cuenta. */
  facturaIds: string[];
  conceptos: string[];
  cobrada: boolean;
  vencimiento: string | null;
}

export interface FilaPago {
  userId: string;
  nombre: string;
  telefono: string | null;
  alias: string | null;
  titular: string | null;
  total: number;
  lineas: LineaPago[];
  pagado: boolean;
}

export interface FilaGasto {
  id: string;
  concepto: string;
  proveedor: string | null;
  categoria: string | null;
  monto: number;
  moneda: string;
  /** Fecha real de pago (null = pendiente). */
  fechaPago: string | null;
  pagado: boolean;
}

export function MesPanel({
  periodo,
  cobros,
  pagos,
  gastos,
  concepto,
  miNombre,
}: {
  periodo: string;
  cobros: FilaCobro[];
  pagos: FilaPago[];
  gastos: FilaGasto[];
  /** Concepto con el que se registra el sueldo ("Sueldo 2026-07"). */
  concepto: string;
  miNombre: string | null;
}) {
  // El "tenés que pagar" incluye equipo Y gastos fijos: si no, el número miente.
  const r = resumirMes({
    facturas: cobros.map((c) => ({ monto: c.monto, cobrada: c.cobrada })),
    pagos: [
      ...pagos.map((p) => ({ monto: p.total, pagado: p.pagado })),
      ...gastos.map((g) => ({ monto: g.monto, pagado: g.pagado })),
    ],
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Te tienen que pagar"
          value={fmtARS(r.pendienteCobrar)}
          sub={r.cobrado > 0 ? `ya entró ${fmtARS(r.cobrado)}` : "nada cobrado todavía"}
          tone={r.pendienteCobrar > 0 ? "warn" : "good"}
        />
        <StatCard
          label="Tenés que pagar"
          value={fmtARS(r.pendientePagar)}
          sub={r.pagado > 0 ? `ya pagaste ${fmtARS(r.pagado)}` : "nada pagado todavía"}
          tone={r.pendientePagar > 0 ? "bad" : "good"}
        />
        <StatCard
          label="Queda si entra todo"
          value={fmtARS(r.resultado)}
          sub={`${fmtARS(r.aCobrar)} − ${fmtARS(r.aPagar)}`}
          tone={r.resultado >= 0 ? "good" : "bad"}
          strong
        />
        <StatCard
          label="En la mano hoy"
          value={fmtARS(r.resultadoReal)}
          sub="cobrado menos pagado"
          muted
        />
      </div>

      <Seccion
        titulo="Cobrar"
        icono={<ArrowDownCircle className="h-4 w-4 text-emerald-600" />}
        vacio="No hay facturas emitidas para este mes. Generalas desde Cobros."
        filas={cobros.length}
      >
        {cobros.map((c) => (
          <FilaCobrar key={c.clienteId} fila={c} periodo={periodo} />
        ))}
      </Seccion>

      <Seccion
        titulo="Pagar al equipo"
        icono={<ArrowUpCircle className="h-4 w-4 text-red-600" />}
        vacio="Nadie tiene nómina calculada para este mes."
        filas={pagos.length}
      >
        {pagos.map((p) => (
          <FilaPagar
            key={p.userId}
            fila={p}
            periodo={periodo}
            concepto={concepto}
            miNombre={miNombre}
          />
        ))}
      </Seccion>

      <Seccion
        titulo="Gastos fijos"
        icono={<Receipt className="h-4 w-4 text-orange-600" />}
        vacio="Todavía no se generaron los gastos fijos de este mes."
        filas={gastos.length}
        accion={<GenerarGastosBtn periodo={periodo} />}
      >
        {gastos.map((g) => (
          <FilaGastoRow key={g.id} fila={g} />
        ))}
      </Seccion>

      <p className="text-xs text-muted-foreground">
        💡 Los montos a pagar salen del modelo de tarifas (los mismos de{" "}
        <Link href="/coordinacion/sueldos" className="underline hover:text-foreground">
          Sueldos
        </Link>
        ). Los de cobrar salen de las facturas del mes (
        <Link href="/finanzas/cobros" className="underline hover:text-foreground">
          Cobros
        </Link>
        ). Marcar acá impacta en los dos lados.
      </p>
    </div>
  );
}

function Seccion({
  titulo,
  icono,
  vacio,
  filas,
  accion,
  children,
}: {
  titulo: string;
  icono: React.ReactNode;
  vacio: string;
  filas: number;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        {icono} {titulo}
        <span className="text-sm font-normal text-muted-foreground">({filas})</span>
        {accion && <span className="ml-auto">{accion}</span>}
      </h2>
      {filas === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {vacio}
        </p>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">{children}</div>
      )}
    </section>
  );
}

/** Botón chico que copia un texto y confirma en el propio botón. */
function CopiarBtn({
  texto,
  label,
  title,
}: {
  texto: string;
  label: string;
  title?: string;
}) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 1600);
        } catch {
          toast.error("No se pudo copiar.");
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition hover:bg-accent"
    >
      {ok ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {ok ? "Copiado" : label}
    </button>
  );
}

function FilaCobrar({ fila, periodo }: { fila: FilaCobro; periodo: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const mensaje = buildInvoiceReminder({
    clienteNombre: fila.cliente,
    contactoNombre: fila.contactoNombre,
    periodo,
    monto: fila.monto,
    moneda: fila.moneda,
    conceptos: fila.conceptos,
  });
  const wa = whatsappLink(fila.telefono, mensaje);

  async function cobrar() {
    setGuardando(true);
    const res = await markInvoicesPaidBulk(
      fila.facturaIds,
      new Date().toISOString().slice(0, 10)
    );
    setGuardando(false);
    if (res?.error) return void toast.error(res.error);
    toast.success(`${fila.cliente}: cobrado`);
    startTransition(() => router.refresh());
  }

  return (
    <div className={cn("p-3", fila.cobrada && "bg-emerald-50/40 dark:bg-emerald-950/10")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              abierto && "rotate-180"
            )}
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{fila.cliente}</span>
            <span className="block text-[11px] text-muted-foreground">
              {fila.conceptos.length} concepto{fila.conceptos.length === 1 ? "" : "s"}
              {fila.vencimiento && ` · vence ${fila.vencimiento.slice(8, 10)}/${fila.vencimiento.slice(5, 7)}`}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">
            {fmtCurrency(fila.monto, fila.moneda)}
          </span>
          {fila.cobrada ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <Check className="h-3 w-3" /> Cobrado
            </span>
          ) : (
            <>
              <CopiarBtn texto={mensaje} label="Mensaje" title="Copiar el recordatorio de cobro" />
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-7 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </a>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={cobrar}
                disabled={guardando}
              >
                {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Cobré
              </Button>
            </>
          )}
        </div>
      </div>

      {abierto && (
        <div className="mt-2 space-y-2 border-l-2 pl-4 text-sm">
          <ul className="space-y-0.5 text-muted-foreground">
            {fila.conceptos.map((c, i) => (
              <li key={i} className="text-xs">
                • {c}
              </li>
            ))}
          </ul>
          <div className="rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap">{mensaje}</div>
        </div>
      )}
    </div>
  );
}

/** Botón para armar los gastos fijos del mes desde las suscripciones. */
function GenerarGastosBtn({ periodo }: { periodo: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cargando, setCargando] = useState(false);

  async function generar() {
    setCargando(true);
    const res = await generarGastosFijos(periodo);
    setCargando(false);
    if ("error" in res && res.error) return void toast.error(res.error);
    const creados = "creados" in res ? res.creados : 0;
    toast.success(
      creados > 0
        ? `${creados} gasto(s) fijo(s) cargado(s) desde las suscripciones.`
        : "Ya estaban todos cargados."
    );
    startTransition(() => router.refresh());
  }

  return (
    <Button size="sm" variant="outline" onClick={generar} disabled={cargando} className="h-7 gap-1 text-xs">
      {cargando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Receipt className="h-3 w-3" />}
      Traer de suscripciones
    </Button>
  );
}

/** Una línea de gasto fijo: se marca pagado con el botón de siempre. */
function FilaGastoRow({ fila }: { fila: FilaGasto }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 p-3", fila.pagado && "bg-emerald-50/40 dark:bg-emerald-950/10")}>
      <div className="min-w-0">
        <span className="block truncate font-medium">{fila.proveedor ?? fila.concepto}</span>
        <span className="block text-[11px] text-muted-foreground">
          {fila.categoria ?? "otros"}
          {fila.moneda !== "ARS" && ` · en ${fila.moneda}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold tabular-nums">
          {fmtCurrency(fila.monto, fila.moneda)}
        </span>
        <MarkPaidButton id={fila.id} kind="expense" paidAt={fila.fechaPago} />
      </div>
    </div>
  );
}

function FilaPagar({
  fila,
  periodo,
  concepto,
  miNombre,
}: {
  fila: FilaPago;
  periodo: string;
  concepto: string;
  miNombre: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const mensaje = buildTeamPaymentMessage({
    nombre: fila.nombre,
    periodo,
    total: fila.total,
    lineas: fila.lineas,
    alias: fila.alias,
    deParte: miNombre,
  });
  const wa = whatsappLink(fila.telefono, mensaje);

  async function pagar() {
    setGuardando(true);
    const res = await pagarSueldoDelMes({
      userId: fila.userId,
      periodo,
      monto: fila.total,
      concepto,
    });
    setGuardando(false);
    if ("error" in res && res.error) return void toast.error(res.error);
    toast.success(`${fila.nombre.split(" ")[0]}: pagado`);
    startTransition(() => router.refresh());
  }

  async function deshacer() {
    setGuardando(true);
    const res = await desmarcarSueldoDelMes({ userId: fila.userId, periodo, concepto });
    setGuardando(false);
    if ("error" in res && res.error) return void toast.error(res.error);
    toast.success("Vuelve a pendiente");
    startTransition(() => router.refresh());
  }

  return (
    <div className={cn("p-3", fila.pagado && "bg-emerald-50/40 dark:bg-emerald-950/10")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              abierto && "rotate-180"
            )}
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{fila.nombre}</span>
            <span className="block text-[11px] text-muted-foreground">
              {fila.lineas.length} concepto{fila.lineas.length === 1 ? "" : "s"}
              {fila.alias ? ` · ${fila.alias}` : " · sin alias cargado"}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{fmtARS(fila.total)}</span>
          {fila.pagado ? (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Check className="h-3 w-3" /> Pagado
              </span>
              <button
                type="button"
                onClick={deshacer}
                disabled={guardando}
                className="text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                deshacer
              </button>
            </>
          ) : (
            <>
              {fila.alias && (
                <CopiarBtn texto={fila.alias} label="Alias" title="Copiar el alias para transferir" />
              )}
              <CopiarBtn texto={mensaje} label="Mensaje" title="Copiar el aviso de pago con el detalle" />
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="h-7 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </a>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={pagar}
                disabled={guardando}
              >
                {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Pagué
              </Button>
            </>
          )}
        </div>
      </div>

      {abierto && (
        <div className="mt-2 space-y-2 border-l-2 pl-4">
          <table className="w-full text-sm">
            <tbody>
              {fila.lineas.map((l, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1 pr-2 text-xs text-muted-foreground">
                    {l.cliente && l.cliente !== "—" ? `${l.cliente} · ` : ""}
                    {l.concepto}
                  </td>
                  <td className="py-1 text-right text-xs tabular-nums">{fmtARS(l.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fila.titular && (
            <p className="text-[11px] text-muted-foreground">
              Titular de la cuenta: {fila.titular}
            </p>
          )}
          <div className="rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap">{mensaje}</div>
        </div>
      )}
    </div>
  );
}
