/**
 * Genera CAMBIOS estructurados (no prosa) a partir de las métricas de la cuenta:
 * subir/bajar presupuesto, pausar o activar campañas/conjuntos. Cada cambio queda
 * accionable (botón Aplicar) en la UI. Solo on-demand.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import type { AdAccountData, AdSetMetrics } from "@/lib/meta/ads";

const client = new Anthropic();

export interface ProposedChange {
  tipo: "presupuesto" | "pausar" | "activar";
  nivel: "campaña" | "conjunto";
  target_id: string;
  target_nombre: string;
  valor_actual: number | string | null; // ppto actual (número) o estado (texto)
  valor_nuevo: number | string | null; // ppto nuevo (número) o "PAUSED"/"ACTIVE"
  moneda?: string;
  motivo: string;
  prioridad: "alta" | "media" | "baja";
}

export interface SuggestInput {
  cliente: string;
  objetivo: string | null;
  negocio: string;
  data: AdAccountData;
  adsets: AdSetMetrics[];
}

const SYSTEM = `Sos el optimizador de Paid Media de JD Media (Córdoba, Argentina). A partir de las métricas de una cuenta de Meta Ads, proponés CAMBIOS CONCRETOS y accionables para mejorar el resultado según el objetivo del cliente.

Te paso campañas y conjuntos con su id, nombre, estado, presupuesto diario (en la moneda de la cuenta) y métricas (gasto, clicks, CTR, CPC, conversiones, costo por conversión).

Devolvé SOLO un objeto JSON válido (sin texto ni markdown alrededor) con esta forma exacta:
{
  "cambios": [
    {
      "tipo": "presupuesto" | "pausar" | "activar",
      "nivel": "campaña" | "conjunto",
      "target_id": "el id EXACTO que te di (no lo inventes)",
      "target_nombre": "nombre",
      "valor_actual": número (ppto actual) o el estado actual para pausar/activar,
      "valor_nuevo": número (ppto nuevo en la moneda) o "PAUSED"/"ACTIVE",
      "motivo": "por qué, con el dato que lo respalda",
      "prioridad": "alta" | "media" | "baja"
    }
  ]
}

Reglas:
- Entre 0 y 8 cambios, priorizados. Si no hay nada claro para cambiar, devolvé "cambios": [].
- "presupuesto": SUBÍ presupuesto a lo que rinde bien y tiene techo; BAJÁ a lo caro/ineficiente. valor_nuevo es el NUEVO presupuesto diario total (no el delta).
- "pausar": para campañas/conjuntos que gastan sin NINGÚN resultado. "activar": solo si están en PAUSED y conviene reactivarlos.
- Usá SIEMPRE el target_id exacto que te di. No inventes ids ni nombres.

JUZGÁ SEGÚN EL OBJETIVO — el "resultado" NO es siempre una conversión:
- Cada campaña/conjunto trae "RESULTADOS" con lo que realmente logró (interacciones, seguidores, clicks, reproducciones, mensajes, leads, compras). Evaluá el costo por ESE resultado, no las conversiones.
- Interacción/seguidores → mirá interacciones y seguidores; tráfico → clicks/landing; awareness → alcance; leads/ventas → recién ahí conversiones.
- PROHIBIDO pausar o llamar "sin resultado" a una campaña que sumó interacciones, seguidores o clicks solo porque tiene 0 conversiones. Si algo con presupuesto NO trae ningún resultado de su objetivo, ahí sí sugerí pausar o revisar.
- Español rioplatense, motivos concretos, sin emojis.`;

function buildUser(p: SuggestInput): string {
  const fmtRes = (rs: { tipo: string; valor: number; costo: number | null }[]) =>
    rs.length
      ? rs.map((r) => `${r.valor} ${r.tipo}${r.costo != null ? ` (a ${r.costo})` : ""}`).join(", ")
      : "ninguno registrado";
  const m = p.data.account;
  const camps = p.data.campaigns
    .map(
      (c) =>
        `CAMPAÑA id=${c.id} "${c.nombre}" [${c.estado}${
          c.objetivo ? ` · objetivo ${c.objetivo}` : ""
        }${
          c.daily_budget != null ? ` · ppto/día ${c.daily_budget}` : " · sin ppto propio"
        }]: gasto ${c.spend}, clicks ${c.clicks}, CTR ${c.ctr ?? "-"}%, CPC ${
          c.cpc ?? "-"
        }. RESULTADOS: ${fmtRes(c.resultados)}`
    )
    .join("\n");
  const sets = p.adsets
    .map(
      (s) =>
        `CONJUNTO id=${s.id} "${s.nombre}" (campaña: ${s.campana ?? "?"}) [${s.estado}${
          s.daily_budget != null ? ` · ppto/día ${s.daily_budget}` : " · sin ppto propio"
        }]: gasto ${s.spend}, clicks ${s.clicks}, CTR ${s.ctr ?? "-"}%, CPC ${
          s.cpc ?? "-"
        }. RESULTADOS: ${fmtRes(s.resultados)}`
    )
    .join("\n");
  return [
    `Cliente: ${p.cliente}`,
    `Objetivo de pauta: ${p.objetivo ?? "no definido"}`,
    `Moneda: ${m.moneda}`,
    `Contexto del negocio: ${p.negocio}`,
    ``,
    `Cuenta (30 días): gasto ${m.spend}. Resultados: ${fmtRes(m.resultados)}`,
    ``,
    `Campañas:`,
    camps || "(sin campañas)",
    ``,
    `Conjuntos:`,
    sets || "(sin conjuntos)",
  ].join("\n");
}

function safeParse(text: string, validIds: Set<string>): ProposedChange[] {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as { cambios?: unknown };
    const arr = Array.isArray(obj.cambios) ? obj.cambios : [];
    return arr
      .map((x) => x as Record<string, unknown>)
      .filter(
        (c) =>
          (c.tipo === "presupuesto" || c.tipo === "pausar" || c.tipo === "activar") &&
          typeof c.target_id === "string" &&
          validIds.has(c.target_id)
      )
      .map((c) => ({
        tipo: c.tipo as ProposedChange["tipo"],
        nivel: c.nivel === "conjunto" ? "conjunto" : "campaña",
        target_id: String(c.target_id),
        target_nombre: typeof c.target_nombre === "string" ? c.target_nombre : "",
        valor_actual:
          typeof c.valor_actual === "number" || typeof c.valor_actual === "string"
            ? c.valor_actual
            : null,
        valor_nuevo:
          typeof c.valor_nuevo === "number" || typeof c.valor_nuevo === "string"
            ? c.valor_nuevo
            : null,
        motivo: typeof c.motivo === "string" ? c.motivo : "",
        prioridad:
          c.prioridad === "alta" || c.prioridad === "baja" ? c.prioridad : "media",
      }));
  } catch {
    return [];
  }
}

export async function suggestPaidMediaChanges(p: SuggestInput): Promise<ProposedChange[]> {
  const validIds = new Set<string>([
    ...p.data.campaigns.map((c) => c.id),
    ...p.adsets.map((s) => s.id),
  ]);
  const msg = await client.messages.create({
    model: AI_MODEL_SMART,
    max_tokens: 1500,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUser(p) }],
  });
  void trackAiUsage({ ruta: "paid-media/sugerencias", modelo: AI_MODEL_SMART, usage: msg.usage });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return safeParse(text, validIds);
}
