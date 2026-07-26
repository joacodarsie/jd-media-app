import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Gauge,
  Users,
  CalendarCheck,
  TrendingDown,
  Wallet,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { requireUser, userHas } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { fmtARS } from "@/lib/finanzas";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { puedeVerMaquina } from "@/lib/section-tabs";
import {
  computeMachineKpis,
  MODELO,
  META_DEADLINE,
  type ClienteRow,
  type ContactoRow,
} from "@/lib/comercial/machine-kpis";

export const dynamic = "force-dynamic";

export default async function MaquinaPage() {
  const me = await requireUser();
  // Misma puerta que la pestaña (y que la sección Comercial).
  if (!puedeVerMaquina(me.rol, me.rol_secundario) && !userHas(me, "comercial")) {
    redirect("/objetivos");
  }

  const admin = createAdmin();
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();

  // Contactos: la 0139 (reunion_at) puede no estar aplicada todavía.
  let contactos: ContactoRow[] = [];
  let falta0139 = false;
  const conReunion = await admin
    .from("prospecting_contacts")
    .select("id, estado, contactable, created_at, contactado_at, reunion_at, asignado_a");
  if (conReunion.error) {
    falta0139 = (conReunion.error as { code?: string }).code === "42703";
    const sinReunion = await admin
      .from("prospecting_contacts")
      .select("id, estado, contactable, created_at, contactado_at, asignado_a");
    contactos = ((sinReunion.data ?? []) as Omit<ContactoRow, "reunion_at">[]).map((c) => ({
      ...c,
      reunion_at: null,
    }));
  } else {
    contactos = (conReunion.data ?? []) as ContactoRow[];
  }

  const [{ data: clientesRaw }, { data: usersRaw }, aiRes] = await Promise.all([
    admin
      .from("clients")
      .select(
        "id, nombre, estado, monto_mensual, fecha_inicio, fecha_activado, fecha_inactivado, es_interno, cerrado_por_id, created_at"
      ),
    admin.from("users").select("id, nombre"),
    admin.from("ai_usage").select("costo_usd, ruta, created_at").gte("created_at", inicioMes),
  ]);

  const costoIaMesUsd = ((aiRes.data ?? []) as { costo_usd: number | string; ruta: string }[])
    .filter((r) => r.ruta?.startsWith("prospeccion/"))
    .reduce((a, r) => a + (Number(r.costo_usd) || 0), 0);

  const k = computeMachineKpis({
    clientes: (clientesRaw ?? []) as ClienteRow[],
    contactos,
    usuarios: (usersRaw ?? []) as { id: string; nombre: string }[],
    costoIaMesUsd,
    ahora,
  });

  const pctMeta = Math.round((k.meta.activos / k.meta.objetivo) * 100);
  const tono: Record<typeof k.meta.semaforo, string> = {
    verde: "text-emerald-600 dark:text-emerald-400",
    amarillo: "text-amber-600 dark:text-amber-400",
    rojo: "text-red-600 dark:text-red-400",
  };
  const veredicto =
    k.meta.semaforo === "verde"
      ? "Al ritmo actual llegás. Sostener."
      : k.meta.semaforo === "amarillo"
        ? "Vas a quedar corto: falta más volumen arriba del embudo o menos bajas abajo."
        : "Al ritmo actual NO se llega. Es el número a mover esta semana.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gauge className="h-6 w-6 text-primary" /> Máquina de clientes
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Una sola pantalla para saber si vamos a llegar a los {k.meta.objetivo} clientes:
          cuánto falta, a qué ritmo hay que ir, y en qué paso del embudo se está
          trabando. Todo se calcula solo con lo que ya cargan en Prospección y en
          Clientes.
        </p>
      </div>

      {falta0139 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Falta aplicar la migración <b>0139_prospecting_reunion</b> en Supabase. Sin
          ella no se guarda la fecha de las reuniones agendadas y el embudo queda sin
          su paso más importante. El resto del tablero funciona igual.
        </div>
      )}

      {/* ── La meta ──────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Clientes fijos activos
              </div>
              <div className="text-3xl font-bold tabular-nums">
                {k.meta.activos}{" "}
                <span className="text-lg font-normal text-muted-foreground">
                  de {k.meta.objetivo}
                </span>
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">
                Quedan <b className="text-foreground">{k.meta.semanasRestantes}</b> semanas
                (al {fmtDate(META_DEADLINE)})
              </div>
              <div className={cn("font-semibold", tono[k.meta.semaforo])}>{veredicto}</div>
            </div>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, pctMeta)}%` }}
            />
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Faltan" value={`${k.meta.faltan}`} sub="cuentas nuevas netas" />
            <StatCard
              label="Ritmo necesario"
              value={`${k.meta.ritmoNecesario.toLocaleString("es-AR")} / sem`}
              sub="altas menos bajas"
            />
            <StatCard
              label="Ritmo real (8 sem)"
              value={`${k.meta.ritmoActual.toLocaleString("es-AR")} / sem`}
              tone={k.meta.semaforo === "verde" ? "good" : k.meta.semaforo === "rojo" ? "bad" : "warn"}
              sub="altas menos bajas"
            />
            <StatCard
              label={`Proyección al ${fmtDate(META_DEADLINE, "dd/MM")}`}
              value={`${k.meta.proyeccion}`}
              tone={k.meta.proyeccion >= k.meta.objetivo ? "good" : "bad"}
              sub="si nada cambia"
              strong
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Embudo ───────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" /> El embudo, últimos 30 días
            </h2>
            <p className="text-sm text-muted-foreground">
              Las dos perillas del modelo: qué porcentaje de los que contactamos{" "}
              <b>agenda</b> y qué porcentaje de esas reuniones <b>cierra</b>.
            </p>
          </div>

          <Embudo
            pasos={[
              { label: "Contactos cargados", valor: k.embudo.cargados },
              { label: "Contactados", valor: k.embudo.contactados },
              {
                label: "Alcanzados (dato bueno)",
                valor: k.embudo.alcanzados,
                nota: "descuenta los teléfonos/IG que no existían",
              },
              { label: "Reuniones agendadas", valor: k.embudo.reuniones, destacado: true },
              { label: "Clientes nuevos", valor: k.embudo.cierres, destacado: true },
            ]}
          />

          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            <StatCard
              label="% que agenda"
              value={k.embudo.agendaPct != null ? `${k.embudo.agendaPct}%` : "—"}
              sub={`modelo: ${MODELO.agendaPct}%`}
              tone={
                k.embudo.agendaPct == null
                  ? undefined
                  : k.embudo.agendaPct >= MODELO.agendaPct
                    ? "good"
                    : "warn"
              }
            />
            <StatCard
              label="% de reuniones que cierra"
              value={k.embudo.cierrePct != null ? `${k.embudo.cierrePct}%` : "—"}
              sub={`modelo: ${MODELO.cierrePct}%`}
              tone={
                k.embudo.cierrePct == null
                  ? undefined
                  : k.embudo.cierrePct >= MODELO.cierrePct
                    ? "good"
                    : "warn"
              }
            />
            <StatCard
              label="Contactados por cliente"
              value={k.embudo.contactosPorCliente != null ? `${k.embudo.contactosPorCliente}` : "—"}
              sub="ratio del período, no atribución"
              muted
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Semana a semana ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" /> Semana a semana
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Semana</th>
                  <th className="py-2 pr-3 text-right">Cargados</th>
                  <th className="py-2 pr-3 text-right">Contactados</th>
                  <th className="py-2 pr-3 text-right">Reuniones</th>
                  <th className="py-2 pr-3 text-right">Altas</th>
                  <th className="py-2 pr-3 text-right">Bajas</th>
                  <th className="py-2 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {k.semanas.map((s, i) => (
                  <tr key={s.inicio} className={cn("border-b last:border-0", i === 0 && "bg-primary/5")}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {fmtDate(s.inicio, "dd/MM")}
                      {i === 0 && <span className="ml-1 text-[10px] text-muted-foreground">(en curso)</span>}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.cargados || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.contactados || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{s.reuniones || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {s.altas || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-red-600 dark:text-red-400">
                      {s.bajas || "—"}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right font-semibold tabular-nums",
                        s.neto > 0 && "text-emerald-600 dark:text-emerald-400",
                        s.neto < 0 && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {s.neto > 0 ? `+${s.neto}` : s.neto || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Quién mueve la aguja ───────────────────────────────────────── */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" /> Quién mueve la aguja
            </h2>
            {k.personas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía nadie tiene contactos a su nombre. En Contactos, al marcar el
                estado de una fila queda auto-asignada a quien la marcó.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Persona</th>
                    <th className="py-2 pr-3 text-right">Contactó (7d)</th>
                    <th className="py-2 pr-3 text-right">Contactó (30d)</th>
                    <th className="py-2 pr-3 text-right">Reuniones</th>
                    <th className="py-2 text-right">Cerró</th>
                  </tr>
                </thead>
                <tbody>
                  {k.personas.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{p.nombre}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.contactados7 || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.contactados30 || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.reuniones30 || "—"}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {p.cierresTotales || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── Retención ──────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <TrendingDown className="h-4 w-4 text-muted-foreground" /> El agujero del balde
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada cuenta que se va hay que volver a venderla. Bajar esto vale lo mismo
              que cerrar más.
            </p>
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
              <StatCard label="Activas hoy" value={`${k.retencion.activos}`} />
              <StatCard
                label="Se fueron (histórico)"
                value={`${k.retencion.perdidos}`}
                tone={k.retencion.perdidos > k.retencion.activos ? "bad" : undefined}
              />
              <StatCard
                label="Churn mensual"
                value={k.retencion.churnMensualPct != null ? `${k.retencion.churnMensualPct}%` : "—"}
                sub="promedio últimos 90 días"
                tone={
                  k.retencion.churnMensualPct != null && k.retencion.churnMensualPct > 5
                    ? "bad"
                    : undefined
                }
              />
              <StatCard
                label="Dura una cuenta"
                value={k.retencion.vidaMediaMeses != null ? `${k.retencion.vidaMediaMeses} meses` : "—"}
                sub="a este ritmo de bajas"
              />
              <StatCard
                label="Neto 90 días"
                value={k.retencion.neto90 > 0 ? `+${k.retencion.neto90}` : `${k.retencion.neto90}`}
                tone={k.retencion.neto90 > 0 ? "good" : "bad"}
                sub="altas menos bajas"
                strong
              />
              <StatCard label="Bajas 90 días" value={`${k.retencion.bajas90}`} muted />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Plata ────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="h-4 w-4 text-muted-foreground" /> Lo que esto significa en plata
          </h2>
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Facturación mensual hoy" value={fmtARS(k.plata.mrr)} strong />
            <StatCard label="Ticket promedio" value={fmtARS(k.plata.ticketPromedio)} />
            <StatCard
              label={`Facturación a ${k.meta.objetivo} clientes`}
              value={fmtARS(k.plata.mrrObjetivo)}
              sub="con el ticket de hoy"
              tone="good"
            />
            <StatCard
              label="Sumado en 30 días"
              value={fmtARS(k.plata.mrrNuevo30)}
              tone={k.plata.mrrNuevo30 > 0 ? "good" : undefined}
            />
            <StatCard
              label="Perdido en 30 días"
              value={fmtARS(k.plata.mrrPerdido30)}
              tone={k.plata.mrrPerdido30 > 0 ? "bad" : undefined}
            />
            <StatCard
              label="Costo de IA de prospección"
              value={`US$ ${k.plata.costoIaMesUsd.toFixed(2)}`}
              sub={
                k.plata.costoIaPorCierre != null
                  ? `US$ ${k.plata.costoIaPorCierre} por cliente cerrado`
                  : "del mes en curso"
              }
              muted
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Avisos de datos ──────────────────────────────────────────────── */}
      {k.avisos.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-500/40">
          <CardContent className="space-y-2 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" /> Esto hace que el tablero mienta
            </h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {k.avisos.map((a) => (
                <li key={a} className="flex gap-2">
                  <span className="text-amber-600">•</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/prospeccion" className="inline-flex items-center gap-1 text-primary hover:underline">
          Ir a Prospección <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/comercial" className="inline-flex items-center gap-1 text-primary hover:underline">
          Propuestas abiertas <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/clientes" className="inline-flex items-center gap-1 text-primary hover:underline">
          Clientes <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/** Embudo en barras: cada paso proporcional al primero. */
function Embudo({
  pasos,
}: {
  pasos: { label: string; valor: number; nota?: string; destacado?: boolean }[];
}) {
  const max = Math.max(...pasos.map((p) => p.valor), 1);
  return (
    <div className="space-y-2">
      {pasos.map((p, i) => {
        const previo = i > 0 ? pasos[i - 1].valor : null;
        const conv = previo && previo > 0 ? Math.round((p.valor / previo) * 100) : null;
        return (
          <div key={p.label} className="flex items-center gap-3">
            <div className="w-44 shrink-0 text-xs text-muted-foreground sm:w-52">
              {p.label}
              {p.nota && <div className="text-[10px] opacity-70">{p.nota}</div>}
            </div>
            <div className="h-6 flex-1 overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "flex h-full min-w-[2.5rem] items-center justify-end rounded px-2 text-xs font-semibold text-white transition-all",
                  p.destacado ? "bg-emerald-600" : "bg-primary"
                )}
                style={{ width: `${Math.max(4, (p.valor / max) * 100)}%` }}
              >
                {p.valor}
              </div>
            </div>
            <div className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
              {conv != null ? `${conv}%` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
