/**
 * Crea el onboarding de 15 días de una cuenta: el ticket madre y su desglose.
 *
 * La decisión de QUÉ pasos van vive en `onboarding-15.ts` (puro y testeado);
 * acá solo se habla con la base.
 *
 * Idempotente por el título del ticket madre: se puede llamar dos veces (al
 * activar la cuenta y desde el botón del onboarding) sin duplicar nada.
 */
import { tiposDeServicio } from "@/lib/pack-marca-real";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { AREA_PM } from "@/lib/tareas/puerta";
import { planOnboarding, filasDelPlan, tituloMadre } from "./onboarding-15";

type Admin = SupabaseClient;

export interface ResultadoOnboarding {
  creado: boolean;
  /** Por qué no se creó, cuando no se creó. */
  motivo?: "ya_existe" | "sin_cliente" | "sin_responsable" | "error";
  madreId?: string;
  numero?: number;
  subtareas?: number;
  error?: string;
}

export async function runOnboarding15(
  admin: Admin,
  clienteId: string,
  opts: { creadoPorId?: string; fechaInicio?: string } = {}
): Promise<ResultadoOnboarding> {
  const { data: cRaw } = await admin
    .from("clients")
    .select(
      "id, nombre, fecha_inicio, cm_id, disenador_id, audiovisual_id, media_buyer_id, es_interno"
    )
    .eq("id", clienteId)
    .maybeSingle();
  const c = cRaw as {
    id: string;
    nombre: string;
    fecha_inicio: string | null;
    cm_id: string | null;
    disenador_id: string | null;
    audiovisual_id: string | null;
    media_buyer_id: string | null;
    es_interno: boolean | null;
  } | null;
  if (!c || c.es_interno) return { creado: false, motivo: "sin_cliente" };

  // Ya está armado: no se duplica. Cuenta también el archivado — si alguien lo
  // archivó fue a propósito y volver a crearlo al día siguiente es pelearle.
  // Se busca por CUENTA y no solo por título: al renombrar Nahuel → Nazar
  // Hogar el título cambió y se armó un segundo arranque entero (26/9/2026).
  const { data: yaHay } = await admin
    .from("tasks")
    .select("id")
    .or(
      `titulo.eq.${JSON.stringify(tituloMadre(c.nombre))},and(cliente_id.eq.${clienteId},titulo.like.${JSON.stringify(tituloMadre("") + "%")})`
    )
    .limit(1);
  if (yaHay?.length) return { creado: false, motivo: "ya_existe" };

  // Fallback de responsable: la project manager; si no está, el primer admin.
  // Se resuelve por ÁREA y no por email: el puesto lo puede ocupar otra
  // persona y el arranque no puede depender de que alguien se acuerde de
  // tocar el código (antes decía luz@jdmedia.com escrito a mano).
  const { data: usersRaw } = await admin
    .from("users")
    .select("id, rol, area, area_secundaria")
    .eq("activo", true);
  const users = (usersRaw ?? []) as {
    id: string;
    rol: string;
    area: string | null;
    area_secundaria: string | null;
  }[];
  const fallback =
    users.find((u) => u.area === AREA_PM || u.area_secundaria === AREA_PM)?.id ??
    users.find((u) => u.rol === "admin")?.id;
  if (!fallback) return { creado: false, motivo: "sin_responsable" };

  const { data: svcRaw } = await admin
    .from("client_services")
    .select("tipo, pack")
    .eq("cliente_id", clienteId)
    .eq("activo", true);
  const servicios = tiposDeServicio((svcRaw ?? []) as { tipo: string; pack: string | null }[]);

  const hoy = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  const inicio = opts.fechaInicio ?? c.fecha_inicio ?? hoy;
  const plan = planOnboarding({
    nombreCliente: c.nombre,
    servicios,
    equipo: {
      cm_id: c.cm_id,
      disenador_id: c.disenador_id,
      audiovisual_id: c.audiovisual_id,
      media_buyer_id: c.media_buyer_id,
      fallback,
    },
  });
  const filas = filasDelPlan(plan, inicio);
  const creadoPor = opts.creadoPorId ?? fallback;

  const { data: madreRaw, error: errMadre } = await admin
    .from("tasks")
    .insert({
      titulo: filas.madre.titulo,
      descripcion: filas.madre.descripcion,
      cliente_id: clienteId,
      asignado_a_id: filas.madre.asignado_a_id,
      creado_por_id: creadoPor,
      area: filas.madre.area,
      prioridad: "alta",
      estado: "pendiente",
      fecha_limite: filas.madre.fecha_limite,
    })
    .select("id, numero")
    .single();
  if (errMadre || !madreRaw)
    return { creado: false, motivo: "error", error: errMadre?.message };
  const madre = madreRaw as { id: string; numero: number };

  const { error: errSubs } = await admin.from("tasks").insert(
    filas.pasos.map((p) => ({
      titulo: p.titulo,
      descripcion: p.descripcion,
      cliente_id: clienteId,
      asignado_a_id: p.asignado_a_id,
      creado_por_id: creadoPor,
      area: p.area,
      prioridad: "media",
      estado: "pendiente",
      fecha_limite: p.fecha_limite,
      parent_id: madre.id,
    }))
  );
  if (errSubs) {
    // Un ticket madre solo, sin desglose, es peor que nada: se borra y se avisa.
    await admin.from("tasks").delete().eq("id", madre.id);
    return { creado: false, motivo: "error", error: errSubs.message };
  }

  return {
    creado: true,
    madreId: madre.id,
    numero: madre.numero,
    subtareas: filas.pasos.length,
  };
}
