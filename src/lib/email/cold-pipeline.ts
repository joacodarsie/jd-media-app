/**
 * La cadena completa del email en frío, sin manos.
 *
 * Hasta ahora eran tres botones que había que apretar en orden todos los días:
 * "Buscar emails" en cada campaña → "Programar" en cada campaña → "Mandar el
 * lote". Si uno se salteaba, no salía nada y nadie se enteraba. Ahora el cron
 * diario hace los tres pasos seguidos:
 *
 *   1. Busca el mail en el sitio web de los contactos que todavía no lo tienen.
 *   2. Encola a los que quedaron con mail y nunca recibieron nada.
 *   3. Manda el lote del día, respetando la rampa de calentamiento.
 *
 * Los frenos siguen donde estaban: el tope diario con rampa (25 → 50 → 100),
 * la lista de bajas y el "no repetir" viven en `runColdEmailBatch`/
 * `programarEnvios`, así que esto no puede mandar de más ni mandar dos veces.
 *
 * Lo que NO hace a propósito: traer contactos nuevos. Eso usa Google Places o
 * la IA, que cuestan plata por búsqueda; se sigue disparando a mano.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { completarEmails } from "@/lib/prospecting/email-fill";
import { mensajeElegido } from "@/lib/prospecting/shared";
import { coldEmailConfig, programarEnvios, runColdEmailBatch } from "./cold-sender";

export interface CampanaEncolable {
  id: string;
  nombre: string | null;
  estado: string | null;
  mensajes_plantilla?: Parameters<typeof mensajeElegido>[0];
}

/**
 * Cuáles de las campañas se pueden encolar solas: activas y con un mensaje
 * elegido. Sin mensaje no hay qué mandar, y una campaña pausada es una decisión
 * explícita del dueño que el cron no debe pisar.
 */
export function campanasParaEncolar<T extends CampanaEncolable>(campanas: T[]): T[] {
  return campanas.filter((c) => c.estado === "activa" && !!mensajeElegido(c.mensajes_plantilla));
}

export interface PipelineResultado {
  configurado: boolean;
  emailsNuevos: number;
  sitiosPendientes: number;
  encolados: number;
  enviados: number;
  errores: number;
  pendientes: number;
  detalle: string[];
}

export async function runColdEmailPipeline(
  opts: { sitios?: number } = {}
): Promise<PipelineResultado> {
  const detalle: string[] = [];
  const cfg = coldEmailConfig();
  if (!cfg.configurado) {
    return {
      configurado: false,
      emailsNuevos: 0,
      sitiosPendientes: 0,
      encolados: 0,
      enviados: 0,
      errores: 0,
      pendientes: 0,
      detalle: cfg.faltan.map((f) => `Falta ${f}`),
    };
  }

  const admin = createAdmin();

  // 1) Mails nuevos desde los sitios web.
  const emails = await completarEmails(admin, { limite: opts.sitios });
  if (emails.error) detalle.push(`Buscar emails: ${emails.error}`);

  // 2) Encolar lo que haya quedado con mail.
  let encolados = 0;
  const { data: campRaw, error: campErr } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, estado, mensajes_plantilla");
  if (campErr) detalle.push(`Campañas: ${campErr.message}`);

  for (const c of campanasParaEncolar((campRaw ?? []) as CampanaEncolable[])) {
    const r = await programarEnvios({ campaignId: c.id });
    if (r.error) detalle.push(`${c.nombre ?? c.id}: ${r.error}`);
    encolados += r.programados;
  }

  // 3) Mandar el lote del día.
  const lote = await runColdEmailBatch();
  detalle.push(...lote.detalle);

  return {
    configurado: true,
    emailsNuevos: emails.encontrados,
    sitiosPendientes: emails.pendientes,
    encolados,
    enviados: lote.enviados,
    errores: lote.errores,
    pendientes: lote.pendientes,
    detalle,
  };
}
