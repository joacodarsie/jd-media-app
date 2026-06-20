import Link from "next/link";
import { ArrowLeft, CalendarClock, Repeat, Users, Receipt, TrendingUp } from "lucide-react";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { getExchangeRates } from "@/lib/exchange";
import { toARS, fmtARS, fmtCurrency } from "@/lib/finanzas";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Tipo = "plataforma" | "equipo" | "gasto" | "cobro";

interface Item {
  fecha: string; // YYYY-MM-DD
  label: string;
  detalle?: string | null;
  monto: number;
  moneda: string;
  ars: number;
  tipo: Tipo;
}

const TIPO_META: Record<Tipo, { label: string; icon: typeof Repeat; href: string; color: string }> = {
  plataforma: { label: "Plataforma", icon: Repeat, href: "/finanzas/suscripciones", color: "text-violet-600" },
  equipo: { label: "Equipo", icon: Users, href: "/finanzas/pagos", color: "text-amber-600" },
  gasto: { label: "Gasto", icon: Receipt, href: "/finanzas/gastos", color: "text-orange-600" },
  cobro: { label: "Cobro", icon: TrendingUp, href: "/finanzas/cobros", color: "text-emerald-600" },
};

export default async function VencimientosPage() {
  await requireFeature("finanzas");
  const admin = createAdmin();
  const rates = await getExchangeRates();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

  const [{ data: subs }, { data: pays }, { data: exps }, { data: invs }] = await Promise.all([
    admin
      .from("subscriptions")
      .select("nombre, costo, moneda, proxima_renovacion")
      .eq("activa", true)
      .not("proxima_renovacion", "is", null),
    admin
      .from("team_payments")
      .select("monto, moneda, fecha_programada, concepto, usuario:users!team_payments_user_id_fkey(nombre)")
      .is("fecha_pago", null),
    admin
      .from("expenses")
      .select("monto, moneda, fecha_programada, concepto, proveedor")
      .is("fecha_pago", null)
      .not("fecha_programada", "is", null),
    admin
      .from("client_invoices")
      .select("monto, moneda, fecha_vencimiento, concepto, cliente:clients(nombre)")
      .is("fecha_cobro", null)
      .not("fecha_vencimiento", "is", null),
  ]);

  const ars = (m: number, mon: string) => toARS(Number(m), mon, rates);
  const items: Item[] = [];

  for (const s of (subs ?? []) as { nombre: string; costo: number; moneda: string; proxima_renovacion: string }[]) {
    items.push({
      fecha: s.proxima_renovacion.slice(0, 10),
      label: s.nombre,
      monto: Number(s.costo),
      moneda: s.moneda,
      ars: ars(s.costo, s.moneda),
      tipo: "plataforma",
    });
  }
  for (const p of (pays ?? []) as unknown as { monto: number; moneda: string; fecha_programada: string; concepto: string; usuario: { nombre: string } | null }[]) {
    items.push({
      fecha: p.fecha_programada.slice(0, 10),
      label: p.usuario?.nombre ?? "Equipo",
      detalle: p.concepto,
      monto: Number(p.monto),
      moneda: p.moneda,
      ars: ars(p.monto, p.moneda),
      tipo: "equipo",
    });
  }
  for (const e of (exps ?? []) as { monto: number; moneda: string; fecha_programada: string; concepto: string; proveedor: string | null }[]) {
    items.push({
      fecha: e.fecha_programada.slice(0, 10),
      label: e.proveedor ?? e.concepto,
      detalle: e.proveedor ? e.concepto : null,
      monto: Number(e.monto),
      moneda: e.moneda,
      ars: ars(e.monto, e.moneda),
      tipo: "gasto",
    });
  }
  const cobros: Item[] = [];
  for (const i of (invs ?? []) as unknown as { monto: number; moneda: string; fecha_vencimiento: string; concepto: string; cliente: { nombre: string } | null }[]) {
    cobros.push({
      fecha: i.fecha_vencimiento.slice(0, 10),
      label: i.cliente?.nombre ?? "Cliente",
      detalle: i.concepto,
      monto: Number(i.monto),
      moneda: i.moneda,
      ars: ars(i.monto, i.moneda),
      tipo: "cobro",
    });
  }

  items.sort((a, b) => a.fecha.localeCompare(b.fecha));
  cobros.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const buckets = [
    { key: "vencido", title: "🔴 Vencido", test: (f: string) => f < today },
    { key: "semana", title: "Esta semana", test: (f: string) => f >= today && f <= in7 },
    { key: "despues", title: "Más adelante", test: (f: string) => f > in7 },
  ];

  const totalPagar = items.reduce((a, i) => a + i.ars, 0);
  const totalCobrar = cobros.reduce((a, i) => a + i.ars, 0);

  return (
    <div className="space-y-5">
      <Link
        href="/finanzas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Finanzas
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarClock className="h-6 w-6 text-primary" /> Vencimientos
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Todo lo que tenés que <b>pagar</b> y cuándo, en un solo lugar: plataformas,
          equipo y gastos. Más abajo, lo que te tienen que <b>cobrar</b>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Por pagar (total)</div>
          <div className="text-2xl font-bold tabular-nums text-red-600">{fmtARS(totalPagar)}</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Por cobrar (total)</div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600">{fmtARS(totalCobrar)}</div>
        </div>
      </div>

      {/* Pagos */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3 text-sm font-semibold">Lo que tenés que pagar</div>
          {items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nada pendiente de pago. 🎉</p>
          ) : (
            <div className="divide-y">
              {buckets.map((b) => {
                const rows = items.filter((i) => b.test(i.fecha));
                if (rows.length === 0) return null;
                return (
                  <div key={b.key}>
                    <div className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {b.title} · {rows.length}
                    </div>
                    {rows.map((it, idx) => (
                      <Row key={b.key + idx} it={it} vencido={it.fecha < today} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cobros */}
      {cobros.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-3 text-sm font-semibold">Lo que te tienen que cobrar</div>
            <div className="divide-y">
              {cobros.map((it, idx) => (
                <Row key={"c" + idx} it={it} vencido={it.fecha < today} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ it, vencido }: { it: Item; vencido: boolean }) {
  const meta = TIPO_META[it.tipo];
  const Icon = meta.icon;
  return (
    <Link href={meta.href} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/30">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className={cn("h-4 w-4 shrink-0", meta.color)} />
        <div className="min-w-0">
          <div className="truncate font-medium">{it.label}</div>
          {it.detalle && <div className="truncate text-xs text-muted-foreground">{it.detalle}</div>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-semibold tabular-nums">{fmtCurrency(it.monto, it.moneda)}</div>
        <div className={cn("text-[10px]", vencido ? "font-semibold text-red-600" : "text-muted-foreground")}>
          {fmtDate(it.fecha)}
        </div>
      </div>
    </Link>
  );
}
