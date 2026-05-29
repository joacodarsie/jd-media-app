import type { SupabaseClient } from "@supabase/supabase-js";
import { PACK_QUOTAS, describePack, type PackId } from "@/lib/content-plans/packs";
import {
  generateInsight,
  type DirectorIdea,
  type DirectorInsight,
} from "@/lib/director/insight";

const isReel = (t: string) => t === "reel" || t === "video";
const isPost = (t: string) => t === "post" || t === "carrusel";

interface ClientLite {
  id: string;
  nombre: string;
  rubro: string | null;
  pack: string | null;
  cm_id: string | null;
  creativa_asignada_id: string | null;
}

function startOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function endOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
}

function compact(obj: unknown, keys: string[], max = 2000): string {
  if (!obj || typeof obj !== "object") return "";
  const src = obj as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) picked[k] = src[k];
  const s = JSON.stringify(picked);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

async function digestUserIds(admin: SupabaseClient): Promise<string[]> {
  const emails = new Set<string>();
  if (process.env.JDMEDIA_LIVE_OWNER_EMAIL)
    emails.add(process.env.JDMEDIA_LIVE_OWNER_EMAIL.trim().toLowerCase());
  (process.env.DIRECTOR_DIGEST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .forEach((e) => emails.add(e));
  if (emails.size === 0) return [];
  const { data } = await admin.from("users").select("id, email").eq("activo", true);
  return ((data ?? []) as { id: string; email: string }[])
    .filter((u) => emails.has((u.email ?? "").trim().toLowerCase()))
    .map((u) => u.id);
}

/**
 * Genera el parte semanal del Director para todos los clientes activos.
 * @param notify  si true, además inserta notificaciones (cron). En trigger
 *                manual lo dejamos en false para no spamear.
 */
export async function runDirectorWeekly(
  admin: SupabaseClient,
  now: Date,
  notify: boolean
) {
  const semana = now.toISOString().slice(0, 10);
  const in14d = new Date(now.getTime() + 14 * 86400000);
  const week7Ago = new Date(now.getTime() - 7 * 86400000);
  const monthStart = startOfMonthISO(now);
  const monthEnd = endOfMonthISO(now);

  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, rubro, pack, cm_id, creativa_asignada_id")
    .eq("estado", "activo");
  const clients = (clientsRaw ?? []) as ClientLite[];
  if (clients.length === 0) return { ok: true, analyzed: 0, notified: 0 };
  const clientIds = clients.map((c) => c.id);

  const [
    { data: monthPubsRaw },
    { data: weekPubsRaw },
    { data: nextPubsRaw },
    { data: diagsRaw },
    { data: plansRaw },
  ] = await Promise.all([
    admin
      .from("publications")
      .select("cliente_id, tipo, estado")
      .in("cliente_id", clientIds)
      .gte("fecha_publicacion", monthStart)
      .lte("fecha_publicacion", monthEnd),
    admin
      .from("publications")
      .select("cliente_id, tipo")
      .in("cliente_id", clientIds)
      .eq("estado", "publicado")
      .gte("fecha_publicacion", week7Ago.toISOString())
      .lte("fecha_publicacion", now.toISOString()),
    admin
      .from("publications")
      .select("cliente_id")
      .in("cliente_id", clientIds)
      .gte("fecha_publicacion", now.toISOString())
      .lte("fecha_publicacion", in14d.toISOString())
      .not("estado", "in", "(rechazado)"),
    admin
      .from("client_diagnostics")
      .select("cliente_id, content, version")
      .in("cliente_id", clientIds)
      .eq("status", "approved")
      .order("version", { ascending: false }),
    admin
      .from("client_content_plans")
      .select("cliente_id, content, created_at")
      .in("cliente_id", clientIds)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);

  const monthPubs = (monthPubsRaw ?? []) as {
    cliente_id: string;
    tipo: string;
    estado: string;
  }[];
  const weekPubs = (weekPubsRaw ?? []) as { cliente_id: string; tipo: string }[];
  const nextPubs = (nextPubsRaw ?? []) as { cliente_id: string }[];

  const diagByClient = new Map<string, unknown>();
  for (const d of (diagsRaw ?? []) as { cliente_id: string; content: unknown }[])
    if (!diagByClient.has(d.cliente_id)) diagByClient.set(d.cliente_id, d.content);
  const planByClient = new Map<string, unknown>();
  for (const p of (plansRaw ?? []) as { cliente_id: string; content: unknown }[])
    if (!planByClient.has(p.cliente_id)) planByClient.set(p.cliente_id, p.content);

  const computed = clients.map((c) => {
    const mine = monthPubs.filter((p) => p.cliente_id === c.id);
    const planeado = mine.filter((p) => p.estado !== "rechazado");
    const publicado = mine.filter((p) => p.estado === "publicado");
    const wk = weekPubs.filter((p) => p.cliente_id === c.id);

    const proyReels = planeado.filter((p) => isReel(p.tipo)).length;
    const proyPosts = planeado.filter((p) => isPost(p.tipo)).length;
    const pubReels = publicado.filter((p) => isReel(p.tipo)).length;
    const pubPosts = publicado.filter((p) => isPost(p.tipo)).length;
    const pubReelsWeek = wk.filter((p) => isReel(p.tipo)).length;
    const pubPostsWeek = wk.filter((p) => isPost(p.tipo)).length;

    let quotaReels = 0;
    let quotaPosts = 0;
    const pack = (c.pack as PackId | null) ?? null;
    if (pack && pack !== "Personalizado") {
      const q = PACK_QUOTAS[pack as Exclude<PackId, "Personalizado">];
      if (q) {
        quotaReels = q.reels;
        quotaPosts = q.posts;
      }
    }

    const faltanReels = Math.max(0, quotaReels - proyReels);
    const faltanPosts = Math.max(0, quotaPosts - proyPosts);
    const pipelineNext = nextPubs.filter((p) => p.cliente_id === c.id).length;
    const calendarioFlojo = pipelineNext < 3;
    const hasGap = faltanReels + faltanPosts > 0;
    const status: "al_dia" | "brechas" = hasGap || calendarioFlojo ? "brechas" : "al_dia";

    return {
      c,
      quotaReels,
      quotaPosts,
      proyReels,
      proyPosts,
      pubReels,
      pubPosts,
      pubReelsWeek,
      pubPostsWeek,
      faltanReels,
      faltanPosts,
      pipelineNext,
      status,
    };
  });

  const reports = await Promise.all(
    computed.map(async (x) => {
      let resumen: string;
      let ideas: DirectorIdea[] = [];

      if (x.status === "brechas") {
        const insight: DirectorInsight | null = await generateInsight({
          nombre: x.c.nombre,
          rubro: x.c.rubro,
          packDesc: describePack(x.c.pack),
          quotaReels: x.quotaReels,
          quotaPosts: x.quotaPosts,
          proyReels: x.proyReels,
          proyPosts: x.proyPosts,
          pubReels: x.pubReels,
          pubPosts: x.pubPosts,
          pipelineNext: x.pipelineNext,
          diagSummary: compact(diagByClient.get(x.c.id), [
            "publico_objetivo",
            "marca",
            "diferenciales",
            "pilares_contenido",
          ]),
          planSummary: compact(planByClient.get(x.c.id), [
            "resumen_mes",
            "mix_por_red",
            "distribucion_pilares",
            "temas_destacados",
            "campanas",
          ]),
        });
        if (insight) {
          resumen = insight.resumen;
          ideas = insight.ideas;
        } else {
          const partes: string[] = [];
          if (x.faltanReels > 0) partes.push(`${x.faltanReels} reel(s)`);
          if (x.faltanPosts > 0) partes.push(`${x.faltanPosts} post(s)`);
          if (x.pipelineNext < 3)
            partes.push(`pipeline flojo (${x.pipelineNext} en 2 semanas)`);
          resumen = `Atención: faltan planear ${partes.join(", ")}.`;
        }
      } else {
        resumen = `Al día: ${x.proyReels} reels y ${x.proyPosts} posts planeados (publicados ${x.pubReels} y ${x.pubPosts}), ${x.pipelineNext} pubs en las próximas 2 semanas.`;
      }

      return { x, resumen, ideas };
    })
  );

  const { error: upErr } = await admin.from("director_reports").upsert(
    reports.map(({ x, resumen, ideas }) => ({
      cliente_id: x.c.id,
      semana,
      pack: x.c.pack,
      status: x.status,
      quota_reels: x.quotaReels,
      quota_posts: x.quotaPosts,
      proy_reels: x.proyReels,
      proy_posts: x.proyPosts,
      pub_reels: x.pubReels,
      pub_posts: x.pubPosts,
      pub_reels_week: x.pubReelsWeek,
      pub_posts_week: x.pubPostsWeek,
      pipeline_next: x.pipelineNext,
      resumen,
      ideas,
    })),
    { onConflict: "cliente_id,semana" }
  );
  if (upErr) return { ok: false, error: upErr.message };

  const conBrechas = computed.filter((x) => x.status === "brechas");
  const alDia = computed.filter((x) => x.status === "al_dia");

  let notified = 0;
  if (notify) {
    const prefix = "🎬 Director";
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).toISOString();
    const { data: existing } = await admin
      .from("notifications")
      .select("user_id, mensaje")
      .gte("created_at", startOfDay)
      .like("mensaje", `${prefix}%`);
    const already = new Set(
      ((existing ?? []) as { user_id: string; mensaje: string }[]).map(
        (n) => `${n.user_id}::${n.mensaje}`
      )
    );
    const rows: {
      user_id: string;
      tipo: "recordatorio";
      mensaje: string;
      leida: boolean;
      link: string;
    }[] = [];
    const pushN = (user_id: string, mensaje: string) => {
      const key = `${user_id}::${mensaje}`;
      if (already.has(key)) return;
      already.add(key);
      rows.push({ user_id, tipo: "recordatorio", mensaje, leida: false, link: "/director" });
    };
    for (const x of conBrechas) {
      const recipient = x.c.cm_id ?? x.c.creativa_asignada_id;
      if (!recipient) continue;
      const partes: string[] = [];
      if (x.faltanReels > 0) partes.push(`${x.faltanReels} reel(s)`);
      if (x.faltanPosts > 0) partes.push(`${x.faltanPosts} post(s)`);
      if (x.pipelineNext < 3) partes.push(`pipeline flojo`);
      const corto = partes.length ? partes.join(", ") : "revisar calendario";
      pushN(recipient, `${prefix}: ${x.c.nombre} — faltan planear ${corto}. Ver ideas →`);
    }
    let digestMsg = `${prefix} semanal: ${alDia.length} al día, ${conBrechas.length} con brechas`;
    if (conBrechas.length > 0) {
      const nombres = conBrechas.map((x) => x.c.nombre).slice(0, 6).join(", ");
      digestMsg += ` (${nombres}${conBrechas.length > 6 ? "…" : ""})`;
    }
    digestMsg += ". Ver resumen →";
    for (const uid of await digestUserIds(admin)) pushN(uid, digestMsg);

    if (rows.length > 0) {
      const { error } = await admin.from("notifications").insert(rows);
      if (!error) notified = rows.length;
    }
  }

  return {
    ok: true,
    analyzed: clients.length,
    con_brechas: conBrechas.length,
    al_dia: alDia.length,
    notified,
  };
}
