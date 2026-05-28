import type { SupabaseClient } from "@supabase/supabase-js";
import { PACK_QUOTAS, type PackId } from "@/lib/content-plans/packs";
import { generateMonthlyNarrative } from "./insight";

const isReel = (t: string) => t === "reel" || t === "video";
const isPost = (t: string) => t === "post" || t === "carrusel";

interface ClientLite {
  id: string;
  nombre: string;
  pack: string | null;
  cm_id: string | null;
  creativa_asignada_id: string | null;
}

function quotaFor(pack: string | null): { reels: number; posts: number } {
  if (pack && pack !== "Personalizado") {
    const q = PACK_QUOTAS[pack as Exclude<PackId, "Personalizado">];
    if (q) return { reels: q.reels, posts: q.posts };
  }
  return { reels: 0, posts: 0 };
}

function compact(obj: unknown, keys: string[], max = 1200): string {
  if (!obj || typeof obj !== "object") return "";
  const src = obj as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const k of keys) if (src[k] !== undefined) picked[k] = src[k];
  const s = JSON.stringify(picked);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Destinatarios del digest: owner (JDMEDIA_LIVE_OWNER_EMAIL) + DIRECTOR_DIGEST_EMAILS. */
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

interface NotifRow {
  user_id: string;
  tipo: "recordatorio";
  mensaje: string;
  leida: boolean;
  link: string;
}

/** Inserta notifs evitando duplicados ya enviados hoy con el mismo prefijo. */
async function insertNotifsDeduped(
  admin: SupabaseClient,
  now: Date,
  prefix: string,
  rows: NotifRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
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
  const fresh = rows.filter((r) => !already.has(`${r.user_id}::${r.mensaje}`));
  if (fresh.length === 0) return 0;
  const { error } = await admin.from("notifications").insert(fresh);
  if (error) throw new Error(error.message);
  return fresh.length;
}

/**
 * Cierre de mes (último día): mide el cumplimiento del pack contra lo
 * PUBLICADO en el mes en curso y notifica variaciones al owner + Brisa y al CM.
 */
export async function runMonthEndCompliance(admin: SupabaseClient, now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  ).toISOString();
  const mesLabel = now.toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, pack, cm_id, creativa_asignada_id")
    .eq("estado", "activo");
  const clients = (clientsRaw ?? []) as ClientLite[];
  if (clients.length === 0) return { ok: true, notified: 0 };
  const ids = clients.map((c) => c.id);

  const { data: pubsRaw } = await admin
    .from("publications")
    .select("cliente_id, tipo")
    .in("cliente_id", ids)
    .eq("estado", "publicado")
    .gte("fecha_publicacion", start)
    .lte("fecha_publicacion", end);
  const pubs = (pubsRaw ?? []) as { cliente_id: string; tipo: string }[];

  const prefix = "📊 Cierre";
  const rows: NotifRow[] = [];
  const incompletos: string[] = [];
  let cumplieron = 0;

  for (const c of clients) {
    const q = quotaFor(c.pack);
    if (q.reels === 0 && q.posts === 0) continue; // Personalizado / sin cuota
    const mine = pubs.filter((p) => p.cliente_id === c.id);
    const r = mine.filter((p) => isReel(p.tipo)).length;
    const p = mine.filter((x) => isPost(x.tipo)).length;
    const cumplePack = r >= q.reels && p >= q.posts;
    if (cumplePack) {
      cumplieron++;
      continue;
    }
    const faltaR = Math.max(0, q.reels - r);
    const faltaP = Math.max(0, q.posts - p);
    const det: string[] = [];
    if (faltaR > 0) det.push(`${r}/${q.reels} reels`);
    if (faltaP > 0) det.push(`${p}/${q.posts} posts`);
    incompletos.push(`${c.nombre} (${det.join(", ")})`);

    const recipient = c.cm_id ?? c.creativa_asignada_id;
    if (recipient) {
      rows.push({
        user_id: recipient,
        tipo: "recordatorio",
        mensaje: `${prefix}: ${c.nombre} cerró el mes con ${det.join(", ")} publicados. Revisá variaciones del pack.`,
        leida: false,
        link: "/director",
      });
    }
  }

  const total = clients.filter((c) => {
    const q = quotaFor(c.pack);
    return q.reels > 0 || q.posts > 0;
  }).length;

  let digestMsg = `${prefix} de ${mesLabel}: ${cumplieron}/${total} cuentas cumplieron el pack`;
  if (incompletos.length > 0) {
    digestMsg += `. Con variaciones: ${incompletos.slice(0, 8).join("; ")}${incompletos.length > 8 ? "…" : ""}`;
  } else {
    digestMsg += ". Todo cumplido ✔";
  }
  digestMsg += ". Ver →";

  for (const uid of await digestUserIds(admin)) {
    rows.push({
      user_id: uid,
      tipo: "recordatorio",
      mensaje: digestMsg,
      leida: false,
      link: "/director",
    });
  }

  const notified = await insertNotifsDeduped(admin, now, prefix, rows);
  return { ok: true, cumplieron, total, incompletos: incompletos.length, notified };
}

/**
 * Inicio de mes (día 1): prepara el reporte del MES ANTERIOR de cada cliente
 * activo — narrativa IA + cumplimiento sobre lo publicado — y lo deja cargado
 * en client_monthly_reports para que el equipo complete métricas y lo envíe.
 * No pisa notas escritas a mano.
 */
export async function runMonthStartReports(admin: SupabaseClient, now: Date) {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const start = prev.toISOString();
  const end = new Date(prev.getFullYear(), prev.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const mesLabel = prev.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, pack, cm_id, creativa_asignada_id")
    .eq("estado", "activo");
  const clients = (clientsRaw ?? []) as ClientLite[];
  if (clients.length === 0) return { ok: true, prepared: 0 };
  const ids = clients.map((c) => c.id);

  // created_by_id para el upsert (owner o primer admin)
  let createdById: string | null = null;
  const ownerEmail = process.env.JDMEDIA_LIVE_OWNER_EMAIL?.trim().toLowerCase();
  const { data: adminsRaw } = await admin
    .from("users")
    .select("id, email, rol")
    .eq("activo", true)
    .eq("rol", "admin");
  const admins = (adminsRaw ?? []) as { id: string; email: string; rol: string }[];
  createdById =
    admins.find((a) => (a.email ?? "").trim().toLowerCase() === ownerEmail)?.id ??
    admins[0]?.id ??
    null;

  // Pubs publicadas del mes anterior + diag + plan
  const [{ data: pubsRaw }, { data: diagsRaw }, { data: plansRaw }, { data: existingRaw }] =
    await Promise.all([
      admin
        .from("publications")
        .select("cliente_id, titulo, red, tipo")
        .in("cliente_id", ids)
        .eq("estado", "publicado")
        .gte("fecha_publicacion", start)
        .lte("fecha_publicacion", end),
      admin
        .from("client_diagnostics")
        .select("cliente_id, content, version")
        .in("cliente_id", ids)
        .eq("status", "approved")
        .order("version", { ascending: false }),
      admin
        .from("client_content_plans")
        .select("cliente_id, content, created_at")
        .in("cliente_id", ids)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      admin
        .from("client_monthly_reports")
        .select("cliente_id, nota")
        .eq("year_month", yearMonth)
        .in("cliente_id", ids),
    ]);

  const pubs = (pubsRaw ?? []) as {
    cliente_id: string;
    titulo: string;
    red: string;
    tipo: string;
  }[];
  const diagByClient = new Map<string, unknown>();
  for (const d of (diagsRaw ?? []) as { cliente_id: string; content: unknown }[])
    if (!diagByClient.has(d.cliente_id)) diagByClient.set(d.cliente_id, d.content);
  const planByClient = new Map<string, unknown>();
  for (const p of (plansRaw ?? []) as { cliente_id: string; content: unknown }[])
    if (!planByClient.has(p.cliente_id)) planByClient.set(p.cliente_id, p.content);
  // Clientes que ya tienen una nota escrita: no la pisamos.
  const yaConNota = new Set(
    ((existingRaw ?? []) as { cliente_id: string; nota: string | null }[])
      .filter((e) => (e.nota ?? "").trim().length > 0)
      .map((e) => e.cliente_id)
  );

  let prepared = 0;
  for (const c of clients) {
    if (yaConNota.has(c.id)) continue;
    const q = quotaFor(c.pack);
    const mine = pubs.filter((p) => p.cliente_id === c.id);
    const pubReels = mine.filter((p) => isReel(p.tipo)).length;
    const pubPosts = mine.filter((p) => isPost(p.tipo)).length;

    const narrative = await generateMonthlyNarrative({
      nombre: c.nombre,
      mesLabel,
      pack: c.pack,
      quotaReels: q.reels,
      quotaPosts: q.posts,
      pubReels,
      pubPosts,
      piezas: mine.map((p) => ({ titulo: p.titulo, red: p.red, tipo: p.tipo })),
      planTemas: compact(planByClient.get(c.id), ["temas_destacados", "campanas"]),
      diagTono: compact(diagByClient.get(c.id), ["marca"]),
    });
    if (!narrative) continue;

    const { error } = await admin.from("client_monthly_reports").upsert(
      {
        cliente_id: c.id,
        year_month: yearMonth,
        nota: narrative,
        created_by_id: createdById,
      },
      { onConflict: "cliente_id,year_month" }
    );
    if (!error) prepared++;
  }

  // Avisar al owner + Brisa que los reportes están listos para revisar/enviar.
  const prefix = "🗓️ Reportes";
  const rows: NotifRow[] = (await digestUserIds(admin)).map((uid) => ({
    user_id: uid,
    tipo: "recordatorio" as const,
    mensaje: `${prefix} de ${mesLabel} preparados (${prepared} cliente${prepared === 1 ? "" : "s"}). Completá métricas y envialos al cliente. Ver →`,
    leida: false,
    link: "/clientes",
  }));
  const notified = await insertNotifsDeduped(admin, now, prefix, rows);

  return { ok: true, prepared, notified, year_month: yearMonth };
}
