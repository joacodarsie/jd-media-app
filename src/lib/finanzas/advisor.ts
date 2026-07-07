/**
 * Asesor financiero de JD Media. Arma una "foto" de los números clave del mes
 * (la misma lógica de la página de Finanzas) y se la pasa a la IA para que
 * devuelva un diagnóstico en criollo + recomendaciones concretas y priorizadas.
 *
 * Server-only (usa el admin client y la API de Anthropic).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { toARS, periodLabel, prevPeriod, nextPeriod } from "@/lib/finanzas";
import type { ExchangeRates } from "@/lib/exchange";
import { buildPeriodPayroll } from "@/lib/payroll-period";

const CICLO_MESES: Record<string, number> = { mensual: 1, trimestral: 3, anual: 12 };

export interface FinancialSnapshot {
  period: string;
  periodoLabel: string;
  ingresos: number;
  sueldos: number;
  plataformas: number;
  publicidad: number;
  ganancia: number;
  margenPct: number | null;
  clientesActivos: number;
  topClientes: { nombre: string; monto: number; pctIngresos: number }[];
  porCobrarTotal: number;
  vencidoCount: number;
  vencidoMonto: number;
  deudaTotal: number;
  mesesParaSaldar: number | null;
  plataformasCount: number;
  cobradoTrend: { periodo: string; cobrado: number }[];
  dolarBlue: number;
}

export interface AdviceRecomendacion {
  titulo: string;
  detalle: string;
  prioridad: "alta" | "media" | "baja";
  link: string | null;
}

export interface FinancialAdvice {
  score: number;
  estado: string;
  fortalezas: string[];
  riesgos: string[];
  recomendaciones: AdviceRecomendacion[];
}

/** Arma la foto financiera del mes con los mismos criterios que /finanzas. */
export async function buildFinancialSnapshot(
  admin: SupabaseClient,
  period: string,
  rates: ExchangeRates
): Promise<FinancialSnapshot> {
  const ars = (m: number, mon: string) => toARS(Number(m), mon, rates);
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: svcRaw },
    { data: subsRaw },
    { data: adSpendRaw },
    { data: internalRaw },
    { data: debtsRaw },
    { data: clientsRaw },
    { data: invoicesRaw },
    payroll,
  ] = await Promise.all([
    admin
      .from("client_services")
      .select("cliente_id, monto_mensual, moneda, facturacion, activo")
      .eq("activo", true),
    admin.from("subscriptions").select("costo, moneda, ciclo").eq("activa", true),
    admin
      .from("paid_media_snapshots")
      .select("cliente_id, spend, moneda, fecha")
      .gte("fecha", `${period}-01`)
      .lt("fecha", `${nextPeriod(period)}-01`),
    admin.from("clients").select("id").eq("es_interno", true),
    admin.from("debts").select("monto, moneda").eq("saldada", false),
    admin.from("clients").select("id, nombre, estado").eq("estado", "activo"),
    admin
      .from("client_invoices")
      .select("monto, moneda, fecha_cobro, fecha_vencimiento"),
    buildPeriodPayroll(admin, period),
  ]);

  const clients = (clientsRaw ?? []) as { id: string; nombre: string }[];
  const activeIds = new Set(clients.map((c) => c.id));
  const nombreById = new Map(clients.map((c) => [c.id, c.nombre]));
  const internalIds = new Set(((internalRaw ?? []) as { id: string }[]).map((c) => c.id));

  const svcs = (svcRaw ?? []) as {
    cliente_id: string;
    monto_mensual: number | null;
    moneda: string;
    facturacion: string | null;
  }[];

  // Ingreso recurrente por cliente activo (abono mensual).
  const ingresoPorCliente = new Map<string, number>();
  for (const v of svcs) {
    if (!activeIds.has(v.cliente_id)) continue;
    if ((v.facturacion ?? "mensual") === "unico" || v.monto_mensual == null) continue;
    const monto = ars(v.monto_mensual, v.moneda);
    ingresoPorCliente.set(v.cliente_id, (ingresoPorCliente.get(v.cliente_id) ?? 0) + monto);
  }
  const ingresos = Array.from(ingresoPorCliente.values()).reduce((a, b) => a + b, 0);

  const subs = (subsRaw ?? []) as { costo: number; moneda: string; ciclo: string }[];
  const plataformas = subs.reduce(
    (a, s) => a + ars(s.costo, s.moneda) / (CICLO_MESES[s.ciclo] ?? 1),
    0
  );
  const adSpend = (adSpendRaw ?? []) as { cliente_id: string; spend: number; moneda: string }[];
  const publicidad = adSpend
    .filter((x) => internalIds.has(x.cliente_id))
    .reduce((a, x) => a + ars(x.spend, x.moneda), 0);
  const sueldos = payroll.totalNomina;
  const ganancia = ingresos - sueldos - plataformas - publicidad;
  const margenPct = ingresos > 0 ? Math.round((ganancia / ingresos) * 100) : null;

  const topClientes = Array.from(ingresoPorCliente.entries())
    .map(([id, monto]) => ({
      nombre: nombreById.get(id) ?? "—",
      monto: Math.round(monto),
      pctIngresos: ingresos > 0 ? Math.round((monto / ingresos) * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  // Cobranzas (todo el histórico de facturas sin cobrar).
  const invoices = (invoicesRaw ?? []) as {
    monto: number;
    moneda: string;
    fecha_cobro: string | null;
    fecha_vencimiento: string | null;
  }[];
  const pendientes = invoices.filter((i) => !i.fecha_cobro);
  const porCobrarTotal = pendientes.reduce((a, i) => a + ars(i.monto, i.moneda), 0);
  const vencidas = pendientes.filter(
    (i) => i.fecha_vencimiento && i.fecha_vencimiento < today
  );
  const vencidoMonto = vencidas.reduce((a, i) => a + ars(i.monto, i.moneda), 0);

  const deudaTotal = ((debtsRaw ?? []) as { monto: number; moneda: string }[]).reduce(
    (a, d) => a + ars(d.monto, d.moneda),
    0
  );
  const mesesParaSaldar =
    deudaTotal > 0 && ganancia > 0 ? Math.ceil(deudaTotal / ganancia) : null;

  // Tendencia de cobranza real de los últimos 3 meses (incluye el actual).
  const trendPeriods = [prevPeriod(prevPeriod(period)), prevPeriod(period), period];
  const cobradoTrend = trendPeriods.map((p) => ({
    periodo: p,
    cobrado: Math.round(
      invoices
        .filter((i) => i.fecha_cobro && i.fecha_cobro.startsWith(p))
        .reduce((a, i) => a + ars(i.monto, i.moneda), 0)
    ),
  }));

  return {
    period,
    periodoLabel: periodLabel(period),
    ingresos: Math.round(ingresos),
    sueldos: Math.round(sueldos),
    plataformas: Math.round(plataformas),
    publicidad: Math.round(publicidad),
    ganancia: Math.round(ganancia),
    margenPct,
    clientesActivos: clients.length,
    topClientes,
    porCobrarTotal: Math.round(porCobrarTotal),
    vencidoCount: vencidas.length,
    vencidoMonto: Math.round(vencidoMonto),
    deudaTotal: Math.round(deudaTotal),
    mesesParaSaldar,
    plataformasCount: subs.length,
    cobradoTrend,
    dolarBlue: rates.USD,
  };
}

function safeParse(raw: string): FinancialAdvice | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
  const recs = Array.isArray(o.recomendaciones)
    ? (o.recomendaciones as Record<string, unknown>[])
        .map((r) => ({
          titulo: typeof r.titulo === "string" ? r.titulo : "",
          detalle: typeof r.detalle === "string" ? r.detalle : "",
          prioridad: (["alta", "media", "baja"].includes(r.prioridad as string)
            ? r.prioridad
            : "media") as AdviceRecomendacion["prioridad"],
          link: typeof r.link === "string" && r.link.startsWith("/") ? r.link : null,
        }))
        .filter((r) => r.titulo)
        .slice(0, 6)
    : [];
  const score =
    typeof o.score === "number" ? Math.max(0, Math.min(100, Math.round(o.score))) : 0;
  return {
    score,
    estado: typeof o.estado === "string" ? o.estado : "",
    fortalezas: strArr(o.fortalezas),
    riesgos: strArr(o.riesgos),
    recomendaciones: recs,
  };
}

const SYSTEM = `Sos el asesor financiero de JD Media, una agencia de marketing digital de Córdoba, Argentina. Te paso una foto real de las finanzas del mes (en pesos argentinos, ARS) y tenés que darle al dueño un diagnóstico claro y accionable, como un CFO que habla simple.

CÓMO PENSAR
- La "ganancia" del mes = ingresos recurrentes − sueldos − plataformas − publicidad propia.
- El "margen" sano para una agencia de servicios ronda 30-50%. Por debajo de 20% hay que prender alertas; negativo es urgente.
- Mirá concentración de ingresos: si 1 cliente es >30% de la facturación, es un riesgo (dependencia).
- Cobranzas vencidas = plata tuya en la calle: siempre recomendá accionar.
- Si hay deuda, evaluá si el ritmo de ganancia la cubre en un plazo razonable.
- Mirá la tendencia de cobranza de los últimos meses (¿sube, baja, estable?).
- Sé honesto: si algo está bien, decilo; si está mal, decilo sin rodeos. Nada de relleno genérico.

SALIDA
Respondé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto antes ni después):
{
  "score": number,              // 0-100 salud financiera global
  "estado": string,             // 1 frase directa de cómo viene (ej: "Mes sólido con buen margen, pero con plata por cobrar atrasada")
  "fortalezas": string[],       // 2-4 cosas que están bien, concretas y con números
  "riesgos": string[],          // 2-4 riesgos concretos, con números
  "recomendaciones": [          // 3-6, ordenadas por impacto. Accionables, específicas, con monto cuando aplique
    { "titulo": string, "detalle": string, "prioridad": "alta"|"media"|"baja", "link": string|null }
  ]
}
Para "link" usá rutas internas de la app cuando ayuden: "/finanzas/cobros" (cobranzas), "/coordinacion/sueldos" (sueldos), "/finanzas/gastos?v=subs" (plataformas), "/finanzas/deudas" (deudas), "/coordinacion/riesgo" (churn), "/comercial" (vender más). Si no aplica, null.
Hablá en español rioplatense, claro y sin tecnicismos innecesarios.`;

/** Llama a la IA con la foto financiera y devuelve el consejo estructurado. */
export async function generateFinancialAdvice(
  snapshot: FinancialSnapshot
): Promise<FinancialAdvice | null> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: AI_MODEL_SMART,
    max_tokens: 1800,
    system: [{ type: "text", text: SYSTEM }],
    messages: [
      {
        role: "user",
        content: `Foto financiera de ${snapshot.periodoLabel}:\n\n${JSON.stringify(
          snapshot,
          null,
          2
        )}`,
      },
    ],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return safeParse(text);
}
