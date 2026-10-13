import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTicket } from "@/lib/tareas/tickets";
import { estadoAprobacion } from "@/lib/tareas/puerta";
import { tieneArchivo } from "@/lib/contenidos/aprobacion";
import { ymdEnZona } from "@/lib/dates";
import type { ItemAprobar } from "@/components/bandeja-aprobar";

export const SELECT_PARA_APROBAR =
  "id, numero, titulo, fecha_limite, revision_desde, cliente:clients(nombre), asignado:users!tasks_asignado_a_id_fkey(nombre), creador:users!tasks_creado_por_id_fkey(nombre)";

export interface FilaParaAprobar {
  id: string;
  numero: number | null;
  titulo: string;
  revision_desde?: string | null;
  cliente: { nombre: string } | null;
  asignado: { nombre: string } | null;
}

/**
 * Las filas de la bandeja de aprobación, con la pieza del calendario de cada
 * ticket (fecha de salida y archivo) para decidir sin entrar a la tarea. Lo
 * usan la bandeja de Tareas y el Mi día de la dirección creativa.
 */
export async function armarItemsParaAprobar(
  admin: SupabaseClient,
  filas: FilaParaAprobar[]
): Promise<ItemAprobar[]> {
  if (!filas.length) return [];
  const { data: pubsRaw } = await admin
    .from("publications")
    .select("task_id, estado, fecha_publicacion, asset_url, link_instagram, publish_media")
    .in("task_id", filas.map((f) => f.id));
  type Pub = {
    task_id: string;
    estado: string;
    fecha_publicacion: string | null;
    asset_url: string | null;
    link_instagram: string | null;
    publish_media: unknown[] | null;
  };
  const pubDe = new Map(((pubsRaw ?? []) as Pub[]).map((p) => [p.task_id, p]));
  const items: ItemAprobar[] = filas.map((f) => {
    const p = pubDe.get(f.id);
    const reloj = f.revision_desde ? estadoAprobacion(f.revision_desde) : null;
    return {
      id: f.id,
      ticket: formatTicket(f.numero) ?? null,
      titulo: f.titulo,
      cliente: f.cliente?.nombre ?? null,
      persona: f.asignado?.nombre ?? null,
      reloj: reloj ? { texto: reloj.texto, vencida: reloj.vencida } : null,
      pieza: p
        ? {
            sale: ymdEnZona(p.fecha_publicacion),
            archivo: p.asset_url || p.link_instagram || null,
            tieneArchivo: tieneArchivo({ ...p, estado: "revision_creativa" }),
          }
        : null,
    };
  });
  // Lo que sale antes, arriba; lo que no es del calendario, al final.
  return items.sort((a, b) => (a.pieza?.sale ?? "9999").localeCompare(b.pieza?.sale ?? "9999"));
}

/** Lo que espera la aprobación de una persona, armado para la bandeja. */
export async function cargarParaAprobar(admin: SupabaseClient, aprobadorId: string): Promise<ItemAprobar[]> {
  const { data, error } = await admin
    .from("tasks")
    .select(SELECT_PARA_APROBAR)
    .eq("estado", "en_revision")
    .eq("aprobador_id", aprobadorId)
    .order("revision_desde", { ascending: true })
    .limit(100);
  if (error) return [];
  return armarItemsParaAprobar(admin, (data ?? []) as unknown as FilaParaAprobar[]);
}
