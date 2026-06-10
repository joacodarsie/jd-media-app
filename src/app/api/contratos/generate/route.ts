import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireRole } from "@/lib/auth";
import { AI_MODEL_SMART } from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const client = new Anthropic();
const MODEL = AI_MODEL_SMART;

function systemPrompt() {
  return `Sos un abogado especializado en contratos de prestacion de servicios para emprendimientos en **Argentina**. Tu cliente es **JD Media**, una agencia de marketing digital cordobesa.

JD Media trabaja con un equipo de freelancers/colaboradores **sin relacion de dependencia**, donde cada persona cobra por comision, fee fijo, por entrega o un mix. Necesita un contrato de prestacion de servicios **claro, breve y operativo** — no un mamotreto de 20 hojas.

Tu tarea es redactar el contrato en MARKDOWN, en espanol rioplatense, listo para imprimir. Estructura obligatoria:

1. **Encabezado** con titulo "Contrato de prestacion de servicios profesionales" y dos partes: "La Agencia" (JD Media SAS, o el nombre tal cual lo entreguen) y "El Prestador" (la persona).
2. **Objeto del contrato** — para que se contrata a la persona, que rol cumple. Vincular con el rol/puesto provisto.
3. **Naturaleza del vinculo** — dejar EXPLICITO que es prestacion de servicios autonomos, sin relacion de dependencia, sin exclusividad salvo que se indique. El Prestador es responsable de sus propios aportes, impuestos y monotributo / autonomo.
4. **Compensacion** — describir el esquema (comision / fee / por entrega / mixto) usando EXACTAMENTE el detalle provisto. Si hay un monto de referencia, mencionarlo. Aclarar moneda, periodicidad de pago (mensual, por entrega, etc.), y como se factura (el Prestador entrega factura/recibo).
5. **Plazo** — fecha de inicio. Si hay fecha de fin, indicarla; si no, plazo indefinido con posibilidad de rescision con preaviso de 15 dias por cualquiera de las partes.
6. **Confidencialidad** — si esta activada, clausula corta protegiendo info de clientes, procesos internos, listas y materiales.
7. **Cesion de derechos / propiedad intelectual** — si esta activada, el Prestador cede a JD Media los derechos patrimoniales de todo material creativo producido para clientes de la agencia.
8. **No competencia** — si esta activada, el Prestador se compromete a no prestar servicios a clientes directos de la agencia durante la vigencia y por 6 meses posteriores.
9. **Causales de rescision** — incumplimiento grave, falta de pago, etc.
10. **Domicilios y notificaciones** — placeholders "[DOMICILIO DE LA AGENCIA]" y "[DOMICILIO DEL PRESTADOR]" para completar a mano si no se proveen.
11. **Cierre con firmas** — dos lineas para firma + aclaracion + DNI/CUIT. Fecha al final.

# Reglas de estilo

- **Tono profesional pero accesible**. No abusar de jerga legal. Vos como abogado lo explicas claro.
- **Largo total**: 600-1200 palabras de cuerpo. Que entre en 2-3 hojas A4.
- **Markdown**: usar headings ##, listas - cuando corresponda, **negrita** para terminos clave.
- **NO clausulas que no apliquen**. Si confidencialidad esta en false, no la incluyas. Si cesion de derechos esta en false, no la incluyas.
- **NO inventes datos** que no estan en el input. Usa placeholders [ENTRE CORCHETES] para info faltante.
- **Argentina**: legislacion argentina (Codigo Civil y Comercial), jurisdiccion Cordoba salvo que indiquen otra cosa.

Devolve SOLO el contrato en markdown, sin introduccion ni explicacion. Empezas con # Titulo y terminas con las firmas.`;
}

interface Body {
  nombre_persona: string;
  rol_descripcion?: string | null;
  position_label?: string | null;
  compensation_type:
    | "comision"
    | "fee_fijo"
    | "por_entrega"
    | "por_cliente"
    | "mixto";
  compensation_detail?: string | null;
  monto_referencia?: number | null;
  moneda?: string;
  confidentiality?: boolean;
  cesion_derechos?: boolean;
  no_competencia?: boolean;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  agency_name?: string | null;
  /** Datos de la agencia (representante legal). */
  agency_representative_name?: string | null;
  agency_representative_cuit?: string | null;
  agency_address?: string | null;
  /** Datos del prestador. */
  prestador_cuit?: string | null;
  prestador_address?: string | null;
  prestador_dni?: string | null;
  /** Para tipo 'por_cliente': cantidad y nombres de clientes asignados. */
  clients_assigned_count?: number | null;
  clients_assigned_names?: string[] | null;
  notas?: string | null;
}

const TYPE_LABEL: Record<Body["compensation_type"], string> = {
  comision: "Comision (% sobre facturacion del cliente / cobro)",
  fee_fijo: "Fee fijo mensual",
  por_entrega: "Pago por entrega / produccion",
  por_cliente: "Monto fijo por cada cliente que tenga asignado",
  mixto: "Esquema mixto (fee + comision o variable)",
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }
  await requireRole(["admin", "coordinador"]);
  const body = (await req.json()) as Body;
  if (!body.nombre_persona?.trim()) {
    return NextResponse.json(
      { error: "Falta el nombre del prestador" },
      { status: 400 }
    );
  }

  const datos = [
    `Nombre del prestador: ${body.nombre_persona}`,
    body.position_label
      ? `Puesto/cargo: ${body.position_label}`
      : null,
    body.rol_descripcion
      ? `Descripcion del rol: ${body.rol_descripcion}`
      : null,
    `Tipo de compensacion: ${TYPE_LABEL[body.compensation_type]}`,
    body.compensation_detail
      ? `Detalle de compensacion: ${body.compensation_detail}`
      : null,
    body.monto_referencia != null
      ? `Monto de referencia: ${body.monto_referencia} ${body.moneda ?? "ARS"}`
      : null,
    `Moneda: ${body.moneda ?? "ARS"}`,
    `Confidencialidad: ${body.confidentiality ? "SI" : "NO"}`,
    `Cesion de derechos creativos: ${body.cesion_derechos ? "SI" : "NO"}`,
    `No competencia: ${body.no_competencia ? "SI" : "NO"}`,
    body.fecha_inicio ? `Fecha de inicio: ${body.fecha_inicio}` : null,
    body.fecha_fin
      ? `Fecha de fin: ${body.fecha_fin}`
      : "Vigencia: indefinida",
    `Nombre de la agencia: ${body.agency_name?.trim() || "JD Media"}`,
    body.agency_representative_name
      ? `Representante legal de la agencia: ${body.agency_representative_name}${
          body.agency_representative_cuit
            ? ` (CUIT ${body.agency_representative_cuit})`
            : ""
        }`
      : null,
    body.agency_address
      ? `Domicilio de la agencia: ${body.agency_address}`
      : null,
    body.prestador_cuit
      ? `CUIT del prestador: ${body.prestador_cuit}`
      : null,
    body.prestador_dni ? `DNI del prestador: ${body.prestador_dni}` : null,
    body.prestador_address
      ? `Domicilio del prestador: ${body.prestador_address}`
      : null,
    body.compensation_type === "por_cliente" && body.clients_assigned_count
      ? `Clientes actualmente asignados al prestador: ${body.clients_assigned_count}${
          body.clients_assigned_names?.length
            ? ` (${body.clients_assigned_names.join(", ")})`
            : ""
        }`
      : null,
    body.compensation_type === "por_cliente" && body.monto_referencia
      ? `IMPORTANTE: el monto por cliente es ${body.monto_referencia} ${body.moneda ?? "ARS"}. La compensacion total mensual es el monto x la cantidad de clientes asignados. Esta cantidad puede variar mes a mes — el contrato debe contemplarlo y explicar la formula claramente.`
      : null,
    body.notas ? `Notas adicionales: ${body.notas}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: `Generame el contrato con estos datos:\n\n${datos}`,
        },
      ],
    });
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ content_md: reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
