/**
 * La aprobación tácita en el cron (ver aprobacion-tacita.ts): las piezas en
 * revisión del cliente con el plazo vencido pasan a aprobadas, queda la nota
 * en sus comentarios y se le avisa al equipo de la cuenta. Solo piezas que
 * todavía no salieron: las viejas trabadas no se tocan.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTA_TACITA, plazoAprobacion } from "./aprobacion-tacita";

export async function runAprobacionTacita(admin: SupabaseClient, hoy: string, ahora = Date.now()): Promise<{ aprobadas: string[] }> {
  const r = { aprobadas: [] as string[] };
  const { data: pRaw } = await admin
    .from("publications")
    .select("id, titulo, cliente_id, fecha_publicacion, cliente_revision_iniciada_at, updated_at, creado_por_id, audiovisual_id, cliente:clients(nombre, estado, cm_id, disenador_id, audiovisual_id)")
    .eq("estado", "revision_cliente")
    .gte("fecha_publicacion", hoy);
  const piezas = (pRaw ?? []) as unknown as {
    id: string;
    titulo: string | null;
    cliente_id: string;
    fecha_publicacion: string;
    cliente_revision_iniciada_at: string | null;
    updated_at: string | null;
    creado_por_id: string | null;
    audiovisual_id: string | null;
    cliente: { nombre: string; estado: string; cm_id: string | null; disenador_id: string | null; audiovisual_id: string | null } | null;
  }[];

  for (const p of piezas) {
    if (p.cliente?.estado !== "activo") continue;
    const plazo = plazoAprobacion(p.fecha_publicacion, p.cliente_revision_iniciada_at ?? p.updated_at);
    if (plazo.getTime() > ahora) continue;
    const { error } = await admin.from("publications").update({ estado: "aprobado" }).eq("id", p.id).eq("estado", "revision_cliente");
    if (error) continue;
    await admin.from("client_pub_comments").insert({ publication_id: p.id, cliente_id: p.cliente_id, contenido: `✓ ${NOTA_TACITA}` });
    const avisar = [...new Set([p.creado_por_id, p.audiovisual_id, p.cliente?.cm_id, p.cliente?.disenador_id, p.cliente?.audiovisual_id].filter((x): x is string => !!x))];
    if (avisar.length) {
      await admin.from("notifications").insert(
        avisar.map((user_id) => ({
          user_id,
          task_id: null,
          tipo: "comentario",
          mensaje: `✅ «${p.titulo ?? "Una pieza"}» de ${p.cliente?.nombre ?? "la cuenta"} quedó aprobada: el cliente no respondió en el plazo de la carta acuerdo. Sale en su fecha.`,
          link: `/contenidos?cliente=${p.cliente_id}`,
        }))
      );
    }
    r.aprobadas.push(`${p.cliente?.nombre}: ${p.titulo}`);
  }
  return r;
}
