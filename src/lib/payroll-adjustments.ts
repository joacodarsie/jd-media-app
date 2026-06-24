/**
 * Asistente de nómina con IA. El admin escribe en criollo los ajustes/extras del
 * mes ("a Brisa sumale 20 lucas por los carruseles extra, a Guille descontale un
 * adelanto de 50 mil") y la IA los traduce a ítems concretos de payroll_items,
 * mapeando nombres → userId y clientes → clienteId contra las listas reales.
 *
 * Server-only (usa la API de Anthropic). NO aplica nada: devuelve una propuesta
 * para que el admin revise y confirme.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL_FAST } from "@/lib/ai/models";

export interface AdjustmentTeamMember {
  userId: string;
  nombre: string;
  rol: string;
  total: number;
}

export interface AdjustmentClient {
  id: string;
  nombre: string;
}

export interface ProposedAdjustment {
  userId: string;
  nombre: string;
  tipo: "extra" | "ajuste";
  concepto: string;
  monto: number;
  clienteId: string | null;
  cliente: string | null;
}

function safeParse(
  raw: string,
  team: AdjustmentTeamMember[],
  clients: AdjustmentClient[]
): { items: ProposedAdjustment[]; nota: string } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const teamById = new Map(team.map((t) => [t.userId, t]));
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const items: ProposedAdjustment[] = Array.isArray(o.items)
    ? (o.items as Record<string, unknown>[])
        .map((it) => {
          const member = teamById.get(String(it.userId));
          const monto = Number(it.monto);
          if (!member || !Number.isFinite(monto) || monto === 0) return null;
          const clienteId =
            typeof it.clienteId === "string" && clientById.has(it.clienteId)
              ? it.clienteId
              : null;
          const tipo: "extra" | "ajuste" = it.tipo === "ajuste" ? "ajuste" : "extra";
          const concepto = typeof it.concepto === "string" ? it.concepto.trim() : "";
          if (!concepto) return null;
          return {
            userId: member.userId,
            nombre: member.nombre,
            tipo,
            concepto,
            monto: Math.round(monto),
            clienteId,
            cliente: clienteId ? clientById.get(clienteId)?.nombre ?? null : null,
          };
        })
        .filter((x): x is ProposedAdjustment => x !== null)
        .slice(0, 20)
    : [];

  return { items, nota: typeof o.nota === "string" ? o.nota : "" };
}

const SYSTEM = `Sos el asistente de nómina de JD Media, una agencia de marketing digital de Córdoba, Argentina. El admin te escribe en criollo (español rioplatense) los ajustes y extras que quiere cargar al sueldo del mes de su equipo, y vos los traducís a ítems concretos.

REGLAS
- Solo podés cargar ítems para las personas de la lista del equipo que te paso, usando su "userId" EXACTO. Si no podés identificar con seguridad a quién se refiere, no inventes: omití ese ítem.
- "tipo" es "extra" (suma algo: un premio, piezas extra, una jornada) o "ajuste" (corrección, puede ser NEGATIVA: un descuento, un adelanto, una resta).
- "monto" en pesos argentinos (ARS), número entero. Negativo para descuentos/adelantos.
- Si el ajuste es un porcentaje del sueldo de la persona ("subile 10%"), calculalo sobre su "total" actual que te paso.
- "clienteId" solo si el ítem está claramente asociado a un cliente de la lista; si no, null.
- "concepto" corto y claro (ej: "Carruseles extra", "Adelanto descontado", "Premio del mes").

SALIDA
Respondé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto antes ni después):
{
  "items": [
    { "userId": string, "tipo": "extra"|"ajuste", "concepto": string, "monto": number, "clienteId": string|null }
  ],
  "nota": string   // 1 frase opcional aclarando supuestos o lo que no pudiste mapear; "" si está todo claro
}`;

/**
 * Le pasa a la IA la instrucción en criollo + el equipo y los clientes, y
 * devuelve los ítems propuestos (ya validados contra las listas). No persiste.
 */
export async function proposePayrollAdjustments(
  instrucciones: string,
  team: AdjustmentTeamMember[],
  clients: AdjustmentClient[]
): Promise<{ items: ProposedAdjustment[]; nota: string } | null> {
  const client = new Anthropic();
  const contexto = {
    equipo: team.map((t) => ({ userId: t.userId, nombre: t.nombre, rol: t.rol, total: t.total })),
    clientes: clients.map((c) => ({ clienteId: c.id, nombre: c.nombre })),
  };
  const msg = await client.messages.create({
    model: AI_MODEL_FAST,
    max_tokens: 1500,
    system: [{ type: "text", text: SYSTEM }],
    messages: [
      {
        role: "user",
        content:
          `EQUIPO Y CLIENTES (usá estos id exactos):\n${JSON.stringify(contexto, null, 2)}\n\n` +
          `INSTRUCCIÓN DEL ADMIN:\n${instrucciones}`,
      },
    ],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return safeParse(text, team, clients);
}
