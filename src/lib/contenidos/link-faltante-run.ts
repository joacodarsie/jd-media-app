/**
 * El ejecutor del recordatorio de links faltantes.
 *
 * La decisión de a quién y qué decirle vive en `link-faltante.ts` (puro y
 * testeado); acá solo se habla con la base.
 *
 * Se manda una vez por día como mucho: si ya salió hoy, no se repite. Sin eso,
 * cada corrida del cron sumaría un aviso más a la campana.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  avisosDeLinkFaltante,
  DIAS_HACIA_ATRAS,
  type CuentaConCm,
  type PiezaPublicada,
} from "./link-faltante";

export async function runAvisoLinkFaltante(
  admin: SupabaseClient,
  hoy: string
): Promise<{ avisados: number; detalle: string[] }> {
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - DIAS_HACIA_ATRAS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [{ data: pubsRaw }, { data: cliRaw }] = await Promise.all([
    admin
      .from("publications")
      .select("id, titulo, tipo, estado, cliente_id, fecha_publicacion, link_instagram")
      .eq("estado", "publicado")
      .gte("fecha_publicacion", desde),
    admin.from("clients").select("id, nombre, cm_id").eq("estado", "activo"),
  ]);

  const piezas = ((pubsRaw ?? []) as PiezaPublicada[]).map((p) => ({
    ...p,
    fecha_publicacion: p.fecha_publicacion ? String(p.fecha_publicacion).slice(0, 10) : null,
  }));
  const cuentas = (cliRaw ?? []) as CuentaConCm[];
  const avisos = avisosDeLinkFaltante({ piezas, cuentas, desde });
  if (avisos.length === 0) return { avisados: 0, detalle: [] };

  // Uno por día por persona: se mira si ya hay un aviso de link de hoy.
  const inicioDelDia = `${hoy}T00:00:00.000Z`;
  const { data: yaRaw } = await admin
    .from("notifications")
    .select("user_id")
    .eq("tipo", "recordatorio")
    .like("mensaje", "🔗%")
    .gte("created_at", inicioDelDia);
  const ya = new Set(((yaRaw ?? []) as { user_id: string }[]).map((n) => n.user_id));

  const nuevos = avisos.filter((a) => !ya.has(a.userId));
  if (nuevos.length === 0) return { avisados: 0, detalle: [] };

  const { error } = await admin.from("notifications").insert(
    nuevos.map((a) => ({
      user_id: a.userId,
      tipo: "recordatorio" as const,
      mensaje: a.mensaje,
      link: a.link,
      leida: false,
    }))
  );
  if (error) throw new Error(error.message);

  return { avisados: nuevos.length, detalle: nuevos.map((a) => a.mensaje) };
}
