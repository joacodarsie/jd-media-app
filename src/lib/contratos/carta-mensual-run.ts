import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_PM } from "@/lib/tareas/puerta";
import { isClientPausedFor } from "@/lib/client-pause";
import { reminderAmount, whatsappLink, type ReminderClient } from "@/lib/payment-reminder";
import { claveCartaMensual, mensajeCartaMensual, periodoSiguiente } from "@/lib/contratos/carta-mensual";
import { periodLabel } from "@/lib/finanzas";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "https://jd-media-app.vercel.app";

/**
 * El 25 de cada mes (cron month-end-reminder): una tarea por cuenta activa
 * para la PM, «Carta acuerdo de <mes> — <cuenta>», con el mensaje listo para
 * mandar por WhatsApp (link a la carta en el portal, abono y plazos del
 * material crudo). Vence el 28, antes del cobro del 1 al 5. Idempotente por
 * `rutina_key` (carta:<cuenta>:<período>).
 */
export async function runCartasDelMes(admin: SupabaseClient, hoyYmd: string): Promise<{ periodo: string; creadas: number; yaEstaban: number }> {
  const periodo = periodoSiguiente(hoyYmd);
  const mes = periodLabel(periodo).replace(/ de \d{4}$/, "");

  const [{ data: cl }, { data: us }, { data: toks }] = await Promise.all([
    admin
      .from("clients")
      .select("id, nombre, contacto_nombre, contacto_telefono, monto_mensual, contrato_moneda, contrato_descuento_pct, contrato_descuento_monto, contrato_descuento_meses, contrato_fecha_inicio, fecha_inicio, pausas")
      .eq("estado", "activo")
      .eq("es_interno", false),
    admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true),
    admin.from("client_portal_tokens").select("cliente_id, token, revoked_at, expires_at, created_at").is("revoked_at", null).order("created_at", { ascending: false }),
  ]);
  type Cliente = ReminderClient & { id: string; contacto_telefono: string | null; pausas: string[] | null };
  const clientes = ((cl ?? []) as Cliente[]).filter((c) => !isClientPausedFor(c.pausas, periodo));
  const gente = (us ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const pm = gente.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? null;
  const adminId = gente.find((u) => u.rol === "admin")?.id ?? null;
  const tokenDe = new Map<string, string>();
  for (const t of (toks ?? []) as { cliente_id: string; token: string; expires_at: string | null }[]) {
    if (t.expires_at && new Date(t.expires_at) < new Date()) continue;
    if (!tokenDe.has(t.cliente_id)) tokenDe.set(t.cliente_id, t.token);
  }

  const tareas = clientes.map((c) => {
    const tok = tokenDe.get(c.id);
    const link = tok ? `${SITIO}/contrato/cliente/${c.id}?token=${tok}` : null;
    const { monto, moneda } = reminderAmount(c, periodo);
    const mensaje = mensajeCartaMensual({ contacto: c.contacto_nombre ?? null, marca: c.nombre, periodo, monto, moneda, link });
    const wa = whatsappLink(c.contacto_telefono, mensaje);
    return {
      titulo: `📄 Carta acuerdo de ${mes} — ${c.nombre}`,
      descripcion: [
        `Mandale al cliente la carta vigente para ${mes}, antes del cobro del 1 al 5. Si es por el grupo, copiá el mensaje; si es al contacto, tocá el link.`,
        wa ? `\nMandar por WhatsApp: ${wa}` : "\n(No tiene teléfono cargado: mandalo por el grupo.)",
        `\nMensaje:\n${mensaje}`,
      ].join("\n"),
      asignado_a_id: pm ?? adminId,
      creado_por_id: adminId,
      cliente_id: c.id,
      area: AREA_PM,
      prioridad: "alta",
      estado: "pendiente",
      fecha_limite: `${hoyYmd.slice(0, 7)}-28`,
      rutina_key: claveCartaMensual(c.id, periodo),
    };
  });
  if (!tareas.length) return { periodo, creadas: 0, yaEstaban: 0 };

  const { data: ya } = await admin.from("tasks").select("rutina_key").in("rutina_key", tareas.map((t) => t.rutina_key));
  const existentes = new Set(((ya ?? []) as { rutina_key: string }[]).map((r) => r.rutina_key));
  const nuevas = tareas.filter((t) => !existentes.has(t.rutina_key));
  if (nuevas.length) {
    const { error } = await admin.from("tasks").insert(nuevas);
    if (error) throw new Error(error.message);
  }
  return { periodo, creadas: nuevas.length, yaEstaban: existentes.size };
}
