import { NextResponse } from "next/server";
import { requireUser, canUseProspectingAi, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { extractContacts, type ExtractContext } from "@/lib/prospecting/extract";
import { FUENTES_OK } from "@/lib/prospecting/shared";
import { searchPlaces, filtrarContactables, placesConfigured } from "@/lib/prospecting/places";
import { friendlyAiError } from "@/lib/ai/errors";

/** Quién puede sacar contactos de Google Places (no gasta tokens). */
const PROSPECTING_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Modo RÁPIDO: extrae contactos (empresa + persona + rol + teléfono) con el
 * mínimo de tokens y los guarda en `prospecting_contacts` (tabla aparte del
 * pipeline). Una sola pasada, sin verificar IG ni generar mensajes.
 */
export async function POST(
  req: Request,
  { params }: { params: { campaignId: string } }
) {
  const me = await requireUser();
  const bodyRaw = (await req.json().catch(() => ({}))) as {
    cantidad?: number;
    fuente?: string;
  };
  const usaPlaces = bodyRaw.fuente === "places";

  // Google Places NO gasta tokens (datos estructurados de Google, dentro del
  // tramo gratis para nuestro volumen): lo puede usar todo el equipo comercial.
  // El extractor con IA sigue siendo del director + quien tenga `contactos_ia`.
  if (usaPlaces) {
    if (!userInRoles(me, PROSPECTING_ROLES))
      return NextResponse.json({ error: "Sin acceso a prospección." }, { status: 403 });
    if (!placesConfigured())
      return NextResponse.json(
        {
          error:
            "Falta configurar la clave de Google Places (GOOGLE_PLACES_API_KEY) en las variables de entorno.",
        },
        { status: 400 }
      );
  } else if (!canUseProspectingAi(me)) {
    return NextResponse.json(
      { error: "No tenés habilitado 'Sacar contactos' con IA. Pedíselo al director, o usá 'Pegar desde Excel/Maps' para cargar sin gastar tokens." },
      { status: 403 }
    );
  }

  const admin = createAdmin();
  const { data: camp, error: cErr } = await admin
    .from("prospecting_campaigns")
    .select("id, nombre, rubro, ubicacion, idioma")
    .eq("id", params.campaignId)
    .maybeSingle();
  if (cErr && (cErr as { code?: string }).code === "42P01")
    return NextResponse.json({ error: "Falta aplicar la migración 0097." }, { status: 400 });
  if (!camp) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  const c = camp as {
    id: string;
    nombre: string;
    rubro: string;
    ubicacion: string | null;
    idioma: string;
  };

  // Empresas ya cargadas (en contactos): no repetirlas.
  const { data: existing, error: exErr } = await admin
    .from("prospecting_contacts")
    .select("empresa")
    .eq("campaign_id", c.id);
  if (exErr && (exErr as { code?: string }).code === "42P01")
    return NextResponse.json(
      { error: "Falta aplicar la migración 0130 (contactos)." },
      { status: 400 }
    );
  const excludeEmpresas = ((existing ?? []) as { empresa: string }[]).map((e) => e.empresa);

  const cantidad = Math.min(Math.max(bodyRaw.cantidad ?? 15, 1), 50);
  const fuente = FUENTES_OK.includes(bodyRaw.fuente ?? "") ? bodyRaw.fuente : "mix";

  const ctx: ExtractContext = {
    nombre: c.nombre,
    rubro: c.rubro,
    ubicacion: c.ubicacion,
    idioma: c.idioma,
    fuente,
    excludeEmpresas,
  };

  // ── Camino Google Places: una llamada por cada 20 negocios, sin IA ──
  if (usaPlaces) {
    let encontrados;
    try {
      encontrados = filtrarContactables(
        await searchPlaces({
          rubro: c.rubro,
          ubicacion: c.ubicacion,
          cantidad,
          excludeEmpresas,
          userId: me.id,
        })
      );
    } catch (e) {
      console.error("searchPlaces:", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "No se pudo consultar Google." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      await guardarContactos(
        admin,
        c.id,
        me.id,
        "places",
        encontrados.map((p) => ({
          empresa: p.empresa,
          contacto_nombre: null,
          contacto_rol: null,
          telefono: p.telefono,
          instagram: null,
          sitio_web: p.sitio_web,
          notas: p.direccion,
        })),
        excludeEmpresas
      )
    );
  }

  // Buscamos en RONDAS de a 15 (Haiku rinde mejor por tanda) hasta juntar
  // `cantidad`. Entre ronda y ronda sumamos lo encontrado a la exclusión para no
  // repetir. Damos margen extra de rondas (hasta 8) para de verdad llegar a 50, y
  // toleramos UNA ronda floja antes de cortar (a veces la 2ª tanda revive con
  // otras búsquedas). maxDuration=300 cubre el tiempo.
  const PER_ROUND = 15;
  const rondas = Math.min(Math.ceil(cantidad / PER_ROUND) + 2, 8);
  const contactos: Awaited<ReturnType<typeof extractContacts>> = [];
  const vistasRondas = new Set(excludeEmpresas.map((e) => e.toLowerCase().trim()));
  let vaciasSeguidas = 0;
  try {
    for (let r = 0; r < rondas && contactos.length < cantidad; r++) {
      const faltan = Math.min(cantidad - contactos.length, PER_ROUND);
      const tanda = await extractContacts({ ...ctx, excludeEmpresas: [...vistasRondas] }, faltan);
      let nuevos = 0;
      for (const ct of tanda) {
        const key = ct.empresa.toLowerCase().trim();
        if (vistasRondas.has(key)) continue;
        vistasRondas.add(key);
        contactos.push(ct);
        nuevos++;
      }
      if (nuevos === 0) {
        vaciasSeguidas++;
        if (vaciasSeguidas >= 2) break; // dos rondas sin nada nuevo: el nicho se agotó
      } else {
        vaciasSeguidas = 0;
      }
    }
  } catch (e) {
    if (contactos.length === 0) {
      console.error("extractContacts:", e);
      return NextResponse.json({ error: friendlyAiError(e) }, { status: 400 });
    }
    console.warn("extractContacts (ronda parcial):", (e as Error).message);
  }

  if (contactos.length === 0)
    return NextResponse.json({
      created: 0,
      skipped: 0,
      message:
        "La búsqueda no trajo contactos nuevos. Probá afinar el rubro o la zona, o cambiá de campaña.",
    });

  return NextResponse.json(
    await guardarContactos(admin, c.id, me.id, "ia", contactos, excludeEmpresas)
  );
}

interface ContactoAGuardar {
  empresa: string;
  contacto_nombre: string | null;
  contacto_rol: string | null;
  telefono: string | null;
  instagram: string | null;
  sitio_web: string | null;
  notas?: string | null;
}

/**
 * Guarda los contactos encontrados, deduplicando contra lo ya cargado. Lo usan
 * los dos caminos (IA y Google Places) para que la resiliencia de columnas y el
 * dedup vivan en un solo lugar.
 */
async function guardarContactos(
  admin: ReturnType<typeof createAdmin>,
  campaignId: string,
  userId: string,
  fuente: "ia" | "places",
  contactos: ContactoAGuardar[],
  excludeEmpresas: string[]
): Promise<{ created: number; skipped: number; found: number; message?: string }> {
  if (contactos.length === 0)
    return {
      created: 0,
      skipped: 0,
      found: 0,
      message:
        "La búsqueda no trajo contactos nuevos. Probá afinar el rubro o la zona, o cambiá de campaña.",
    };

  const vistas = new Set(excludeEmpresas.map((e) => e.toLowerCase().trim()));
  let created = 0;
  let skipped = 0;
  for (const ct of contactos) {
    const key = ct.empresa.toLowerCase().trim();
    if (vistas.has(key)) {
      skipped++;
      continue;
    }
    vistas.add(key);
    const row: Record<string, unknown> = {
      campaign_id: campaignId,
      empresa: ct.empresa,
      contacto_nombre: ct.contacto_nombre,
      contacto_rol: ct.contacto_rol,
      telefono: ct.telefono,
      instagram: ct.instagram,
      sitio_web: ct.sitio_web,
      notas: ct.notas ?? null,
      created_by: userId,
      fuente,
    };
    let insErr = (await admin.from("prospecting_contacts").insert(row)).error;
    // Resiliencia: si falta la 0136 (instagram/sitio_web), guardamos sin esas
    // columnas en vez de perder el contacto.
    if (insErr && (insErr as { code?: string }).code === "42703") {
      delete row.instagram;
      delete row.sitio_web;
      insErr = (await admin.from("prospecting_contacts").insert(row)).error;
    }
    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") skipped++;
      else console.warn("insert contacto:", insErr.message);
      continue;
    }
    created++;
  }

  return { created, skipped, found: contactos.length };
}
