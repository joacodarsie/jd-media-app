import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireUser, isStaffUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { analyzeCv, type SearchContext } from "@/lib/recruitment/analyze";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/reclutamiento/[searchId]/upload  (multipart, campo "files" repetido)
 * Extrae el texto de cada CV (PDF), lo analiza con IA y guarda el candidato.
 * Procesa secuencialmente; conviene subir en tandas (la respuesta tiene 60s).
 */
export async function POST(
  req: Request,
  { params }: { params: { searchId: string } }
) {
  const me = await requireUser();
  if (!isStaffUser(me)) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }
  const admin = createAdmin();

  const { data: search } = await admin
    .from("recruitment_searches")
    .select("id, titulo, area, perfil, ubicacion_pref")
    .eq("id", params.searchId)
    .maybeSingle();
  if (!search) {
    return NextResponse.json({ error: "Búsqueda no encontrada." }, { status: 404 });
  }
  const ctx: SearchContext = {
    titulo: (search as { titulo: string }).titulo,
    area: (search as { area: string | null }).area,
    perfil: (search as { perfil: string | null }).perfil,
    ubicacionPref: (search as { ubicacion_pref: string | null }).ubicacion_pref,
  };

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No subiste ningún archivo." }, { status: 400 });
  }

  let ok = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const name = file.name;
    try {
      if (!name.toLowerCase().endsWith(".pdf")) {
        errors.push(`${name}: por ahora solo se aceptan PDFs.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        errors.push(`${name}: supera los 15 MB.`);
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(bytes);
      const result = await extractText(pdf, { mergePages: true });
      const text = (Array.isArray(result.text) ? result.text.join("\n\n") : result.text).trim();
      if (text.length < 40) {
        errors.push(`${name}: no se pudo leer texto (¿es un PDF escaneado/imagen?).`);
        continue;
      }

      const analysis = await analyzeCv(text, ctx);
      if (!analysis) {
        errors.push(`${name}: el análisis no devolvió resultado.`);
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
        fuente: "upload",
        source_ref: name,
        archivo_nombre: name,
      });
      if (insErr) {
        // 23505 = duplicado (mismo archivo ya cargado en esta búsqueda).
        if ((insErr as { code?: string }).code === "23505") {
          skipped++;
        } else {
          errors.push(`${name}: ${insErr.message}`);
        }
        continue;
      }
      ok++;
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : "error al procesar"}`);
    }
  }

  return NextResponse.json({ ok, skipped, errors });
}
