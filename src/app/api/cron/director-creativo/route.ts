import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { PACK_QUOTAS, describePack, type PackId } from "@/lib/content-plans/packs";
import {
  generateInsight,
  type DirectorIdea,
  type DirectorInsight,
} from "@/lib/director/insight";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Director Creativo IA — corre semanalmente (viernes).
 *
 * Para cada cliente activo distingue, en el mes en curso:
 *  - PLANEADO en el calendario (proy_*) = pubs con fecha en el mes, estado != rechazado
 *  - PUBLICADO efectivamente (pub_*)     = pubs en estado 'publicado'
 * vs la cuota del pack. Para los que tienen brechas, la IA genera un resumen
 * accionable + ideas concretas (leyendo diagnóstico + plan).
 *
 * Notifica al CM de cada cliente (su cuenta) y un digest consolidado al owner
 * + DIRECTOR_DIGEST_EMAILS.
 *
 * Auth: header Authorization: Bearer <CRON_SECRET>
 */

interface ClientLite {
  id: string;
  nombre: string;
  rubro: string | null;
  pack: string | null;
  cm_id: string | null;
  creativa_asignada_id: string | null;
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

function startOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
function endOfMonthISO(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
}

const isReel = (tipo: string) => tipo === "reel" || tipo === "video";
const isPost = (tipo: string) => tipo === "post" || tipo === "carrusel";

/** JSON compacto y truncado de campos relevantes, para inyectar en el prompt. */
function compact(obj: unknown, keys: string[], max = 2000): string {
  if (!obj || typeof obj !== "object") return "";
  const src = obj as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) picked[k] = src[k];
  const s = JSON.stringify(picked);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

interface ReportRow {
  cliente_id: string;
  nombre: string;
  cm_id: string | null;
  creativa_asignada_id: string | null;
  semana: string;
  pack: string | null;
  status: "al_dia" | "brechas";
  quota_reels: number;
  quota_posts: number;
  proy_reels: number;
  proy_posts: number;
  pub_reels: number;
  pub_posts: number;
  pipeline_next: number;
  resumen: string;
  ideas: DirectorIdea[];
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdmin();
  const now = new Date();
  const semana = now.toISOString().slice(0, 10);
  const in14d = new Date(now.getTime() + 14 * 86400000);
  const monthStart = startOfMonthISO(now);
  const monthEnd = endOfMonthISO(now);

  // 1) Clientes activos
  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, rubro, pack, cm_id, creativa_asignada_id")
    .eq("estado", "activo");
  const clients = (clientsRaw ?? []) as ClientLite[];
  if (clients.length === 0) {
    return NextResponse.json({ ok: true, analyzed: 0, notified: 0 });
  }
  const clientIds = clients.map((c) => c.id);

  // 2) Pubs del mes (con estado) + pipeline 2 semanas + diagnósticos + planes
  const [
    { data: monthPubsRaw },
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
      .select("cliente_id, content, periodo_label, created_at")
      .in("cliente_id", clientIds)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);

  const monthPubs = (monthPubsRaw ?? []) as {
    cliente_id: string;
    tipo: string;
    estado: string;
  }[];
  const nextPubs = (nextPubsRaw ?? []) as { cliente_id: string }[];

  const diagByClient = new Map<string, unknown>();
  for (const d of (diagsRaw ?? []) as { cliente_id: string; content: unknown }[]) {
    if (!diagByClient.has(d.cliente_id)) diagByClient.set(d.cliente_id, d.content);
  }
  const planByClient = new Map<string, unknown>();
  for (const p of (plansRaw ?? []) as { cliente_id: string; content: unknown }[]) {
    if (!planByClient.has(p.cliente_id)) planByClient.set(p.cliente_id, p.content);
  }

  // 3) Estado por cliente: planeado (calendario) vs publicado vs cuota
  const computed = clients.map((c) => {
    const mine = monthPubs.filter((p) => p.cliente_id === c.id);
    const planeado = mine.filter((p) => p.estado !== "rechazado");
    const publicado = mine.filter((p) => p.estado === "publicado");

    const proyReels = planeado.filter((p) => isReel(p.tipo)).length;
    const proyPosts = planeado.filter((p) => isPost(p.tipo)).length;
    const pubReels = publicado.filter((p) => isReel(p.tipo)).length;
    const pubPosts = publicado.filter((p) => isPost(p.tipo)).length;

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

    // "faltan" = lo que falta PLANEAR para llenar el calendario a la cuota
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
      faltanReels,
      faltanPosts,
      pipelineNext,
      status,
    };
  });

  // 4) IA solo para los que tienen brechas
  const reports: ReportRow[] = await Promise.all(
    computed.map(async (x): Promise<ReportRow> => {
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

      return {
        cliente_id: x.c.id,
        nombre: x.c.nombre,
        cm_id: x.c.cm_id,
        creativa_asignada_id: x.c.creativa_asignada_id,
        semana,
        pack: x.c.pack,
        status: x.status,
        quota_reels: x.quotaReels,
        quota_posts: x.quotaPosts,
        proy_reels: x.proyReels,
        proy_posts: x.proyPosts,
        pub_reels: x.pubReels,
        pub_posts: x.pubPosts,
        pipeline_next: x.pipelineNext,
        resumen,
        ideas,
      };
    })
  );

  // 5) Guardar reportes (upsert por cliente+semana)
  const { error: upErr } = await admin.from("director_reports").upsert(
    reports.map((r) => ({
      cliente_id: r.cliente_id,
      semana: r.semana,
      pack: r.pack,
      status: r.status,
      quota_reels: r.quota_reels,
      quota_posts: r.quota_posts,
      proy_reels: r.proy_reels,
      proy_posts: r.proy_posts,
      pub_reels: r.pub_reels,
      pub_posts: r.pub_posts,
      pipeline_next: r.pipeline_next,
      resumen: r.resumen,
      ideas: r.ideas,
    })),
    { onConflict: "cliente_id,semana" }
  );
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // 6) Destinatarios del digest consolidado: owner + DIRECTOR_DIGEST_EMAILS
  const digestEmails = new Set<string>();
  if (process.env.JDMEDIA_LIVE_OWNER_EMAIL)
    digestEmails.add(process.env.JDMEDIA_LIVE_OWNER_EMAIL.trim().toLowerCase());
  (process.env.DIRECTOR_DIGEST_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .forEach((e) => digestEmails.add(e));

  let digestUserIds: string[] = [];
  if (digestEmails.size > 0) {
    const { data: du } = await admin
      .from("users")
      .select("id, email")
      .eq("activo", true);
    digestUserIds = ((du ?? []) as { id: string; email: string }[])
      .filter((u) => digestEmails.has((u.email ?? "").trim().toLowerCase()))
      .map((u) => u.id);
  }

  // 7) Idempotencia: notifs del director ya enviadas hoy
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const prefix = "🎬 Director";
  const { data: existing } = await admin
    .from("notifications")
    .select("user_id, mensaje")
    .gte("created_at", startOfDay)
    .like("mensaje", `${prefix}%`);
  const alreadyKey = new Set(
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
  const push = (user_id: string, mensaje: string) => {
    const key = `${user_id}::${mensaje}`;
    if (alreadyKey.has(key)) return;
    alreadyKey.add(key);
    rows.push({ user_id, tipo: "recordatorio", mensaje, leida: false, link: "/director" });
  };

  // 7a) Notif por cliente al CM (fallback: creativa)
  for (const x of computed) {
    if (x.status !== "brechas") continue;
    const recipient = x.c.cm_id ?? x.c.creativa_asignada_id;
    if (!recipient) continue;
    const partes: string[] = [];
    if (x.faltanReels > 0) partes.push(`${x.faltanReels} reel(s)`);
    if (x.faltanPosts > 0) partes.push(`${x.faltanPosts} post(s)`);
    if (x.pipelineNext < 3) partes.push(`pipeline flojo`);
    const corto = partes.length ? partes.join(", ") : "revisar calendario";
    push(recipient, `${prefix}: ${x.c.nombre} — faltan planear ${corto}. Ver ideas →`);
  }

  // 7b) Digest consolidado al owner + Brisa
  const conBrechas = reports.filter((r) => r.status === "brechas");
  const alDia = reports.filter((r) => r.status === "al_dia");
  let digestMsg = `${prefix} semanal: ${alDia.length} al día, ${conBrechas.length} con brechas`;
  if (conBrechas.length > 0) {
    const nombres = conBrechas.map((r) => r.nombre).slice(0, 6).join(", ");
    digestMsg += ` (${nombres}${conBrechas.length > 6 ? "…" : ""})`;
  }
  digestMsg += ". Ver resumen →";
  for (const uid of digestUserIds) push(uid, digestMsg);

  let notified = 0;
  if (rows.length > 0) {
    const { error: insErr } = await admin.from("notifications").insert(rows);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    notified = rows.length;
  }

  return NextResponse.json({
    ok: true,
    analyzed: clients.length,
    con_brechas: conBrechas.length,
    al_dia: alDia.length,
    notified,
    digest_recipients: digestUserIds.length,
  });
}
