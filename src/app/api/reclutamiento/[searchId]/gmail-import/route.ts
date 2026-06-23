import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireUser, isStaff } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { analyzeCv, type SearchContext } from "@/lib/recruitment/analyze";
import {
  refreshGmailToken,
  listMessages,
  getMessage,
  getAttachment,
} from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_QUERY = "has:attachment filename:pdf newer_than:90d";

/** Token de Gmail válido (refresca si está por vencer) desde la cuenta guardada. */
async function getValidToken(admin: ReturnType<typeof createAdmin>) {
  const { data } = await admin
    .from("gmail_account")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    access_token: string;
    refresh_token: string;
    token_expires_at: string | null;
  };
  const exp = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (exp > Date.now() + 60_000) return row.access_token;
  // Refrescar.
  const t = await refreshGmailToken(row.refresh_token);
  await admin
    .from("gmail_account")
    .update({
      access_token: t.access_token,
      token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    })
    .eq("id", 1);
  return t.access_token;
}

export async function POST(
  req: Request,
  { params }: { params: { searchId: string } }
) {
  const me = await requireUser();
  if (!isStaff(me.rol)) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }
  const admin = createAdmin();

  const { data: search } = await admin
    .from("recruitment_searches")
    .select("id, titulo, area, perfil, ubicacion_pref")
    .eq("id", params.searchId)
    .maybeSingle();
  if (!search) return NextResponse.json({ error: "Búsqueda no encontrada." }, { status: 404 });
  const ctx: SearchContext = {
    titulo: (search as { titulo: string }).titulo,
    area: (search as { area: string | null }).area,
    perfil: (search as { perfil: string | null }).perfil,
    ubicacionPref: (search as { ubicacion_pref: string | null }).ubicacion_pref,
  };

  const body = (await req.json().catch(() => ({}))) as { query?: string; max?: number };
  const query = (body.query?.trim() || DEFAULT_QUERY).slice(0, 300);
  // `max` = cuántos CVs NUEVOS importar por tanda (objetivo). Traemos una lista
  // más grande de mails y vamos salteando los ya importados hasta llegar al
  // objetivo o al límite de tiempo.
  const max = Math.min(Math.max(body.max ?? 8, 1), 15);
  const listSize = 60;
  // Presupuesto de tiempo: las funciones de Vercel Hobby se cortan a los 60s.
  // Frenamos en 45s y devolvemos lo procesado, en vez de comerse un 504.
  const deadline = Date.now() + 45_000;
  let timedOut = false;

  let token: string | null;
  try {
    token = await getValidToken(admin);
  } catch {
    return NextResponse.json(
      { error: "No se pudo refrescar el acceso a Gmail. Reconectá la casilla." },
      { status: 400 }
    );
  }
  if (!token) {
    return NextResponse.json({ error: "Gmail no está conectado." }, { status: 400 });
  }

  let ok = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Mails ya importados en esta búsqueda → para saltearlos ANTES de descargar y
  // analizar (si no, cada reintento reprocesaría los mismos y nunca avanzaría).
  const { data: existing } = await admin
    .from("recruitment_candidates")
    .select("source_ref")
    .eq("search_id", search.id)
    .like("source_ref", "gmail:%");
  const importedMids = new Set<string>();
  for (const r of (existing ?? []) as { source_ref: string | null }[]) {
    const m = r.source_ref?.split(":")[1];
    if (m) importedMids.add(m);
  }

  try {
    const ids = await listMessages(token, query, listSize);
    for (const mid of ids) {
      if (ok >= max) break;
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }
      if (importedMids.has(mid)) {
        skipped++;
        continue;
      }
      try {
        const msg = await getMessage(token, mid);
        if (msg.attachments.length === 0) continue;
        for (const att of msg.attachments) {
          const sourceRef = `gmail:${mid}:${att.attachmentId}`;
          try {
            const bytes = await getAttachment(token, mid, att.attachmentId);
            const pdf = await getDocumentProxy(bytes);
            const result = await extractText(pdf, { mergePages: true });
            const text = (Array.isArray(result.text) ? result.text.join("\n\n") : result.text).trim();
            if (text.length < 40) {
              errors.push(`${att.filename}: PDF sin texto legible.`);
              continue;
            }
            const analysis = await analyzeCv(text, ctx);
            if (!analysis) {
              errors.push(`${att.filename}: el análisis no devolvió resultado.`);
              continue;
            }
            const { error: insErr } = await admin.from("recruitment_candidates").insert({
              search_id: search.id,
              nombre: analysis.nombre,
              email: analysis.email,
              telefono: analysis.telefono,
              ubicacion: analysis.ubicacion,
              es_cordoba_capital: analysis.es_cordoba_capital,
              area: analysis.area,
              anios_experiencia: analysis.anios_experiencia,
              skills: analysis.skills,
              educacion: analysis.educacion,
              resumen: analysis.resumen,
              fortalezas: analysis.fortalezas,
              dudas: analysis.dudas,
              fit_score: analysis.fit_score,
              fuente: "gmail",
              source_ref: sourceRef,
              archivo_nombre: att.filename,
            });
            if (insErr) {
              if ((insErr as { code?: string }).code === "23505") skipped++;
              else errors.push(`${att.filename}: ${insErr.message}`);
              continue;
            }
            ok++;
          } catch (e) {
            errors.push(`${att.filename}: ${e instanceof Error ? e.message : "error"}`);
          }
        }
      } catch (e) {
        errors.push(`mail ${mid}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    await admin.from("gmail_account").update({ last_sync_at: new Date().toISOString() }).eq("id", 1);
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudo leer Gmail: ${e instanceof Error ? e.message : "error"}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok, skipped, errors, scanned: max, timedOut });
}
