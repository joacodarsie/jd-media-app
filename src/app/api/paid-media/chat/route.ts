import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { friendlyAiError } from "@/lib/ai/errors";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import {
  fetchAdAccountData,
  fetchAdSets,
  metaConfigured,
  friendlyMetaError,
  type AdMetrics,
  type CampaignMetrics,
  type AdSetMetrics,
} from "@/lib/meta/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();
const MODEL = AI_MODEL_SMART;
const ALLOWED = ["admin", "coordinador", "paid_media"];

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

function fmtMetrics(m: AdMetrics, moneda: string): string {
  return `gasto ${moneda} ${m.spend}, impresiones ${m.impressions}, alcance ${m.reach}, clicks ${m.clicks}, CTR ${m.ctr ?? "-"}%, CPC ${m.cpc ?? "-"}, CPM ${m.cpm ?? "-"}, conversiones ${m.conversions}, costo/conv ${m.cost_per_conversion ?? "-"}`;
}

function fmtCampaigns(camps: CampaignMetrics[], moneda: string): string {
  if (!camps.length) return "(sin campañas con datos)";
  return camps
    .map(
      (c) =>
        `- ${c.nombre} [${c.estado}${c.objetivo ? ` · ${c.objetivo}` : ""}${
          c.daily_budget != null ? ` · ppto/día ${moneda} ${c.daily_budget}` : ""
        }]: gasto ${c.spend}, clicks ${c.clicks}, CTR ${c.ctr ?? "-"}%, CPC ${
          c.cpc ?? "-"
        }, conv ${c.conversions}, costo/conv ${c.cost_per_conversion ?? "-"}`
    )
    .join("\n");
}

function fmtAdSets(sets: AdSetMetrics[], moneda: string): string {
  if (!sets.length) return "(sin conjuntos con datos)";
  return sets
    .map(
      (s) =>
        `- [${s.campana ?? "?"}] ${s.nombre} (${s.estado}${
          s.daily_budget != null ? ` · ppto/día ${moneda} ${s.daily_budget}` : ""
        }): gasto ${s.spend}, clicks ${s.clicks}, CTR ${s.ctr ?? "-"}%, CPC ${
          s.cpc ?? "-"
        }, conv ${s.conversions}, costo/conv ${s.cost_per_conversion ?? "-"}`
    )
    .join("\n");
}

function buildBusinessContext(
  nombre: string,
  rubro: string | null,
  objetivo: string | null,
  notas: string | null,
  diag: Record<string, unknown> | null
): string {
  const lines: string[] = [`Cliente: ${nombre}${rubro ? ` · rubro: ${rubro}` : ""}`];
  if (objetivo) lines.push(`Objetivo de pauta: ${objetivo}`);
  if (notas) lines.push(`Notas internas: ${String(notas).slice(0, 600)}`);
  if (diag) {
    const pick = (k: string) => {
      const v = diag[k];
      return typeof v === "string" ? v : v ? JSON.stringify(v) : "";
    };
    const resumen = pick("resumen_ejecutivo");
    const publico = pick("publico_objetivo");
    const marca = pick("marca");
    const dif = pick("diferenciales");
    if (resumen) lines.push(`Resumen del negocio: ${resumen.slice(0, 800)}`);
    if (publico) lines.push(`Público objetivo: ${publico.slice(0, 500)}`);
    if (marca) lines.push(`Marca: ${marca.slice(0, 400)}`);
    if (dif) lines.push(`Diferenciales: ${dif.slice(0, 400)}`);
  }
  return lines.join("\n");
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 500 });
  }
  const me = await requireUser();
  if (!ALLOWED.includes(me.rol)) {
    return NextResponse.json({ error: "No tenés acceso a Paid Media." }, { status: 403 });
  }
  if (!metaConfigured()) {
    return NextResponse.json(
      { error: "Falta conectar Meta (META_SYSTEM_USER_TOKEN)." },
      { status: 400 }
    );
  }

  const body = (await req.json()) as {
    clienteId: string;
    messages: IncomingMessage[];
    deep?: boolean;
  };
  const { clienteId, deep } = body;
  const incoming = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
  );
  if (!clienteId || incoming.length === 0) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const admin = createAdmin();
  const [{ data: cli }, { data: ads }, { data: diagRow }, { data: snaps }] = await Promise.all([
    admin.from("clients").select("id, nombre, rubro, notas").eq("id", clienteId).maybeSingle(),
    admin
      .from("client_ads_onboarding")
      .select("meta_ad_account_id, campanas_notas, notas")
      .eq("cliente_id", clienteId)
      .maybeSingle(),
    admin
      .from("client_diagnostics")
      .select("content")
      .eq("cliente_id", clienteId)
      .eq("status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("paid_media_snapshots")
      .select("fecha, spend, conversions, cpc, moneda, detalle")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false })
      .limit(14),
  ]);

  if (!cli) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
  const adAccountId = (ads as { meta_ad_account_id?: string } | null)?.meta_ad_account_id;
  if (!adAccountId) {
    return NextResponse.json(
      { error: "Este cliente no tiene cuenta publicitaria (act_XXXX) cargada." },
      { status: 400 }
    );
  }

  const diag =
    diagRow && (diagRow as { content?: unknown }).content &&
    typeof (diagRow as { content?: unknown }).content === "object"
      ? ((diagRow as { content: Record<string, unknown> }).content)
      : null;
  const objetivo = (ads as { campanas_notas?: string | null } | null)?.campanas_notas ?? null;
  const business = buildBusinessContext(
    (cli as { nombre: string }).nombre,
    (cli as { rubro: string | null }).rubro,
    objetivo,
    (cli as { notas: string | null }).notas,
    diag
  );

  const snapRows = (snaps ?? []) as {
    fecha: string;
    spend: number;
    conversions: number;
    cpc: number | null;
    moneda: string;
    detalle: { campaigns?: CampaignMetrics[] } | null;
  }[];
  const trend = [...snapRows]
    .reverse()
    .map((s) => `  ${s.fecha}: gasto ${Number(s.spend)}, conv ${Number(s.conversions)}, CPC ${s.cpc ?? "-"}`)
    .join("\n");
  const moneda = snapRows[0]?.moneda ?? "ARS";

  // Métricas para el contexto: profundo = pull en vivo (cuenta+campañas+conjuntos,
  // 30 días); liviano = último snapshot guardado (sin llamar a Meta).
  let metricsBlock = "";
  try {
    if (deep) {
      const [data, sets] = await Promise.all([
        fetchAdAccountData(adAccountId, "last_30d"),
        fetchAdSets(adAccountId, "last_30d"),
      ]);
      metricsBlock = [
        `MÉTRICAS (últimos 30 días) — nivel cuenta: ${fmtMetrics(data.account, data.account.moneda)}`,
        ``,
        `Campañas:`,
        fmtCampaigns(data.campaigns, data.account.moneda),
        ``,
        `Conjuntos de anuncios (ad sets):`,
        fmtAdSets(sets, data.account.moneda),
      ].join("\n");
    } else {
      const last = snapRows[0];
      const camps = (last?.detalle?.campaigns ?? []) as CampaignMetrics[];
      metricsBlock = [
        `MÉTRICAS (último día registrado: ${last?.fecha ?? "s/d"}) — nivel cuenta: gasto ${moneda} ${
          last ? Number(last.spend) : 0
        }, conversiones ${last ? Number(last.conversions) : 0}, CPC ${last?.cpc ?? "-"}`,
        ``,
        `Campañas (último día):`,
        fmtCampaigns(camps, moneda),
      ].join("\n");
    }
  } catch (e) {
    return NextResponse.json({ error: friendlyMetaError(e) }, { status: 502 });
  }

  const system = `Sos el analista de Paid Media de JD Media (agencia de Córdoba, Argentina) dedicado EXCLUSIVAMENTE a la cuenta publicitaria de este cliente. Tu trabajo es entender cómo viene la pauta, encontrar mejoras y ayudar a lograr los objetivos del negocio.

# Contexto del negocio
${business}

# Datos de la cuenta de Meta Ads
${metricsBlock}

# Tendencia (últimos días, de snapshots guardados)
${trend || "(sin historial)"}

# Cómo respondés
- Español rioplatense (vos), directo, concreto, sin relleno ni emojis.
- Basate SIEMPRE en los datos que tenés arriba. No inventes métricas ni campañas.
- Pensá en función del OBJETIVO del cliente: el resultado (leads/ventas) importa más que el alcance.
- Cuando te pidan un análisis profundo: revisá campañas y conjuntos, detectá qué rinde y qué se está yendo de costo, y dá recomendaciones CONCRETAS y priorizadas (qué cambiar, por qué, con el dato que lo respalda).
- Por ahora NO podés aplicar cambios en Meta vos mismo: recomendás y el equipo los aplica. Si sugerís un cambio, dejalo accionable (ej: "subí 20% el presupuesto de la campaña X").
- Si los datos son escasos o están en 0, decilo con honestidad en vez de inventar.
- Sé claro y fácil de entender: el que te lee no es un experto en pauta.`;

  const messages: Anthropic.MessageParam[] = incoming.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
    });
    const reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[paid-media chat] anthropic error", e);
    return NextResponse.json({ error: friendlyAiError(e) }, { status: 500 });
  }
}
