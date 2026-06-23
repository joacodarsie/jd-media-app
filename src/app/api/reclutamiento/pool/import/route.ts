import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { analyzeCvForPool } from "@/lib/recruitment/analyze-pool";
import { buildAreaProfiles } from "@/lib/recruitment/area-profile";
import { getValidGmailToken } from "@/lib/recruitment/gmail-token";
import { getOrCreatePoolSearch } from "@/lib/recruitment/pool";
import { listMessageIds, getMessage, getAttachment } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_QUERY = "has:attachment filename:pdf";
const CONCURRENCY = 5; // CVs en paralelo por tanda
const TIME_BUDGET_MS = 45_000; // cortamos antes del límite de 60s de Hobby

/**
 * POST /api/reclutamiento/pool/import
 * Procesa una TANDA de CVs del Gmail hacia el pool: lista todos los mails que
 * matchean, saltea los ya analizados, y procesa los nuevos en paralelo hasta el
 * presupuesto de tiempo. El cliente llama en loop hasta que `remaining` sea 0.
 *
 * Body: { query?: string }
 * Devuelve: { ok, errors, total, importedTotal, remaining, done }
 */
export async function POST(req: Request) {
  const me = await requireUser();
  if (!isStaff(me.rol))
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });

  const admin = createAdmin();

  let poolId: string;
  try {
    poolId = await getOrCreatePoolSearch(admin);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "42703" || code === "42P01")
      return NextResponse.json({ error: "Falta aplicar la migración 0098." }, { status: 400 });
    return NextResponse.json(
      { error: "No se pudo abrir el pool: " + ((e as Error).message ?? "") },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const query = (body.query?.trim() || DEFAULT_QUERY).slice(0, 300);

  let token: string | null;
  try {
    token = await getValidGmailToken(admin);
  } catch {
    return NextResponse.json(
      { error: "No se pudo refrescar el acceso a Gmail. Reconectá la casilla." },
      { status: 400 }
    );
  }
  if (!token) return NextResponse.json({ error: "Gmail no está conectado." }, { status: 400 });

  // Mails ya analizados en el pool → para saltearlos.
  const { data: existing } = await admin
    .from("recruitment_candidates")
    .select("source_ref")
    .eq("search_id", poolId)
    .like("source_ref", "gmail:%");
  const importedMids = new Set<string>();
  for (const r of (existing ?? []) as { source_ref: string | null }[]) {
    const m = r.source_ref?.split(":")[1];
    if (m) importedMids.add(m);
  }

  let allIds: string[];
  try {
    allIds = await listMessageIds(token, query, 1500);
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudo listar Gmail: ${(e as Error).message ?? "error"}` },
      { status: 400 }
    );
  }

  const pending = allIds.filter((id) => !importedMids.has(id));
  const total = allIds.length;

  const areaProfiles = await buildAreaProfiles(admin);
  const deadline = Date.now() + TIME_BUDGET_MS;
  let ok = 0;
  const errors: string[] = [];

  async function processMid(mid: string) {
    try {
      const msg = await getMessage(token!, mid);
      if (msg.attachments.length === 0) return;
      for (const att of msg.attachments) {
        const sourceRef = `gmail:${mid}:${att.attachmentId}`;
        try {
          const bytes = await getAttachment(token!, mid, att.attachmentId);
          const pdf = await getDocumentProxy(bytes);
          const result = await extractText(pdf, { mergePages: true });
          const text = (Array.isArray(result.text) ? result.text.join("\n\n") : result.text).trim();
          if (text.length < 40) continue;
          const a = await analyzeCvForPool(text, areaProfiles);
          if (!a) continue;
          const { error: insErr } = await admin.from("recruitment_candidates").insert({
            search_id: poolId,
            nombre: a.nombre,
            email: a.email,
            telefono: a.telefono,
            ubicacion: a.ubicacion,
            es_cordoba_capital: a.es_cordoba_capital,
            area: a.best_area,
            anios_experiencia: a.anios_experiencia,
            skills: a.skills,
            educacion: a.educacion,
            resumen: a.resumen,
            fortalezas: a.fortalezas,
            dudas: a.dudas,
            fit_score: a.fit_score,
            area_scores: a.area_scores,
            fuente: "gmail",
            source_ref: sourceRef,
            archivo_nombre: att.filename,
          });
          if (!insErr) ok++;
          else if ((insErr as { code?: string }).code !== "23505")
            errors.push(`${att.filename}: ${insErr.message}`);
        } catch (e) {
          errors.push(`${att.filename}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
    } catch (e) {
      errors.push(`mail ${mid}: ${e instanceof Error ? e.message : "error"}`);
    }
  }

  let processed = 0;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    if (Date.now() > deadline) break;
    const chunk = pending.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(processMid));
    processed += chunk.length;
  }

  await admin.from("gmail_account").update({ last_sync_at: new Date().toISOString() }).eq("id", 1);

  const remaining = Math.max(0, pending.length - processed);
  const importedTotal = importedMids.size + ok;
  return NextResponse.json({
    ok,
    errors: errors.slice(0, 5),
    total,
    importedTotal,
    remaining,
    done: remaining === 0,
  });
}
