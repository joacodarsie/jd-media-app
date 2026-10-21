/**
 * Lo que hace falta de la base para medir los objetivos (lib/objetivos/equipo).
 * Lo usan la pantalla de Objetivos del equipo y «Tus objetivos» de Mi día.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosObjetivos } from "./equipo";

/** Una consulta entera, de a 1.000 filas (la base corta en 1.000). */
async function todo<T>(armar: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await armar(i, i + 999);
    if (error) break;
    const filas = (data ?? []) as T[];
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out;
}

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();

export async function cargarDatosObjetivos(admin: SupabaseClient, desde: string, hasta: string): Promise<DatosObjetivos> {
  const [
    contactos,
    propuestas,
    clientes,
    publicaciones,
    tareasCerradas,
    reunionesMensuales,
    cambios,
    encuestas,
    servicios,
    igs,
    pauta,
    onboarding,
    revisiones,
  ] = await Promise.all([
    todo<DatosObjetivos["contactos"][number]>((a, b) =>
      admin
        .from("prospecting_contacts")
        .select("asignado_a, contactado_at, reunion_at")
        .or(`contactado_at.gte.${desde},reunion_at.gte.${desde}`)
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["propuestas"][number]>((a, b) =>
      admin.from("proposals").select("creada_por_id, created_at").gte("created_at", desde).order("id").range(a, b)
    ),
    todo<DatosObjetivos["clientes"][number]>((a, b) =>
      admin
        .from("clients")
        .select("id, estado, es_interno, cm_id, disenador_id, audiovisual_id, cerrado_por_id, fecha_activado, responsable_id, fecha_inactivado, media_buyer_id")
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["publicaciones"][number]>((a, b) =>
      admin
        .from("publications")
        .select("cliente_id, tipo, estado, fecha_publicacion, revision_creativa_at")
        .gte("fecha_publicacion", desde)
        .lt("fecha_publicacion", hasta)
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["tareasCerradas"][number]>((a, b) =>
      admin
        .from("tasks")
        .select("id, asignado_a_id, area, fecha_completada, fecha_limite")
        .eq("estado", "completada")
        .gte("fecha_completada", desde)
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["reunionesMensuales"][number]>((a, b) =>
      admin.from("client_meetings").select("cliente_id, fecha").gte("fecha", desde).order("id").range(a, b)
    ),
    // Solo los cambios hechos por una persona: los del sistema (reprogramaciones
    // automáticas) no son un atraso de nadie.
    todo<{ created_at: string }>((a, b) =>
      admin
        .from("task_history")
        .select("created_at")
        .eq("campo", "fecha_limite")
        .not("user_id", "is", null)
        .gte("created_at", desde)
        .order("id")
        .range(a, b)
    ),
    todo<{ puntaje: number; created_at: string }>((a, b) =>
      admin.from("client_satisfaction").select("puntaje, created_at").gte("created_at", desde).order("id").range(a, b)
    ),
    todo<{ cliente_id: string; tipo: string }>((a, b) =>
      admin.from("client_services").select("cliente_id, tipo").eq("activo", true).order("id").range(a, b)
    ),
    todo<{ cliente_id: string }>((a, b) =>
      admin.from("ig_snapshots").select("cliente_id").gte("created_at", hace(3)).order("id").range(a, b)
    ),
    todo<{ cliente_id: string }>((a, b) =>
      admin.from("paid_media_snapshots").select("cliente_id").gt("spend", 0).gte("created_at", hace(3)).order("id").range(a, b)
    ),
    todo<{ cliente_id: string }>((a, b) =>
      admin.from("client_ads_onboarding").select("cliente_id").not("campanas_publicadas_at", "is", null).order("cliente_id").range(a, b)
    ),
    // Tareas que pasaron por «en revisión» (desde antes del período: se pueden revisar y cerrar días después).
    todo<{ task_id: string }>((a, b) =>
      admin
        .from("task_history")
        .select("task_id")
        .eq("campo", "estado")
        .eq("valor_nuevo", "en_revision")
        .gte("created_at", new Date(Date.parse(desde) - 45 * 86_400_000).toISOString())
        .order("id")
        .range(a, b)
    ),
  ]);
  return {
    contactos,
    propuestas,
    clientes,
    publicaciones,
    tareasCerradas,
    reunionesMensuales,
    cambiosFecha: cambios.map((c) => ({ fecha: c.created_at })),
    encuestas: encuestas.map((e) => ({ puntaje: Number(e.puntaje), fecha: e.created_at })),
    servicios,
    medidas: [...new Set(igs.map((x) => x.cliente_id))],
    conPauta: [...new Set(pauta.map((x) => x.cliente_id))],
    pautaLista: [...new Set(onboarding.map((x) => x.cliente_id))],
    revisadas: [...new Set(revisiones.map((x) => x.task_id))],
  };
}
