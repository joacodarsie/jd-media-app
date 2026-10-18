/**
 * Mide las publicaciones que tienen objetivo (17/10/2026). Corre con el cron
 * diario de las fotos de las cuentas.
 *
 * De dónde salen los números:
 * 1. Cuentas conectadas: el último registro diario de Instagram
 *    (`ig_snapshots.detalle.media`) ya tiene alcance, me gusta, comentarios y
 *    guardados de cada publicación. No gasta cuota.
 * 2. Cuentas sin conectar: los datos públicos (business discovery) dan me
 *    gusta y comentarios, no alcance ni guardados.
 * La pieza se encuentra por su identificador de Instagram o por el link.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { usuarioDe } from "@/lib/diagnostico/puntaje";
import { cuentaConHistorial } from "@/lib/diagnostico/instagram-publico";
import { permalinkClave, tocaMedir, valorDelObjetivo, type MetricasPieza, type Objetivo } from "./objetivos";

interface Pieza {
  id: string;
  cliente_id: string;
  ig_media_id: string | null;
  link_instagram: string | null;
  fecha_publicacion: string | null;
  objetivo: Objetivo;
  consultas_recibidas: number | null;
}

interface MediaSnap {
  id: string;
  permalink: string | null;
  like_count?: number | null;
  comments_count?: number | null;
  reach?: number | null;
  saved?: number | null;
}

export async function medirPiezas(admin: SupabaseClient, opciones: { clienteId?: string } = {}) {
  const ahora = Date.now();
  const desde = new Date(ahora - 30 * 86_400_000).toISOString();
  const hasta = new Date(ahora - 2 * 86_400_000).toISOString();
  let q = admin
    .from("publications")
    .select("id, cliente_id, ig_media_id, link_instagram, fecha_publicacion, objetivo, consultas_recibidas")
    .not("objetivo", "is", null)
    .eq("estado", "publicado")
    .gte("fecha_publicacion", desde)
    .lte("fecha_publicacion", hasta);
  if (opciones.clienteId) q = q.eq("cliente_id", opciones.clienteId);
  const { data, error } = await q;
  if (error) return { medidas: 0, sinDato: 0, error: error.message };
  const piezas = ((data ?? []) as Pieza[]).filter((p) => p.fecha_publicacion && tocaMedir(p.fecha_publicacion, ahora));

  const porCliente = new Map<string, Pieza[]>();
  for (const p of piezas) porCliente.set(p.cliente_id, [...(porCliente.get(p.cliente_id) ?? []), p]);

  const { data: base } = await admin.from("clients").select("ig_user_id").not("ig_user_id", "is", null).ilike("nombre", "jd media").limit(1).maybeSingle();
  const desdeIg = (base as { ig_user_id: string } | null)?.ig_user_id ?? null;

  let medidas = 0;
  let sinDato = 0;
  for (const [clienteId, lista] of porCliente) {
    // 1. El último registro diario de la cuenta (si está conectada).
    const { data: snap } = await admin
      .from("ig_snapshots")
      .select("detalle")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    const media = ((snap as { detalle?: { media?: MediaSnap[] } } | null)?.detalle?.media ?? []) as MediaSnap[];
    const porId = new Map(media.map((x) => [x.id, x]));
    const porLink = new Map(media.map((x) => [permalinkClave(x.permalink), x]));

    // 2. Los datos públicos, solo si hace falta.
    let publicos: Map<string | null, { likes: number | null; comentarios: number | null }> | null = null;
    const buscarPublicos = async () => {
      if (publicos) return publicos;
      publicos = new Map();
      const { data: c } = await admin.from("clients").select("instagram_url").eq("id", clienteId).maybeSingle();
      const usuario = usuarioDe((c as { instagram_url: string | null } | null)?.instagram_url ?? "");
      if (!usuario || !desdeIg) return publicos;
      try {
        const cuenta = await cuentaConHistorial(desdeIg, usuario, { paginasMax: 1 });
        for (const h of cuenta.historial) publicos.set(permalinkClave(h.permalink), { likes: h.likes, comentarios: h.comentarios });
      } catch {
        // Cuenta privada o personal: queda sin dato.
      }
      return publicos;
    };

    for (const p of lista) {
      let m: MetricasPieza | null = null;
      let fuente: "instagram" | "publico" | "manual" | null = null;
      if (p.objetivo !== "consultar") {
        const s = (p.ig_media_id && porId.get(p.ig_media_id)) || porLink.get(permalinkClave(p.link_instagram));
        if (s) {
          m = { alcance: s.reach ?? null, likes: s.like_count ?? null, comentarios: s.comments_count ?? null, guardados: s.saved ?? null };
          fuente = "instagram";
        } else if (permalinkClave(p.link_instagram)) {
          const pub = (await buscarPublicos()).get(permalinkClave(p.link_instagram));
          if (pub) {
            m = { alcance: null, likes: pub.likes, comentarios: pub.comentarios, guardados: null };
            fuente = "publico";
          }
        }
      } else fuente = "manual";
      const valor = valorDelObjetivo(p.objetivo, m, p.consultas_recibidas);
      if (valor === null) sinDato++;
      else medidas++;
      await admin
        .from("publications")
        .update({ resultado: m ? { ...m, fuente } : null, resultado_valor: valor, medido_at: new Date().toISOString() })
        .eq("id", p.id);
    }
  }
  return { medidas, sinDato };
}
