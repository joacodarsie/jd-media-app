/**
 * El momento justo para pedir una recomendación, contra la base (24/10/2026).
 * Qué cuenta como logro lo decide `momento.ts` (puro).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_PM } from "@/lib/tareas/puerta";
import { cargarCrecimiento, type Crecimiento } from "@/lib/crecimiento/cargar";
import { logroDeLaCuenta, tareaPedirRecomendacion, type Logro, type PostDelMes } from "./momento";
import { puedeRecomendar } from "./referidos";

type Admin = SupabaseClient;

/** El logro de la cuenta hoy, o null. Si ya se cargó su crecimiento, se reusa. */
export async function cargarLogro(admin: Admin, clienteId: string, hoy: string, crecimiento?: Crecimiento | null): Promise<Logro | null> {
  const [{ data: snap }, crec] = await Promise.all([
    admin
      .from("ig_snapshots")
      .select("detalle")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
    crecimiento !== undefined ? Promise.resolve(crecimiento) : cargarCrecimiento(admin, clienteId).catch(() => null),
  ]);
  const posts = (((snap as { detalle?: { media?: PostDelMes[] } } | null)?.detalle?.media ?? []) as PostDelMes[]);
  const seg = crec?.comparaciones.find((c) => c.clave === "seguidores") ?? null;
  // Sin foto de inicio, el primer y el último registro diario de Instagram.
  const serie = crec?.seguidores ?? [];
  const antes = seg?.antes ?? (serie.length > 1 ? serie[0].followers : null);
  // Hoy: el registro diario más nuevo (la foto mensual puede tener semanas).
  const ahora = serie.length ? serie[serie.length - 1].followers : seg?.hoy ?? null;
  return logroDeLaCuenta({ posts, seguidoresAntes: antes, seguidoresHoy: ahora, hoy });
}

/** Para el cron: una tarea a la PM por cuenta y por mes, cuando hay un logro para aprovechar. */
export async function runMomentosParaRecomendar(admin: Admin, hoy: string): Promise<{ creadas: number }> {
  const { data: cRaw } = await admin.from("clients").select("id, nombre, fecha_inicio, es_interno, ref_code").eq("estado", "activo");
  const cuentas = ((cRaw ?? []) as { id: string; nombre: string; fecha_inicio: string | null; es_interno: boolean | null; ref_code: string | null }[]).filter(
    (c) => !c.es_interno && c.ref_code && puedeRecomendar(c.fecha_inicio, hoy)
  );
  if (!cuentas.length) return { creadas: 0 };
  const { data: ya } = await admin.from("tasks").select("rutina_key").like("rutina_key", `ref:momento:%:${hoy.slice(0, 7)}`);
  const hechas = new Set(((ya ?? []) as { rutina_key: string }[]).map((t) => t.rutina_key));
  const { data: uRaw } = await admin.from("users").select("id, rol, area, area_secundaria").eq("activo", true);
  const users = (uRaw ?? []) as { id: string; rol: string; area: string | null; area_secundaria: string | null }[];
  const pm = users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ?? users.find((u) => u.rol === "admin")?.id;
  if (!pm) return { creadas: 0 };

  let creadas = 0;
  for (const c of cuentas) {
    if (hechas.has(`ref:momento:${c.id}:${hoy.slice(0, 7)}`)) continue;
    const logro = await cargarLogro(admin, c.id, hoy).catch(() => null);
    if (!logro) continue;
    const t = tareaPedirRecomendacion(c, logro, hoy);
    const limite = new Date(`${hoy}T12:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + 2);
    const { error } = await admin.from("tasks").insert({
      ...t,
      cliente_id: c.id,
      asignado_a_id: pm,
      creado_por_id: pm,
      area: "Coordinación",
      prioridad: "alta",
      estado: "pendiente",
      fecha_limite: limite.toISOString().slice(0, 10),
    });
    if (!error) creadas++;
  }
  return { creadas };
}
