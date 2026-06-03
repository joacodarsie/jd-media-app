"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import { AGENCY } from "@/lib/agency";
import type { ServiceType, ClientService } from "@/lib/types";

type StepKey =
  | "carta_enviada_at"
  | "pago_recibido_at"
  | "equipo_asignado_at"
  | "grupo_wpp_creado_at"
  | "mensajes_enviados_at"
  | "diagnostico_generado_at"
  | "tareas_iniciales_at"
  | "kickoff_agendado_at"
  | "meet_guide_generated_at";

const VALID_STEPS: StepKey[] = [
  "carta_enviada_at",
  "pago_recibido_at",
  "equipo_asignado_at",
  "grupo_wpp_creado_at",
  "mensajes_enviados_at",
  "diagnostico_generado_at",
  "tareas_iniciales_at",
  "kickoff_agendado_at",
  "meet_guide_generated_at",
];

export async function toggleOnboardingStep(
  clientId: string,
  step: StepKey,
  done: boolean
) {
  await requireUser();
  if (!VALID_STEPS.includes(step)) return { error: "Paso inválido" };
  const admin = createAdmin();
  const value = done ? new Date().toISOString() : null;

  const { error } = await admin
    .from("client_onboarding")
    .upsert(
      { cliente_id: clientId, [step]: value },
      { onConflict: "cliente_id" }
    );
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function assignContractNumber(clientId: string) {
  await requireUser();
  const admin = createAdmin();
  const year = new Date().getFullYear();
  const { data: seq, error: seqErr } = await admin.rpc("next_contract_number", {
    p_year: year,
  });
  if (seqErr) return { error: seqErr.message };
  const numero = `JD-${year}-${String(seq).padStart(4, "0")}`;
  const { error } = await admin
    .from("clients")
    .update({ contrato_numero: numero })
    .eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, numero };
}

/** Crea tareas iniciales según los servicios contratados del cliente. */
export async function generateInitialTasks(clientId: string) {
  const me = await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, creativa_asignada_id, cm_id, disenador_id, audiovisual_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return { error: "Cliente no encontrado" };

  const { data: services } = await supabase
    .from("client_services")
    .select("tipo, monto_mensual")
    .eq("cliente_id", clientId)
    .eq("activo", true);

  const c = client as {
    id: string;
    nombre: string;
    creativa_asignada_id: string | null;
    cm_id: string | null;
    disenador_id: string | null;
    audiovisual_id: string | null;
  };
  const svcTypes = new Set(((services ?? []) as ClientService[]).map((s) => s.tipo));

  type TemplateTask = {
    titulo: string;
    descripcion: string;
    area: string;
    asignado_a_id: string | null;
    diasPlazo: number;
  };
  const tasks: TemplateTask[] = [];

  function add(
    when: number,
    titulo: string,
    descripcion: string,
    area: string,
    asignado: string | null
  ) {
    tasks.push({
      titulo,
      descripcion,
      area,
      asignado_a_id: asignado ?? c.creativa_asignada_id ?? null,
      diasPlazo: when,
    });
  }

  if (svcTypes.has("gestion_redes" as ServiceType)) {
    add(2, "Auditoría inicial de redes",
      "Revisar perfiles actuales del cliente, performance histórica, contenido publicado y oportunidades.",
      "Creativas", c.creativa_asignada_id);
    add(5, "Manual de marca",
      "Definir paleta, tipografías, tono de voz, do/don'ts y guidelines visuales.",
      "Creativas", c.creativa_asignada_id);
    add(7, "Diagnóstico inicial (PDF)",
      "Estrategia, plan de acción, pilares de contenido y lineamientos. Compartir con el cliente.",
      "Creativas", c.creativa_asignada_id);
    add(10, "Moodboard",
      "Armar moodboard visual para definir estética del feed.",
      "Diseño", c.disenador_id);
    add(10, "Primer calendario de contenidos",
      "Calendario mensual con copys, formatos y referencias. Pasar a aprobación del cliente.",
      "Creativas", c.creativa_asignada_id);
    add(14, "Optimización de perfiles",
      "Bio, foto, historias destacadas, links, portadas.",
      "Diseño", c.disenador_id);
  }

  if (svcTypes.has("paid_media" as ServiceType)) {
    add(3, "Setup Business Manager + accesos",
      "Verificar accesos a Meta Business Manager / Google Ads. Configurar permisos.",
      "Paid Media", null);
    add(5, "Píxel / conversiones",
      "Implementar/verificar píxel de Meta y conversiones en GA4.",
      "Paid Media", null);
    add(7, "Definición de objetivos y KPIs",
      "Acordar con el cliente objetivos (leads, ventas, ROAS) y KPIs medibles.",
      "Paid Media", null);
    add(10, "Primera campaña configurada",
      "Estructura de campañas, segmentaciones, presupuestos y creatividades.",
      "Paid Media", null);
  }

  if (svcTypes.has("edicion_audiovisual" as ServiceType)) {
    add(7, "Coordinar primera jornada de producción",
      "Definir fecha, locación, listado de tomas y briefing.",
      "Edición Audiovisual", c.audiovisual_id);
  }

  if (svcTypes.has("diseno_grafico" as ServiceType)) {
    add(3, "Brief de diseño",
      "Recibir brief detallado del cliente: necesidades, referencias, plazos.",
      "Diseño", c.disenador_id);
    add(7, "Manual de marca visual",
      "Si no existe, armar guidelines visuales mínimos para asegurar consistencia.",
      "Diseño", c.disenador_id);
  }

  if (svcTypes.has("desarrollo_web" as ServiceType)) {
    add(5, "Análisis de requerimientos",
      "Relevar funcionalidades, integraciones, contenidos y plazos.",
      "Desarrollo Web", null);
    add(10, "Wireframes iniciales",
      "Diseñar wireframes de las páginas principales para aprobación.",
      "Desarrollo Web", null);
  }

  if (svcTypes.has("botly" as ServiceType)) {
    add(5, "Definir flow del bot",
      "Mapear flujos de conversación, intenciones, integraciones necesarias.",
      "Botly", null);
  }

  // Tareas comunes a TODOS los clientes
  add(1, "Reunión de kickoff",
    `Primera reunión con el cliente. Presentar equipo asignado, cronograma y siguientes pasos.`,
    "Creativas", c.creativa_asignada_id);
  add(2, "Pedir accesos y material",
    "Solicitar al cliente: accesos a redes, fotos/videos existentes, logos, brand assets.",
    "Creativas", c.creativa_asignada_id);

  if (tasks.length === 0) {
    return { error: "No hay servicios contratados activos para generar tareas." };
  }

  const today = new Date();
  const rows = tasks.map((t) => ({
    titulo: t.titulo,
    descripcion: t.descripcion,
    cliente_id: clientId,
    asignado_a_id: t.asignado_a_id,
    creado_por_id: me.id,
    area: t.area,
    prioridad: "media",
    estado: "pendiente",
    fecha_limite: new Date(today.getTime() + t.diasPlazo * 86400000)
      .toISOString()
      .slice(0, 10),
  }));

  const { error } = await admin.from("tasks").insert(rows);
  if (error) return { error: error.message };

  // Marcar el paso como hecho
  await admin
    .from("client_onboarding")
    .upsert(
      { cliente_id: clientId, tareas_iniciales_at: new Date().toISOString() },
      { onConflict: "cliente_id" }
    );

  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, count: rows.length };
}

/** Devuelve los textos de bienvenida (cadena de mensajes) personalizados según servicios. */
export async function buildWelcomeMessages(clientId: string): Promise<
  { ok: true; messages: string[] } | { ok: false; error: string }
> {
  await requireUser();
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("nombre, contacto_nombre, creativa:users!clients_creativa_asignada_id_fkey(nombre)")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { ok: false, error: "Cliente no encontrado" };

  const { data: services } = await supabase
    .from("client_services")
    .select("tipo")
    .eq("cliente_id", clientId)
    .eq("activo", true);

  const svcTypes = new Set(((services ?? []) as ClientService[]).map((s) => s.tipo));
  const c = client as {
    nombre: string;
    contacto_nombre: string | null;
    creativa: { nombre?: string } | { nombre?: string }[] | null;
  };
  const creativaName = Array.isArray(c.creativa)
    ? c.creativa[0]?.nombre
    : c.creativa?.nombre;
  const nombreContacto = (c.contacto_nombre ?? c.nombre).split(" ")[0];

  const m1 = `Hola ${nombreContacto}!! 👋 Bienvenido al grupo de trabajo de JD Media.

${creativaName ? `${creativaName} va a estar a cargo` : "Vamos a estar a cargo"} de la estrategia general y del seguimiento del proyecto.

Este grupo lo vamos a usar para centralizar toda la comunicación del proyecto:
– coordinación general
– envío de calendarios de contenido para aprobación
– informes y reportes de avances
– coordinación de jornadas de producción
– envío de links útiles (Drive, materiales, etc.)

La idea es que todo pase por acá, así trabajamos ordenados 🚀`;

  // Mensaje 2 — Cronograma adaptado a los servicios
  const cronoLines: string[] = [];
  cronoLines.push("Para que tengas claridad desde el inicio, te contamos cómo es el proceso del primer mes 👇");
  cronoLines.push("");

  if (svcTypes.has("gestion_redes" as ServiceType)) {
    cronoLines.push("🗓️ Semana 1");
    cronoLines.push("– Reunión de onboarding para alinear objetivos, expectativas y conocer la marca a fondo");
    cronoLines.push("– Análisis de la situación inicial y del entorno");
    cronoLines.push("– Manual de marca y moodboard");
    cronoLines.push("– Diagnóstico inicial (PDF) con la estrategia, los pilares de contenido y el plan de acción");
    cronoLines.push("– Armado del primer calendario de contenidos");
    cronoLines.push("");
    cronoLines.push("🗓️ A partir del día 8");
    cronoLines.push("– Optimización de los perfiles (bio, foto, historias destacadas, links, portadas)");
    cronoLines.push("– Empezamos a publicar las primeras piezas, ya con el calendario aprobado");
    cronoLines.push("");
    cronoLines.push("🗓️ A partir del día 14");
    cronoLines.push("– Con las primeras publicaciones ya funcionando, ponemos en marcha las campañas para amplificar el alcance y potenciar los resultados");
  }

  if (svcTypes.has("paid_media" as ServiceType)) {
    if (cronoLines.length > 1) cronoLines.push("");
    cronoLines.push("📈 Paid Media (primeros 14 días)");
    cronoLines.push("– Setup de Business Manager y verificación de accesos");
    cronoLines.push("– Implementación de píxel y conversiones");
    cronoLines.push("– Definición de objetivos y KPIs medibles");
    cronoLines.push("– Configuración de la primera campaña");
  }

  if (svcTypes.has("desarrollo_web" as ServiceType)) {
    if (cronoLines.length > 1) cronoLines.push("");
    cronoLines.push("💻 Desarrollo web");
    cronoLines.push("– Relevamiento de requerimientos");
    cronoLines.push("– Wireframes y aprobación de UX");
    cronoLines.push("– Inicio de desarrollo");
  }

  if (svcTypes.has("diseno_grafico" as ServiceType) && !svcTypes.has("gestion_redes" as ServiceType)) {
    if (cronoLines.length > 1) cronoLines.push("");
    cronoLines.push("🎨 Diseño gráfico");
    cronoLines.push("– Brief inicial y referencias");
    cronoLines.push("– Manual de marca visual");
    cronoLines.push("– Producción de piezas según calendario acordado");
  }

  const m2 = cronoLines.join("\n");

  // Mensaje 3 — Drive / canal de contenido (solo si hay gestión de contenido)
  const m3 = (svcTypes.has("gestion_redes" as ServiceType) ||
    svcTypes.has("edicion_audiovisual" as ServiceType))
    ? `Durante el proceso te vamos a compartir por acá el link al Drive del proyecto, donde vas a encontrar:
📁 Contenido crudo: fotos y videos de jornadas de producción o material que nos compartas
📁 Calendario de contenidos: piezas ya editadas y organizadas para publicar

Si en algún momento tenés una idea puntual, una necesidad específica o querés sumar/modificar algún contenido, podés avisarnos por acá. Nosotros nos encargamos de adaptar el calendario para integrar eso de la mejor manera 👍`
    : "";

  // Mensaje 4 — Qué necesitamos
  const accesosLines = ["🔑 Accesos a las cuentas"];
  if (svcTypes.has("gestion_redes" as ServiceType)) {
    accesosLines[0] += " (Instagram, Facebook, Business Manager según corresponda)";
  } else if (svcTypes.has("paid_media" as ServiceType)) {
    accesosLines[0] += " (Meta Business Manager, Google Ads según corresponda)";
  }

  const m4 = `Para poder avanzar sin trabas desde el inicio, vamos a necesitar que nos compartas:
${accesosLines.join("\n")}
📂 Material existente de la marca (fotos, videos, logos, carpetas de trabajo, etc.)

Lo ideal es que nos lo envíes por link de Drive o carpeta comprimida, así no se pierde calidad del contenido.

Con eso ya podemos arrancar a trabajar con material original desde el primer momento 👍`;

  const messages = [m1, m2];
  if (m3) messages.push(m3);
  messages.push(m4);

  // Etiquetar etapa como "lista para mandar" (no la marco como enviada hasta que el user lo confirme)
  // El user vendrá y tocará "Marcar mensajes enviados" después.

  return { ok: true, messages };
}

/**
 * Genera el mensaje de cobro que se envía al cliente junto con la carta acuerdo.
 * Calcula automáticamente el proporcional si la fecha de inicio no es día 1.
 */
export async function buildPaymentMessage(clientId: string): Promise<
  | {
      ok: true;
      message: string;
      breakdown: {
        moneda: string;
        totalMensual: number;
        montoConDescuento: number | null;
        montoEsteMes: number;
        esProporcional: boolean;
        diasRestantes: number;
        diasMes: number;
        fechaInicio: string | null;
      };
    }
  | { ok: false; error: string }
> {
  await requireUser();
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "nombre, contacto_nombre, contrato_fecha_inicio, contrato_descuento_pct, contrato_descuento_meses, contrato_moneda"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return { ok: false, error: "Cliente no encontrado" };

  const { data: services } = await supabase
    .from("client_services")
    .select("monto_mensual")
    .eq("cliente_id", clientId)
    .eq("activo", true);

  const c = client as {
    nombre: string;
    contacto_nombre: string | null;
    contrato_fecha_inicio: string | null;
    contrato_descuento_pct: number | null;
    contrato_descuento_meses: number | null;
    contrato_moneda: string | null;
  };
  const moneda = c.contrato_moneda ?? "ARS";
  const totalMensual = (services ?? []).reduce(
    (acc, s) => acc + (Number(s.monto_mensual) || 0),
    0
  );

  const descPct = Number(c.contrato_descuento_pct) || 0;
  const descMeses = Number(c.contrato_descuento_meses) || 0;
  const hayDescuento = descPct > 0 && descMeses > 0;
  const montoEffective = hayDescuento ? totalMensual * (1 - descPct / 100) : totalMensual;

  // Cálculo proporcional
  const inicio = c.contrato_fecha_inicio
    ? new Date(c.contrato_fecha_inicio + "T00:00:00")
    : null;
  let esProporcional = false;
  let diasRestantes = 0;
  let diasMes = 30;
  let montoEsteMes = montoEffective;

  if (inicio) {
    const día = inicio.getDate();
    diasMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
    diasRestantes = diasMes - día + 1;
    if (día !== 1) {
      esProporcional = true;
      // Prorrateo y redondeo a múltiplos de 10
      const prorrateado = (montoEffective * diasRestantes) / diasMes;
      montoEsteMes = Math.round(prorrateado / 10) * 10;
    }
  }

  function fmtMoney(n: number) {
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

  function fmtShort(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  const nombre = (c.contacto_nombre ?? c.nombre).split(" ")[0];

  const lines: string[] = [];
  lines.push(`Listo ${nombre}, te envío la carta acuerdo junto con el alcance de los servicios contratados.`);
  lines.push("");

  if (esProporcional && inicio) {
    const fechaFin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
    const fechaFinIso = fechaFin.toISOString().slice(0, 10);
    lines.push(
      `En caso de dar inicio al servicio el día ${fmtShort(c.contrato_fecha_inicio!)}, corresponde abonar un proporcional equivalente a ${fmtMoney(montoEsteMes)}, que cubre el período comprendido entre el ${fmtShort(c.contrato_fecha_inicio!)} y el ${fmtShort(fechaFinIso)}.`
    );
    lines.push(`A partir del próximo mes, el monto será de ${fmtMoney(montoEffective)} mensuales, como acordamos.`);
  } else {
    lines.push(`El monto mensual del servicio es de ${fmtMoney(montoEffective)}, como acordamos.`);
    if (inicio) {
      lines.push(`Fecha de inicio: ${fmtShort(c.contrato_fecha_inicio!)}.`);
    }
  }

  if (hayDescuento) {
    lines.push("");
    lines.push(
      `📌 Recordá que durante los primeros ${descMeses} ${descMeses === 1 ? "mes" : "meses"} aplica el descuento promocional del ${descPct}%. Luego se factura el monto pleno.`
    );
  }

  lines.push("");
  lines.push("👉 Datos para transferencia:");
  lines.push(`Banco: ${AGENCY.bank.nombre}`);
  lines.push(`Alias: ${AGENCY.bank.alias}`);
  lines.push(`Titular: ${AGENCY.bank.titular}`);
  lines.push(`CUIL: ${AGENCY.bank.cuil}`);
  lines.push("");
  lines.push("Una vez realizado el pago, el servicio queda vigente y arrancamos 🚀");
  lines.push(`Cualquier duda comentame ${nombre}!`);

  return {
    ok: true,
    message: lines.join("\n"),
    breakdown: {
      moneda,
      totalMensual,
      montoConDescuento: hayDescuento ? montoEffective : null,
      montoEsteMes,
      esProporcional,
      diasRestantes,
      diasMes,
      fechaInicio: c.contrato_fecha_inicio,
    },
  };
}

void SERVICE_TYPE_LABEL; // mantener import por si lo usamos más adelante
