/**
 * El ejecutor de las rutinas del mes: mira quién ocupa cada puesto, crea las
 * tareas que faltan y no toca las que ya están.
 *
 * La decisión de QUÉ tareas van vive en `rutinas-mensuales.ts` (puro y
 * testeado); acá solo se habla con la base.
 *
 * Idempotente por `tasks.rutina_key` (único, migración 0181): lo puede llamar
 * el cron del día 1 y también el cron diario sin crear nada dos veces.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { rutinasDelMes, type GenteRutina } from "./rutinas-mensuales";
import { AREA_DIRECTORA, AREA_PM } from "./puerta";
import { rutinasDeServicios, type CuentaConServicio } from "./rutinas-servicios";
import { isClientPausedFor } from "@/lib/client-pause";
import { AREA_DIRECCION, puestaAPunto, rutinasDeDireccion } from "@/lib/direccion/rutina";
import { hoyYmd } from "@/lib/dates";

const AREA_COORD_GENERAL = "Coordinación General";

export async function runRutinasMensuales(
  admin: SupabaseClient,
  periodo: string
): Promise<{ periodo: string; creadas: number; yaEstaban: number }> {
  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, area, area_secundaria, created_at")
    .eq("activo", true)
    .order("created_at", { ascending: true });

  const users = (usersRaw ?? []) as {
    id: string;
    rol: string;
    area: string | null;
    area_secundaria: string | null;
  }[];
  const porArea = (area: string) =>
    users.find((u) => u.area === area || u.area_secundaria === area)?.id ?? null;

  const gente: GenteRutina = {
    coordGeneralId: porArea(AREA_COORD_GENERAL),
    adminId: users.find((u) => u.rol === "admin")?.id ?? null,
    pmId: porArea(AREA_PM),
  };

  // La rutina de la dirección (ronda semanal, RRHH, objetivos, trimestre) va
  // al dueño: quien ocupa Estrategia/Dirección (12/10/2026).
  const duenoId = porArea(AREA_DIRECCION) ?? gente.adminId;
  // Los servicios que se venden aparte: WhatsApp lo da Santi (dirección
  // creativa) y Google Ads, la coordinación de pauta (pedido del 12/10/2026).
  const { data: svRaw } = await admin
    .from("client_services")
    .select("cliente_id, tipo, clients!inner(nombre, estado, es_interno, pausas)")
    .eq("activo", true)
    .in("tipo", ["gestion_whatsapp", "google_ads"]);
  const conServicio: CuentaConServicio[] = (
    (svRaw ?? []) as unknown as {
      cliente_id: string;
      tipo: string;
      clients: { nombre: string; estado: string; es_interno: boolean; pausas: string[] | null } | null;
    }[]
  )
    .filter((x) => x.clients?.estado === "activo" && !x.clients.es_interno && !isClientPausedFor(x.clients.pausas, periodo))
    .map((x) => ({ clienteId: x.cliente_id, nombre: x.clients!.nombre, tipo: x.tipo }));

  const tareas = [
    ...rutinasDelMes(periodo, gente),
    ...rutinasDeDireccion(hoyYmd(), duenoId),
    ...puestaAPunto(duenoId),
    ...rutinasDeServicios(periodo, hoyYmd(), conServicio, {
      gestion_whatsapp: porArea(AREA_DIRECTORA),
      google_ads: porArea("Coordinación de Paid Media"),
    }),
  ];
  if (tareas.length === 0) return { periodo, creadas: 0, yaEstaban: 0 };

  // Las que ya existen no se tocan: puede que alguien les haya cambiado la
  // fecha o el responsable, y pisarlas sería deshacer ese trabajo.
  const { data: yaEstan } = await admin
    .from("tasks")
    .select("rutina_key")
    .in(
      "rutina_key",
      tareas.map((t) => t.rutina_key)
    );
  const existentes = new Set(
    ((yaEstan ?? []) as { rutina_key: string }[]).map((r) => r.rutina_key)
  );

  const nuevas = tareas.filter((t) => !existentes.has(t.rutina_key));
  if (nuevas.length === 0) return { periodo, creadas: 0, yaEstaban: existentes.size };

  const { error } = await admin.from("tasks").insert(
    nuevas.map((t) => ({
      titulo: t.titulo,
      descripcion: t.descripcion,
      asignado_a_id: t.asignado_a_id,
      creado_por_id: gente.adminId,
      cliente_id: t.cliente_id,
      area: t.area,
      prioridad: t.prioridad,
      estado: "pendiente",
      fecha_limite: t.fecha_limite,
      rutina_key: t.rutina_key,
    }))
  );
  if (error) throw new Error(error.message);

  return { periodo, creadas: nuevas.length, yaEstaban: existentes.size };
}
